import { number } from "zod";
import { convert, generateDateNow, getAge, roundToTwoDigits } from "../helpers/helpers.js";
import {
    createParaclinicalFromDataHospital,
    getCategoryObservation,
    getCodeObservation,
    getDataParaclinical,
    getStatusObservation,
    verifyCodeParaclinical
} from "../models/paraclinicalModels.js";
import {
    getPatientByEpisode,
    getRecentEpisodeByIdentificationPatient
} from "../models/patientsModels.js";

/**
 * MAPEO DE PARÁMETROS -> code_id
 */
const MAPA_PARAMETROS = {
    size: 1,
    current_weight: 2,
    usual_weight: 3,
    body_temperature: 4,
    blood_pressure: 5,
    heart_rate: 6,
    respiratory_rate: 7,
    pain: 8,
    glucose_level: 9,
    INR: 10,
    PT: 11,
    AST: 12,
    ALT: 13,
    creatinine: 14
};

/**
 * UNIDADES
 */
const UNIT_MAP = {
    size: 'm',
    current_weight: 'kg',
    usual_weight: 'kg',
    body_temperature: '°C',
    blood_pressure: 'mmHg',
    heart_rate: 'bpm',
    respiratory_rate: 'rpm',
    pain: 'scale',
    glucose_level: 'mg/dL',
    INR: '',
    PT: 'sec',
    AST: 'U/L',
    ALT: 'U/L',
    creatinine: 'mg/dL'
};

/**
 * =========================
 * INGESTA PARACLINICOS
 * =========================
/**
 * =========================
 * INGESTA PARACLINICOS (CORREGIDA)
 * =========================
 */

export async function createFlowParaclinical(loadData, t = null) { // <--- Agregamos 't'
    try {
        const results = { success: 0, errors: [] };
        let status = null;

        if (loadData?.status?.code) {
            status = await getStatusObservation(loadData.status.code);
        }

        const statusId = status?.id ?? 1;

        for (const [index, fila] of loadData.paraclinicalData.entries()) {
            try {
                console.log(`\n==============================`);
                console.log(`👤 Fila ${index + 1} - ${fila.identification}`);
                console.log(`==============================`);

                // 🔥 CRUCIAL: Si ya pasamos el 'episode' desde la ingesta, lo usamos.
                // Si no, lo buscamos (pero en la primera subida vendrá por parámetro).
                let episodeId = fila.episode;

                if (!episodeId) {
                    const episodeDb = await getRecentEpisodeByIdentificationPatient(fila.identification);
                    episodeId = episodeDb?.id;
                }

                if (!episodeId) {
                    results.errors.push(`Fila ${index + 1}: Paciente ${fila.identification} sin episodio.`);
                    continue;
                }

                console.log(`📌 Usando Episode ID: ${episodeId}`);

                if (!Array.isArray(fila.laboratorios)) continue;

                for (const labData of fila.laboratorios) {
                    for (let param in labData) {

                        if (
                            param.endsWith('_date') ||
                            param === 'id_patient' ||
                            param === 'report_date'
                        ) continue;

                        const rawValue = labData[param];

                        if (
                            rawValue === undefined ||
                            rawValue === null ||
                            rawValue === '' ||
                            rawValue === '-' ||
                            rawValue === ' '
                        ) continue;

                        let cleanValue;

                        // 🔥 EXCEPCIÓN: La presión arterial es un string (ej. "110/70"), no lo convertimos a número
                        if (param === 'blood_pressure') {
                            cleanValue = String(rawValue).trim();
                        } else {
                            cleanValue = Number(String(rawValue).trim().replace(',', '.'));
                            // Si no es un número válido, ignoramos este parámetro
                            if (!Number.isFinite(cleanValue)) continue;
                        }

                        const date =
                            labData[param + '_date'] ||
                            labData.report_date ||
                            new Date();

                        const codeId = MAPA_PARAMETROS[param];

                        if (!codeId) {
                            console.log(`❌ Param no mapeado: ${param}`);
                            continue;
                        }

                        const structData = {
                            episode: episodeId, // <--- Usamos el ID verificado
                            status: statusId,
                            category: 1,
                            code: codeId,
                            value: cleanValue,
                            unit: UNIT_MAP[param] ?? '',
                            date
                        };

                        // 🔥 PASAMOS LA TRANSACCIÓN 't' AL MODELO
                        await createParaclinicalFromDataHospital(structData, t);

                        console.log(`✅ Guardado: ${param} = ${cleanValue}`);
                    }
                }

                results.success++;

            } catch (rowError) {
                console.error(`❌ Error en fila ${index + 1}:`, rowError);
                results.errors.push(`Fila ${index + 1}: ${rowError.message}`);
            }
        }

        console.log(`\n🎉 RESUMEN FINAL:`);
        console.log(`✔ Success: ${results.success}`);
        console.log(`❌ Errors: ${results.errors.length}`);

        return results;

    } catch (error) {
        console.error('❌ Error crítico en createFlowParaclinical:', error);
        throw error;
    }
}

/**
 * =========================
 * GET FRONT DATA (FIX IMPORTANTE)
 * =========================
 */
