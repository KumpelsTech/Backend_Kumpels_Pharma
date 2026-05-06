import { createIntervention, createKnownIssueGenerate, createKnownIssueGenerateImplicated, getActionFrameworkOptions, getAlertsByUUid, getAlertsPatientData, getAlertsPatientDataGenerate, getCodeDetectedIssue, getCodeKnownIssueGenerate, getCombinedAlerts, getInterveneOptions, getInterventionByCode, getInterventionData, getInterventionsFromAlert, getMedicationsFromDetectedIssue, getMedicationsFromDetectedIssueAndKnowIssue, getMedicationsFromKnownIssueGenerate, getProcessStageOptions, optionLevelRiskAlert, optionStatusAlert, optionTypeAlert } from "../models/alertsModel.js";
import { getPatientIdByCode } from "../models/patientsModels.js";
import { getUserIdByCode } from "../models/userModels.js";
import {
    Patient, MedicalService, EpisodeOfCare, Observation, MedicationRequest, DiagnosisCode, ReportDiagnosis, Allergy, Medication
} from '../models/entities/entities.js';
import sequelize from '../config/db.js';

import { createFlowParaclinical } from "./paraclinicalController.js";
import { Sequelize, QueryTypes } from 'sequelize';
import { createFlowMedication } from "./medicationsController.js";