export async function dataParaclinical(idEpisode) {
    try {
        const sizeRegister = 3;

        const [dataPatient, dataParaclinical] = await Promise.all([
            getPatientByEpisode(idEpisode),
            getDataParaclinical(idEpisode, sizeRegister)
        ]);

        if (!dataParaclinical || dataParaclinical.length === 0) return [];

        // 🔥 MAPEO INVERSO COMPLETO: Relaciona el ID de la DB con el nombre del objeto
        const idToName = {
            1: 'size',
            2: 'current_weight',
            3: 'usual_weight',
            4: 'body_temperature',
            5: 'blood_pressure',
            6: 'heart_rate',
            7: 'respiratory_rate',
            8: 'pain',
            9: 'glucose_level',
            10: 'INR',
            11: 'PT',
            12: 'AST',
            13: 'ALT',
            14: 'creatinine'
        };

        const params = Object.values(idToName);

        /**
         * 1. Agrupación por parámetro
         */
        const dataMap = dataParaclinical.reduce((acc, item) => {
            // Intentamos sacar el nombre del parámetro de varias formas para no fallar
            const param = idToName[item.code_id] || item.code_param || item.name;

            if (param) {
                if (!acc[param]) acc[param] = [];
                acc[param].push({
                    value: item.value_as_number || item.value || 0, // Verifica cómo se llama en tu query
                    unit: item.unit_param || item.unit || '',
                    issued: item.effective_datetime || item.date_param || ''
                });
            }
            return acc;
        }, {});

        console.log("📊 Data cruda de la DB:", dataParaclinical.length, "registros");
        console.log("🗺️ Mapa agrupado:", Object.keys(dataMap));

        /**
         * 2. Determinamos cuántas columnas/filas mostrar
         */
        const valMax = Math.max(
            ...Object.values(dataMap).map(arr => arr.length),
            1
        );

        const results = [];

        for (let i = 0; i < valMax; i++) {
            const entry = {};

            for (let param of params) {
                const record = dataMap[param]?.[i];

                entry[param] = record
                    ? {
                        value_param: record.value,
                        unit_param: record.unit || '',
                        date_param: record.issued || ''
                    }
                    : { value_param: 0, unit_param: '', date_param: '' };
            }

            // 3. Mapeo final para el componente Paraclinical.tsx
            // DENTRO DEL BACKEND (dataParaclinical)
            results.push({
                // Usamos un operador ternario para que si no hay valor, devuelva "0" o vacío, no "undefined"
                currentWeight: entry.current_weight.value_param ? `${entry.current_weight.value_param} ${entry.current_weight.unit_param}`.trim() : "0",
                currentWeight_date: entry.current_weight.date_param || "",

                usualWeight: entry.usual_weight.value_param ? `${entry.usual_weight.value_param} ${entry.usual_weight.unit_param}`.trim() : "0",
                usual_weight_date: entry.usual_weight.date_param || "",

                size: entry.size.value_param ? `${entry.size.value_param} ${entry.size.unit_param}`.trim() : "0",
                size_date: entry.size.date_param || "",

                bodyTemperature: entry.body_temperature.value_param ? `${entry.body_temperature.value_param} ${entry.body_temperature.unit_param}`.trim() : "0",
                bodyTemperature_date: entry.body_temperature.date_param || "",

                bloodPressure: entry.blood_pressure.value_param ? `${entry.blood_pressure.value_param} ${entry.blood_pressure.unit_param}`.trim() : "0",
                bloodPressure_date: entry.blood_pressure.date_param || "",

                heartRate: entry.heart_rate.value_param ? `${entry.heart_rate.value_param} ${entry.heart_rate.unit_param}`.trim() : "0",
                heartRate_date: entry.heart_rate.date_param || "",

                respiratoryRate: entry.respiratory_rate.value_param ? `${entry.respiratory_rate.value_param} ${entry.respiratory_rate.unit_param}`.trim() : "0",
                respiratoryRate_date: entry.respiratory_rate.date_param || "",

                pain: entry.pain.value_param || 0,

                glucose: entry.glucose_level.value_param ? `${entry.glucose_level.value_param} ${entry.glucose_level.unit_param}`.trim() : "0",
                glucose_date: entry.glucose_level.date_param || "",

                creatinine: entry.creatinine.value_param ? `${entry.creatinine.value_param} ${entry.creatinine.unit_param}`.trim() : "0",
                creatinine_date: entry.creatinine.date_param || "",

                imc: entry.size.value_param > 0 && entry.current_weight.value_param > 0
                    ? (entry.current_weight.value_param / Math.pow(entry.size.value_param / 100, 2)).toFixed(2)
                    : 'N/A',

                INR: entry.INR.value_param ? `${entry.INR.value_param} ${entry.INR.unit_param}`.trim() : "0",
                INR_date: entry.INR.date_param || "",

                PT: entry.PT.value_param ? `${entry.PT.value_param} ${entry.PT.unit_param}`.trim() : "0",
                PT_date: entry.PT.date_param || "",

                AST: entry.AST.value_param ? `${entry.AST.value_param} ${entry.AST.unit_param}`.trim() : "0",
                AST_date: entry.AST.date_param || "",

                ALT: entry.ALT.value_param ? `${entry.ALT.value_param} ${entry.ALT.unit_param}`.trim() : "0",
                ALT_date: entry.ALT.date_param || "",
            });
        }

        return results;

    } catch (error) {
        console.error('❌ Error en dataParaclinical:', error);
        throw error;
    }
}

/**
 * =========================
 * UUID
 * =========================
 */
export async function generateUniqueUUID() {
    let obsWithUUID;
    let uuid;

    do {
        uuid = crypto.randomUUID();
        obsWithUUID = await verifyCodeParaclinical(uuid);
    } while (obsWithUUID);

    return uuid;
}