async function getAlertsPatient(uuid_patient) {
    try {
        const [dat, dataGenerate] = await Promise.all([
            getAlertsPatientData(uuid_patient.uuid),
            getAlertsPatientDataGenerate(uuid_patient.uuid)
        ]);

        if (dat) {
            dat.forEach(al => {
                switch (al.KnownIssue.KnownIssueCategory.code) {
                    case 'dosage':
                        al.KnownIssue.KnownIssueCategory.code = 'Dosis';
                        break;
                    case 'duplicate':
                        al.KnownIssue.KnownIssueCategory.code = 'Duplicidad';
                        break;
                    case 'allergy':
                        al.KnownIssue.KnownIssueCategory.code = 'Alergias';
                        break;
                    case 'drug':
                        al.KnownIssue.KnownIssueCategory.code = 'Interacción';
                        break;
                    case 'diagnostic':
                        al.KnownIssue.KnownIssueCategory.code = 'Toxicidad';
                        break;
                }
            });

            dataGenerate.forEach(al => {
                switch (al.KnownIssueCategory.code) {
                    case 'dosage':
                        al.KnownIssueCategory.code = 'Dosis';
                        break;
                    case 'duplicate':
                        al.KnownIssueCategory.code = 'Duplicidad';
                        break;
                    case 'allergy':
                        al.KnownIssueCategory.code = 'Alergias';
                        break;
                    case 'drug':
                        al.KnownIssueCategory.code = 'Interacción';
                        break;
                    case 'diagnostic':
                        al.KnownIssueCategory.code = 'Toxicidad';
                        break;
                }
            });
        }

        const datWithAgents = await Promise.all(dat.map(async data => {
            let agents;

            if (data.KnownIssue.KnownIssueCategory.code === 'Duplicidad' || data.KnownIssue.KnownIssueCategory.code === 'Alergias') {
                agents = await getMedicationsFromDetectedIssue(data.id);
            } else {
                agents = await getMedicationsFromDetectedIssueAndKnowIssue(data.id);
            }
            const interventions = await getInterventionsFromAlert(data.uuid);

            return { ...data.toJSON(), agents, interventions };
        }));

        const dataGenerateWithAgents = await Promise.all(dataGenerate.map(async dat => {
            const agents = await getMedicationsFromKnownIssueGenerate(dat.id);
            const interventions = await getInterventionsFromAlert(dat.dataValues.uuid);

            return { ...dat.toJSON(), agents, interventions };
        }));

        return {
            knownIssue: datWithAgents,
            knownIssueGenerate: dataGenerateWithAgents
        };

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}

async function getAlertByIntervention(data) {
    try {
        const alert = await getAlertsByUUid(data.uuid);

        // 🛡️ PRIMER ESCUDO: Si la alerta no existe en la DB
        if (!alert) {
            console.warn(`⚠️ No se encontró ninguna alerta con el UUID: ${data.uuid}`);
            return { message: "Alerta no encontrada", agents: [] };
        }

        let agents = [];

        // 🛡️ SEGUNDO ESCUDO: Validar KnownIssue con Optional Chaining (?.)
        if (alert.KnownIssue) {
            // Alertas del catálogo (Duplicidad o Alergias)
            const categoryId = alert.KnownIssue.KnownIssueCategory?.id;

            if (categoryId == 2 || categoryId == 3) {
                agents = await getMedicationsFromDetectedIssue(alert.id);
            } else {
                agents = await getMedicationsFromDetectedIssueAndKnowIssue(alert.id);
            }
        } else if (alert.warning) {
            // Nuestras alertas generadas por sistema (Ingesta)
            agents = await getMedicationsFromKnownIssueGenerate(alert.id);
        } else {
            // Si por alguna razón no es ninguna de las dos
            console.warn("🔔 Tipo de alerta desconocido para intervención");
            agents = [];
        }

        return {
            ...(alert.toJSON ? alert.toJSON() : alert),
            agents
        };
    } catch (error) {
        console.error('❌ Error en getAlertByIntervention -> ', error);
        throw error;
    }
}

async function getOptionsAlert() {
    try {
        const [typeAlert, riskAlert, statusAlert] = await Promise.all([
            optionTypeAlert(),
            optionLevelRiskAlert(),
            optionStatusAlert()
        ]);

        return {
            type: typeAlert,
            risk: riskAlert,
            status: statusAlert
        };

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}

async function saveAlertGenerate(data) {
    try {
        const [month, day, year] = data.date_report.split('/');
        const formattedDate = `${year}-${month}-${day}`;
        data.date_report = formattedDate;

        // 1. Buscamos el paciente
        const patientData = await getPatientIdByCode(data.patient_id);
        if (!patientData) {
            throw new Error(`No se encontró el paciente con código: ${data.patient_id}`);
        }

        // 2. Buscamos el usuario (EL CULPABLE)
        const userData = await getUserIdByCode(data.id_report);
        if (!userData) {
            // Si llega aquí, es que data.id_report no existe en la tabla de usuarios
            throw new Error(`No se encontró el usuario reportador con código: ${data.id_report}`);
        }

        // 3. Si ambos existen, asignamos los IDs internos
        data.patient_id = patientData.id;
        data.id_report = userData.id;

        const newKnownIssueGenerate = await createKnownIssueGenerate(data);
        const knownIssueGenerateId = newKnownIssueGenerate.id;

        const createImplicatedPromises = data.agents.map(agentId =>
            createKnownIssueGenerateImplicated(knownIssueGenerateId, agentId)
        );

        await Promise.all(createImplicatedPromises);

        return { message: "Alerta manual creada" };

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error; // Re-lanzamos para que el router mande el 500 pero con el log claro
    }
}

async function saveInterventionGenerate(data) {
    try {

        const patientData = await getPatientIdByCode(data.patient);

        const userData = await getUserIdByCode(data.user);

        data.patient = patientData.id;

        data.user = userData.id;

        await createIntervention(data);

        return {
            message: "Intervención creada"
        };

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}


async function getOptionsAlertsIntervention(data) {
    try {

        const resp = getCombinedAlerts(data.uuid);

        return resp;

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}

async function getAgentRiskIntervention(data) {
    try {

        if (data.source === 'known_issue_generate') {

            const resp = await getCodeKnownIssueGenerate(data.uuid);

            const agents = await getMedicationsFromKnownIssueGenerate(resp.id);

            return agents;

        } else {

            const resp = await getCodeDetectedIssue(data.uuid);

            let agents

            if (!resp.group_detected) {
                agents = await getMedicationsFromDetectedIssue(resp.id);
            } else {
                agents = await getMedicationsFromDetectedIssueAndKnowIssue(resp.id);
            }

            return agents;

        }

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}

async function getInterventions(data) {
    try {

        const userData = await getPatientIdByCode(data.uuid);

        const resp = await getInterventionData(userData.id);

        return resp;

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}


async function getInterventionsAlertData(data) {
    try {


        const resp = await getInterventionByCode(data.uuid);

        return resp;

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}



async function fetchAllOptions() {
    try {
        const [processStageOptions, interveneOptions, actionFrameworkOptions, statusAlert] = await Promise.all([
            getProcessStageOptions(),
            getInterveneOptions(),
            getActionFrameworkOptions(),
            optionStatusAlert()
        ]);

        return {
            processStage: processStageOptions,
            intervene: interveneOptions,
            actionFramework: actionFrameworkOptions,
            status: statusAlert
        };

    } catch (error) {
        console.error('Error origin from controller -> ', error);
        throw error;
    }
}

function inferUnit(param) {
    const map = {
        creatinine: "mg/dL",
        glucose_level: "mg/dL",
        INR: "",
        PT: "sec",
        AST: "U/L",
        ALT: "U/L",
        body_temperature: "°C",
        current_weight: "kg",
        usual_weight: "kg",
        size: "m",
        heart_rate: "bpm",
        respiratory_rate: "rpm",
        blood_pressure: "mmHg",
        pain: ""
    };

    return map[param] || "";
}

function inferCategory(param) {
    const map = {
        creatinine: "LAB_CHEMISTRY",
        glucose_level: "LAB_CHEMISTRY",
        INR: "COAGULATION",
        PT: "COAGULATION",
        AST: "HEPATIC",
        ALT: "HEPATIC",
        body_temperature: "VITALS",
        heart_rate: "VITALS",
        respiratory_rate: "VITALS",
        blood_pressure: "VITALS",
        pain: "ASSESSMENT",
        current_weight: "VITALS",
        usual_weight: "VITALS",
        size: "VITALS"
    };

    return map[param] || "UNKNOWN";
}

const excelDateToJS = (serial) => {
    if (!serial || isNaN(serial)) return new Date();
    if (serial instanceof Date) return serial;

    // Convertimos el serial de Excel a milisegundos
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const date = new Date(ms);

    // Forzamos a que la fecha se trate como local agregando el offset inverso
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date;
};

const parseDateStrict = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    // Si es un número de Excel (serial)
    if (typeof dateStr === 'number') {
        const date = excelDateToJS(dateStr);
        return date.toISOString().split('T')[0];
    }

    // Si ya es un objeto Date
    if (dateStr instanceof Date) {
        return dateStr.toISOString().split('T')[0];
    }

    // Si es un string (ej: "2020-02-01" o "2020/02/01")
    const cleanStr = String(dateStr).split('T')[0].trim().replace(/\//g, '-');
    return cleanStr; // Retorna "2020-02-01"
};
/**
 * Extrae el código CIE-10 puro (ej: C921)
 */
const extractCIE10 = (str) => {
    if (!str) return null;
    const match = String(str).match(/[A-Z][0-9]{2,3}[A-Z0-9]?/i);
    return match ? match[0].toUpperCase() : null;
};

const cleanCode = (raw) => raw ? raw.split(/[\s;-]/)[0].trim() : null;

export const ingestExcelData = async (payload) => {
    const { data } = payload;
    const t = await sequelize.transaction();
    const patientsToAnalyze = [];

    if (data?.length > 0) {
        console.log("📝 Ejemplo de la primera fila:", JSON.stringify(data[0], null, 2));
    }

    try {

        for (const [index, fila] of data.entries()) {

            // 1. PACIENTE
            const [patientObj] = await Patient.upsert({
                t_identification: String(fila.csv || 'CC'),
                identification: String(fila.identification),
                first_name: fila.first_name || 'PACIENTE',
                last_name: fila.last_name || 'IMPORTADO',
                birth_date: excelDateToJS(fila.birth_date),
                gender_id: fila.sex === 'M' ? 1 : 2
            }, { transaction: t });



            // 2. LABORATORIOS (DEBUG REAL)
            if (fila.laboratorios && Array.isArray(fila.laboratorios)) {

                console.log(`🧪 Labs encontrados: ${fila.laboratorios.length}`);

                for (const [labIndex, lab] of fila.laboratorios.entries()) {

                    console.log(`\n🧪 LAB #${labIndex + 1}`);
                    console.log("📅 Fecha:", lab.report_date);
                    console.log("⚖️ Peso:", lab.current_weight);
                    console.log("📏 Talla:", lab.size);
                    console.log("🧪 Creatinina:", lab.creatinine);

                }

            } else {
                console.log("⚠️ Sin laboratorios");
            }

            // ===============================
            // 🧠 CONSTRUCCIÓN DINÁMICA DE PARAMS
            // ===============================
            const loadParamsUnit = {};
            const loadParamsCategory = {};

            if (fila.laboratorios && Array.isArray(fila.laboratorios)) {

                for (const lab of fila.laboratorios) {

                    for (const key in lab) {

                        // 🚫 ignorar metadata
                        if (
                            key.endsWith("_date") ||
                            key === "id_patient" ||
                            key === "report_date"
                        ) continue;

                        const unitKey = key + "_unit";
                        const categoryKey = key + "_category";

                        // 📦 unidades dinámicas
                        loadParamsUnit[unitKey] =
                            lab[unitKey] || inferUnit(key);

                        // 📦 categorías dinámicas
                        loadParamsCategory[categoryKey] =
                            inferCategory(key);
                    }
                }
            }

            // 4. MEDICAL SERVICE
            const [medService] = await MedicalService.findOrCreate({
                where: { history_clinic: String(fila.id_history_clinic) },
                defaults: {
                    patient_id: patientObj.id,
                    status: 'active'
                },
                transaction: t
            });

            console.log("🏥 MedicalService OK:", medService?.id);

            // 5. EPISODIO
            const [episode, created] = await EpisodeOfCare.findOrCreate({
                where: { code_episode: String(fila.episode) },
                defaults: {
                    bed: fila.bed || 'SIN ASIGNAR',
                    name_doctor: fila.doctor_name || 'MÉDICO GENERAL',
                    medical_center: fila.medical_center || 'CENTRO PRINCIPAL',
                    period_start: excelDateToJS(fila.date_of_entry) || new Date(),
                    medical_service_id: medService.id,
                    specialty_id: (fila.specialty && !isNaN(parseInt(fila.specialty))) ? parseInt(fila.specialty) : 20,
                    status_id: 1,
                    service_provider_id: 1,
                    primary_diagnosis: fila.p_diagnostic,
                    secondary_diagnosis: fila.s_diagnostic
                },
                transaction: t
            });

            if (!created) {
                await episode.update({
                    bed: fila.bed || episode.bed,
                    name_doctor: fila.doctor_name || episode.name_doctor,
                    medical_center: fila.medical_center || episode.medical_center,
                    medical_service_id: medService.id,
                    primary_diagnosis: fila.p_diagnostic,
                    secondary_diagnosis: fila.s_diagnostic,
                    period_start: excelDateToJS(fila.date_of_entry)
                }, { transaction: t });
            }

            // ... (código anterior de identificación, labs, medical service, episode)

            console.log("📌 Episode OK:", episode.id);

            // ==========================================================
            // 4. 🔥 PARACLINICAL FLOW (CORREGIDO CON TRANSACCIÓN)
            // ==========================================================
            if (fila.laboratorios && Array.isArray(fila.laboratorios)) {
                // Dentro de ingestExcelData, antes de createFlowParaclinical:
                const rawLabDate = fila.laboratorios[0]?.report_date;
                const fechaUnicaParaEstaFila = (typeof rawLabDate === 'number')
                    ? excelDateToJS(rawLabDate)
                    : parseDateStrict(rawLabDate);

                await createFlowParaclinical({
                    paraclinicalData: [{
                        identification: fila.identification,
                        episode: episode.id,
                        laboratorios: fila.laboratorios.map(lab => ({
                            ...lab,
                            report_date: fechaUnicaParaEstaFila
                        }))
                    }],
                    status: { code: "default" }
                }, t);
            }

            // ==========================================================
            // 5. 🧠 PROCESAMIENTO DE DIAGNÓSTICOS (FIX: diagMap defined)
            // ==========================================================

            // CRÍTICO: Declaramos diagMap AQUÍ, dentro del loop de la fila, 
            // para que sea accesible por processDiagnosticString y se limpie por paciente.

            const diagMap = [];

            const processDiagnosticString = (rawString, rank) => {
                if (!rawString) return;

                console.log(`\n--- 🔍 PROCESANDO ${rank} ---`);

                // 1. EL TRUCO: Split usando Regex que busca el guion con espacios opcionales 
                // pero asegurándonos de que solo divida en los separadores de bloques.
                // Usamos un separador más específico o limitamos los cortes.
                const blocks = String(rawString).split(/\s+-\s+/).map(b => b.trim());

                // Si el Excel no tiene espacios (C921-2020...), intentamos un split inteligente
                // que no rompa las fechas:
                if (blocks.length < 2) {
                    // Buscamos guiones que NO tengan números a ambos lados (esto respeta 2020-01-01)
                    // pero lo más seguro es usar espacios en el Excel: "C921 - 2020-01-01 - Confirmado"
                }

                console.log(`📦 BLOQUES REALES:`, blocks);

                const codesList = blocks[0] ? blocks[0].split(';').map(c => c.trim()) : [];
                const datesList = blocks[1] ? blocks[1].split(';').map(d => d.trim()) : [];
                const statesList = blocks[2] ? blocks[2].split(';').map(s => s.trim()) : [];

                codesList.forEach((codePart, index) => {
                    const cleanCodeStr = extractCIE10(codePart);

                    if (cleanCodeStr) {
                        // Ahora sí, la fecha vendrá completa "2020-02-01"
                        const rawDate = datesList[index] || null;
                        const rawState = statesList[index] || 'Importado';

                        console.log(`🔹 Match: ${cleanCodeStr} | Fecha: ${rawDate} | Estado: ${rawState}`);

                        diagMap.push({
                            code: cleanCodeStr,
                            rank: rank,
                            date: parseDateStrict(rawDate),
                            obs: rawState
                        });
                    }
                });
            };

            // Ejecutamos para ambos campos
            processDiagnosticString(fila.p_diagnostic, 'PRIMARY');
            processDiagnosticString(fila.s_diagnostic, 'SECONDARY');

            // Log final antes de DB
            console.log(`🚀 TOTAL DIAGNÓSTICOS A GUARDAR PARA ESTE PACIENTE: ${diagMap.length}`);

            // GUARDADO EN BASE DE DATOS
            for (const item of diagMap) {
                const dbCode = await DiagnosisCode.findOne({
                    where: { code: item.code },
                    transaction: t
                });

                if (dbCode) {
                    // TRUCO: Formateamos a string YYYY-MM-DD para que la DB no toque la zona horaria
                    // Dentro del loop for (const item of diagMap)
                    const dateToSave = item.date;

                    console.log(`💾 Guardando en DB -> Código: ${item.code} | Fecha: ${dateToSave}`);

                    await ReportDiagnosis.upsert({
                        medical_service_id: medService.id,
                        diagnosis_code_id: dbCode.id,
                        rank_report: item.rank,
                        date_report: dateToSave, // String literal YYYY-MM-DD
                        observations: item.obs
                    }, { transaction: t });
                } else {
                    console.warn(`❌ DB -> El código [${item.code}] no existe en la tabla DiagnosisCode.`);
                }
            }

            const diagnosticsList = diagMap.map(d => d.code);

            // 4. ALERGIAS
            const tieneAlergia = fila.description_allergies && fila.description_allergies.trim().length > 0;
            const observacionAlergia = tieneAlergia ? fila.description_allergies.trim() : "EL PACIENTE NO REFIERE ALERGIAS";

            await Allergy.create({
                medical_service_id: medService.id, // <--- CAMBIADO: Antes decía medicalServiceObj
                observation: observacionAlergia,
                code: fila.id_allergies || (tieneAlergia ? 'AL-SPEC' : 'AL-NEG')
            }, { transaction: t });



            // ==========================================================
            // 7. 🔥 FLUJO DE MEDICAMENTOS Y 💧 HIDRATACIÓN AUXILIAR
            // ==========================================================
            if (fila.prescripciones && Array.isArray(fila.prescripciones)) {

                const prescripcionesLimpias = fila.prescripciones.map(p => {
                    const vFrec = p.frecuency || p.frequency;
                    return {
                        ...p,
                        frecuency: (vFrec === "N/A" || !vFrec) ? "1" : String(vFrec),
                        date_start: (p.date_start === "Sin fecha" || !p.date_start) ? null : p.date_start,
                        date_end: (p.date_end === "Indefinida" || !p.date_end) ? null : p.date_end,
                    };
                });

                console.log(`🚀 Enviando ${prescripcionesLimpias.length} medicamentos del paciente ${fila.identification}`);

                await createFlowMedication({
                    data: [{
                        identification: fila.identification,
                        episode: episode.id,
                        prescripciones: prescripcionesLimpias
                    }],
                    status: 'Activo'
                }, t);

                console.log(`[Hidratación] Llenando campos null para el episodio ${episode.id}...`);

                await sequelize.query(`
                    UPDATE medication_request_auxiliar mra
                    SET medication_id = m.id
                    FROM medication m
                    WHERE mra.medication_code = m.code
                      AND mra.episode_id = :episodeId
                      AND mra.medication_id IS NULL
                `, { replacements: { episodeId: String(episode.id) }, transaction: t });

                await sequelize.query(`
                    UPDATE medication_request_auxiliar
                    SET episode_of_care_id = CAST(episode_id AS INTEGER)
                    WHERE episode_id = :episodeId
                      AND episode_of_care_id IS NULL
                `, { replacements: { episodeId: String(episode.id) }, transaction: t });

                await sequelize.query(`
                    UPDATE medication_request_auxiliar
                    SET status_id = CASE WHEN status ILIKE '%Activo%' THEN 1 ELSE 2 END
                    WHERE episode_id = :episodeId
                      AND status_id IS NULL
                `, { replacements: { episodeId: String(episode.id) }, transaction: t });
                
                console.log(`[Hidratación] Generando UUIDs únicos para medicamentos del episodio ${episode.id}...`);
                await sequelize.query(`
                    UPDATE medication_request_auxiliar
                    SET uuid = gen_random_uuid()
                    WHERE episode_id = :episodeId
                      AND (uuid IS NULL OR uuid = '')
                `, { replacements: { episodeId: String(episode.id) }, transaction: t });

                console.log(`✅ [Hidratación] Completada con éxito.`);
            } // Cierre IF prescripciones

            // 🛒 2. AGREGAMOS ESTE PACIENTE AL CARRITO DE ALERTAS
            patientsToAnalyze.push({
                episodeId: episode.id,
                medicalServiceId: medService.id,
                patientId: patientObj.id,
                diagnosticsList: diagnosticsList
            });

        } // 🔥 AQUÍ TERMINA EL CICLO FOR QUE RECORRE TODO EL EXCEL 🔥

        // ==========================================================
        // 9. COMMIT MASIVO Y DETECCIÓN DE RIESGOS POST-COMMIT
        // ==========================================================

        // 1. Un solo Commit para guardar TODOS los pacientes en la DB
        await t.commit();
        console.log("✅ COMMIT REALIZADO PARA TODOS LOS DATOS");

        // 2. Pausa técnica para refresco de índices
        await new Promise(resolve => setTimeout(resolve, 500));

        // 3. 🚨 Recorremos el carrito y disparamos las alertas para todos
        console.log(`🔍 Iniciando análisis de riesgos para ${patientsToAnalyze.length} pacientes...`);
        for (const p of patientsToAnalyze) {
            // Esto se ejecuta en segundo plano sin detener la respuesta
            automateRiskDetection(p.episodeId, p.medicalServiceId, p.patientId, p.diagnosticsList)
                .catch(err => console.error(`❌ Error en detección de paciente ${p.patientId}:`, err));
        }

        // 4. Respuesta inmediata al Front
        return {
            success: true,
            message: `Excel procesado correctamente. ${patientsToAnalyze.length} pacientes registrados y analizados.`
        };

    } catch (error) {
        if (t) await t.rollback();
        console.error("\n====== 🚨 ERROR FATAL EN INGESTA EXCEL 🚨 ======");
        console.error(error);
        console.error("================================================\n");
        throw error;
    }
};

async function automateRiskBackground(data) {
    try {
        for (const fila of data) {
            const ep = await EpisodeOfCare.findOne({ where: { code_episode: String(fila.episode) } });
            if (ep) {
                // SACAR LOS DIAGNÓSTICOS REALES DE LA TABLA ReportDiagnosis
                const reportDiags = await ReportDiagnosis.findAll({
                    where: { medical_service_id: ep.medical_service_id },
                    include: [DiagnosisCode]
                });

                const diagList = reportDiags.map(rd => rd.DiagnosisCode.code);

                // Ahora sí, ejecutamos con la lista real
                await automateRiskDetection(ep.id, ep.medical_service_id, ep.patient_id, diagList);
            }
        }
    } catch (e) {
        console.error("❌ Error en background:", e);
    }
}

async function automateRiskDetection(episodeId, medicalServiceId, patientId, diagnosticsList = []) {

    const today = new Date().toISOString().split('T')[0];
    console.log(`--- Iniciando detección para Paciente: ${patientId}, Episodio: ${episodeId} ---`);
    console.log(`Fecha de evaluación (Vigencia): ${today}`);
    console.log(`CIE-10 a analizar: ${diagnosticsList.join(', ')}`);

    const dateFilter = `
            AND (
                :today::date >= TO_DATE(NULLIF(TRIM(mr.date_start), ''), 'DD/MM/YYYY')
                AND :today::date <= TO_DATE(NULLIF(TRIM(mr.date_end), ''), 'DD/MM/YYYY')
            )`;
    try {
        // 1. DUPLICIDADES
        const duplicities = await sequelize.query(`
            SELECT SUBSTRING(a.code, 1, 5) AS atc_nivel4,
                   ARRAY_AGG(m.id) as med_ids,
                   STRING_AGG(COALESCE(ai.display, m.code), ' + ') as nombres
            FROM "medication_request_auxiliar" mr
            JOIN medication m ON mr.medication_id = m.id
            JOIN medication_atc ma ON m.id = ma.medication_id
            JOIN atc a ON ma.atc_id = a.id
            LEFT JOIN atc_i18n ai ON a.id = ai.atc_id AND ai.language_id = 2
            WHERE mr.episode_of_care_id = :episodeId 
              AND mr.status_id = 1
              ${dateFilter} 
            GROUP BY SUBSTRING(a.code, 1, 5)
            HAVING COUNT(*) > 1
        `, { replacements: { episodeId, today }, type: QueryTypes.SELECT });

        // 2. ALERGIAS - OK
        const allergies = await sequelize.query(`
            SELECT m.id as med_id, al.observation, COALESCE(ai.display, m.code) as nombre
            FROM "medication_request_auxiliar" mr
            JOIN "allergies" al ON mr.medication_id = al.medication_id
            JOIN medication m ON m.id = al.medication_id
            LEFT JOIN medication_atc ma ON m.id = ma.medication_id
            LEFT JOIN atc a ON ma.atc_id = a.id
            LEFT JOIN atc_i18n ai ON a.id = ai.atc_id AND ai.language_id = 2
            WHERE mr.episode_of_care_id = :episodeId 
              AND al.medical_service_id = :medicalServiceId
              AND mr.status_id = 1
              ${dateFilter}
        `, { replacements: { episodeId, medicalServiceId, today }, type: QueryTypes.SELECT });

        // 3. INTERACCIONES - ACTUALIZADO CON TU FILTRO GANADOR
        const interactions = await sequelize.query(`
            SELECT mi.warning_message, COALESCE(ai1.display, m1.code) as nombre_med1, COALESCE(ai2.display, m2.code) as nombre_med2
            FROM "medication_request_auxiliar" mr1
            JOIN "medication_request_auxiliar" mr2 ON mr1.episode_of_care_id = mr2.episode_of_care_id AND mr1.id < mr2.id
            JOIN medication m1 ON mr1.medication_id = m1.id
            JOIN medication m2 ON mr2.medication_id = m2.id
            JOIN medication_atc ma1 ON m1.id = ma1.medication_id
            JOIN medication_atc ma2 ON m2.id = ma2.medication_id
            JOIN atc a1 ON ma1.atc_id = a1.id
            JOIN atc a2 ON ma2.atc_id = a2.id
            JOIN medical_interactions mi ON 
                (a1.code LIKE mi.atc_code_1 || '%' AND a2.code LIKE mi.atc_code_2 || '%') OR
                (a2.code LIKE mi.atc_code_1 || '%' AND a1.code LIKE mi.atc_code_2 || '%')
            LEFT JOIN atc_i18n ai1 ON a1.id = ai1.atc_id AND ai1.language_id = 2
            LEFT JOIN atc_i18n ai2 ON a2.id = ai2.atc_id AND ai2.language_id = 2
            WHERE mr1.episode_of_care_id = :episodeId 
              AND mr1.status_id = 1 AND mr2.status_id = 1
              -- Aplicamos tu lógica de TO_DATE a ambos medicamentos (mr1 y mr2)
              AND (:today::date >= TO_DATE(NULLIF(TRIM(mr1.date_start), ''), 'DD/MM/YYYY') AND :today::date <= TO_DATE(NULLIF(TRIM(mr1.date_end), ''), 'DD/MM/YYYY'))
              AND (:today::date >= TO_DATE(NULLIF(TRIM(mr2.date_start), ''), 'DD/MM/YYYY') AND :today::date <= TO_DATE(NULLIF(TRIM(mr2.date_end), ''), 'DD/MM/YYYY'))
        `, { replacements: { episodeId, today }, type: QueryTypes.SELECT });

        // 4. DOSIFICACIÓN - OK
        const dosageAlerts = await sequelize.query(`
            SELECT COALESCE(ai.display, m.code) as nombre_med
            FROM "medication_request_auxiliar" mr
            JOIN medication m ON mr.medication_id = m.id
            JOIN medication_atc ma ON m.id = ma.medication_id
            JOIN atc a ON ma.atc_id = a.id
            JOIN dosage_guidelines ad ON a.code = ad.atc_code 
            LEFT JOIN atc_i18n ai ON a.id = ai.atc_id AND ai.language_id = 2
            WHERE mr.episode_of_care_id = :episodeId 
              AND mr.status_id = 1
              ${dateFilter}
        `, { replacements: { episodeId, today }, type: QueryTypes.SELECT });

        // 5. TOXICIDAD (Renal y Hepática) - OK
        const hasRenalRisk = diagnosticsList.some(code => code.startsWith('N17') || code.startsWith('N18') || code.startsWith('N19'));
        const hasHepaticRisk = diagnosticsList.some(code => code.startsWith('K72'));

        if (hasRenalRisk) {
            const renalAlerts = await sequelize.query(`
                SELECT DISTINCT COALESCE(ai.display, m.code) as nombre_med
                FROM "medication_request_auxiliar" mr
                JOIN medication m ON mr.medication_id = m.id
                JOIN medication_atc ma ON m.id = ma.medication_id
                JOIN atc a ON ma.atc_id = a.id
                JOIN renal_impairment_adjustments ra ON a.code = ra.atc_code
                LEFT JOIN atc_i18n ai ON a.id = ai.atc_id AND ai.language_id = 2
                WHERE mr.episode_of_care_id = :episodeId AND mr.status_id = 1
                ${dateFilter}
            `, { replacements: { episodeId, today }, type: QueryTypes.SELECT });

            for (const a of renalAlerts) {
                await insertIssue(patientId, `Toxicidad Renal: El medicamento ${a.nombre_med} requiere ajuste por falla renal del paciente.`, 4);
            }
        }

        if (hasHepaticRisk) {
            const hepaticAlerts = await sequelize.query(`
                SELECT DISTINCT COALESCE(ai.display, m.code) as nombre_med
                FROM "medication_request_auxiliar" mr
                JOIN medication m ON mr.medication_id = m.id
                JOIN medication_atc ma ON m.id = ma.medication_id
                JOIN atc a ON ma.atc_id = a.id
                JOIN hepatic_impairment_adjustments ha ON a.code = ha.atc_code
                LEFT JOIN atc_i18n ai ON a.id = ai.atc_id AND ai.language_id = 2
                WHERE mr.episode_of_care_id = :episodeId AND mr.status_id = 1
                ${dateFilter}
            `, { replacements: { episodeId, today }, type: QueryTypes.SELECT });
        }

        for (const dup of duplicities) {
            await insertIssue(patientId, `Duplicidad (Grupo ${dup.atc_nivel4}): ${dup.nombres}`, 2);
        }

        for (const ale of allergies) {
            await insertIssue(patientId, `Alergia detectada: El paciente es alérgico a ${ale.nombre}. (${ale.observation})`, 3);
        }

        for (const inter of interactions) {
            await insertIssue(patientId, `Interacción: ${inter.nombre_med1} + ${inter.nombre_med2}. ${inter.warning_message}`, 1);
        }

        for (const dose of dosageAlerts) {
            await insertIssue(patientId, `Alerta de Dosificación: El medicamento ${dose.nombre_med} requiere ajuste.`, 5);
        }

        console.log(`--- Proceso finalizado para Paciente: ${patientId} ---`);

    } catch (error) {
        console.error(`❌ Error en detección de paciente ${patientId}:`, error);
    }
}

// Función auxiliar
async function insertIssue(patientId, warning, typeId) {
    await sequelize.query(`
        INSERT INTO known_issue_generate 
        (patient_id, warning, date_report, type_id, status_id, created_at, updated_at, uuid)
        VALUES (:patientId, :warning, NOW(), :typeId, 1, NOW(), NOW(), gen_random_uuid())
    `, { replacements: { patientId, warning, typeId } });
}


export {
    getAlertsPatient,
    getOptionsAlert,
    saveAlertGenerate,
    getOptionsAlertsIntervention,
    getAgentRiskIntervention,
    fetchAllOptions,
    saveInterventionGenerate,
    getInterventions,
    getAlertByIntervention,
    getInterventionsAlertData
};