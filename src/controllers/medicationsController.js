import { countPrescriptionPatient, getMedicationNameByAtcCode, countUnidentiMedication, createOrUpdateAmountMedication, createPrescriptionFromDataHospital, getAllActivePrescription, getCodeMedicationRequestByCode, getDataMedicationWithPotency, getIdStatusByCode, getMedicationByIdentification, getMedicationUniqueByEpisode, getMedicationUniqueOptions, getPrescriptionsByEpisode, getPrescriptionsByEpisodeWithFilters } from "../models/medicationsModel.js";
import { getEpisodeOfcareByUuid, getRecentEpisodeByIdentificationPatient } from "../models/patientsModels.js";
import { buildFilters, calculatePagination } from "../helpers/helpers.js";
import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";

export async function createFlowMedication(loadData) {
    try {
        // Función interna para convertir el número de Excel a String DD/MM/YYYY
        const excelToDate = (serial) => {
            if (!serial || isNaN(serial)) return serial; // Si ya es string, lo deja quieto
            const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
            return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        };

        const allPrescriptions = loadData.data.flatMap(patient => {
            return (patient.prescripciones || []).map(presc => {

                // 1. Convertimos los números de Excel a fechas legibles
                let dStart = excelToDate(presc.date_start);
                let dEnd = excelToDate(presc.date_end);

                // 2. Lógica de ajuste: Si son iguales o el fin está vacío, sumamos días
                if (dStart !== '') {
                    const parts = dStart.split('/');
                    if (parts.length === 3) {
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]);
                        const year = parseInt(parts[2]);

                        const fechaInicio = new Date(year, month - 1, day);

                        // Si después de convertir siguen siendo iguales o dEnd no existe
                        if (dStart === dEnd || !dEnd) {
                            const fechaFin = new Date(fechaInicio);
                            fechaFin.setDate(fechaFin.getDate() + 2); // Le sumamos 2 días
                            dEnd = `${fechaFin.getDate()}/${fechaFin.getMonth() + 1}/${fechaFin.getFullYear()}`;
                        }
                    }
                }

                return {
                    episode_id: String(patient.episode || ''),
                    identification: String(patient.identification || ''),
                    medication_code: String(presc.kumpels_code || ''),
                    status: String(loadData.status || 'Activo'),
                    route: String(presc.route || ''),
                    dose_amount: String(presc.dose || ''),
                    dose_unit: String(presc.dose_unit || ''),
                    timing_frequency: String(presc.frecuency || presc.frequency || '1'),
                    date_start: dStart, // Guardará "26/8/2020"
                    date_end: dEnd,   // Guardará "28/8/2020"
                    unidentified_medication: presc.kumpels_code ? null : 'No identificado'
                };
            });
        });

        // Loop de inserción...
        for (const data of allPrescriptions) {
            await sequelize.query(`
                INSERT INTO medication_request_auxiliar (
                    episode_id, identification, medication_code, status, 
                    route, dose_amount, dose_unit, timing_frequency, 
                    date_start, date_end, unidentified_medication
                ) VALUES (
                    :episode_id, :identification, :medication_code, :status, 
                    :route, :dose_amount, :dose_unit, :timing_frequency, 
                    :date_start, :date_end, :unidentified_medication
                )
            `, { replacements: data, type: QueryTypes.INSERT });
        }

        return { success: true };
    } catch (error) {
        console.error('Error fatal:', error);
        throw error;
    }
}

export async function getprescriptionsPatient(data) {
    try {
        let queryFilters = '';
        const today = new Date();

        // =====================================================
        // 1. PROCESAMIENTO DE FILTROS
        // =====================================================
        if (data.filters && data.filters.length > 0) {
            data.filters.forEach((filter, index) => {
                if (filter.field === 'active') {
                    filter.field = 'date_end';
                    filter.pattern = 'custom';
                    filter.type = 'date';

                    if (filter.value === true || filter.value === 'true') {
                        filter.operator = '>=';
                    } else {
                        filter.operator = '<';
                    }

                    filter.value = today.toISOString().split('T')[0];
                }

                const filterString = buildFilters(filter);
                queryFilters += (index === 0 ? '' : ' AND ') + filterString;
            });
        }

        // =====================================================
        // 2. OBTENER EPISODIO DEL PACIENTE
        // =====================================================
        const episodeCode = await getEpisodeOfcareByUuid(data.uuid);

        if (!episodeCode) {
            console.error(`[Kumpels] No se encontró episodio para UUID: ${data.uuid}`);

            return {
                all_active: 0,
                all_prescription: 0,
                unident_count: 0,
                prescriptionsWithMedication: []
            };
        }

        // =====================================================
        // 3. CONTADORES
        // =====================================================
        // En la sección 3, ajusta los totales:
        const [allActive, allPrescriptions, unidentCount] = await Promise.all([
            getAllActivePrescription(data.uuid),
            countPrescriptionPatient(data.uuid),
            countUnidentiMedication(data.uuid)
        ]);

        // Consulta rápida para sumar los de la auxiliar
        const [auxCount] = await sequelize.query(
            `SELECT count(*) as total FROM medication_request_auxiliar WHERE episode_id = :ep`,
            { replacements: { ep: String(episodeCode.id) }, type: QueryTypes.SELECT }
        );

        const totalRealMasAux = allPrescriptions + parseInt(auxCount.total);

        // =====================================================
        // 4. PAGINACIÓN + CONSULTA PRINCIPAL (HÍBRIDA: REAL + AUXILIAR)
        // =====================================================
        const [start, end, limit] = calculatePagination(
            data.page,
            data.pageSize
        );

        let prescriptions = [];

        if (queryFilters !== '') {
            // Si hay filtros, seguimos con la lógica normal por ahora
            prescriptions = await getPrescriptionsByEpisodeWithFilters(
                start, end, limit, episodeCode.id, queryFilters
            );
        } else {
            // 1. Traemos las prescripciones de la tabla REAL
            const realPrescriptions = await getPrescriptionsByEpisode(
                start, end, limit, episodeCode.id
            );

            // 2. Traemos las prescripciones de la tabla AUXILIAR
            const auxPrescriptions = await sequelize.query(`
                SELECT 
                    id * -1 as id, 
                    id * -1 as row_number,      
                    uuid as code_pres,
                    true as is_auxiliar,
                    medication_code as medication_id, 
                    unidentified_medication,
                    date_start,
                    date_end,
                    route,
                    dose_amount,
                    dose_unit,
                    timing_frequency,
                    COALESCE(amount, '0') as quantity
                FROM medication_request_auxiliar 
                WHERE episode_id = :episodeId OR identification = :ident
            `, {
                replacements: {
                    episodeId: String(episodeCode.id),
                    ident: String(episodeCode.identification || '')
                },
                type: QueryTypes.SELECT
            });

            // Unimos ambas listas. Los de la auxiliar aparecerán abajo.
            prescriptions = [...realPrescriptions, ...auxPrescriptions];
        }


        // =====================================================
        // 5. MAPEO + NOMBRE MEDICAMENTO (CORREGIDO PARA EL FRONT)
        // =====================================================
        const prescriptionsWithMedication = await Promise.all(
            prescriptions.map(async (prescription) => {
                let medication = {};
                try {
                    const isRealId = prescription.medication_id && !isNaN(parseInt(prescription.medication_id)) && !prescription.is_auxiliar;
                    const whereCondition = isRealId ? `m.id = :medId` : `m.code = :medId`;

                    const [formattedMed] = await sequelize.query(`
                SELECT 
                    CONCAT(
                        STRING_AGG(DISTINCT s.display, ' + '), ' ',
                        '(', STRING_AGG(DISTINCT CONCAT(mi.strength_numerator_value, ' ', u1.symbol), ' + '), ') ',
                        df.display
                    ) AS name_format
                FROM medication m
                JOIN medication_ingredient mi ON m.id = mi.medication_id
                JOIN substance_i18n s ON mi.item_id = s.substance_id
                JOIN dose_form_i18n df ON m.dose_form_id = df.dose_form_id
                LEFT JOIN unit u1 ON mi.strength_numerator_unit_id = u1.id
                WHERE ${whereCondition} AND s.language_id = 2 AND df.language_id = 2
                GROUP BY m.id, df.display
            `, { replacements: { medId: prescription.medication_id }, type: QueryTypes.SELECT });

                    medication = {
                        name_format: formattedMed ? formattedMed.name_format : (prescription.unidentified_medication || `Cód: ${prescription.medication_id}`),
                        potency: (prescription.dose_amount || '') + (prescription.dose_unit || ''),
                        atc_code: String(prescription.medication_id)
                    };
                } catch (e) {
                    medication = { name_format: "Error de consulta", potency: "", atc_code: "N/A" };
                }

                // --- VALIDACIÓN DE STATUS ---
                const status = !prescription.date_end ? true : new Date(prescription.date_end) >= today;

                // --- RETORNO CON TODOS LOS CAMPOS QUE EL FRONT NECESITA ---
                return {
                    prescription: {
                        uuid: prescription.uuid, // Aquí viaja el UUID real
                        code_pres: prescription.code_pres || 'N/A', // Aquí viaja el 'AUX'
                        code_medication: prescription.medication_id || '',
                        // Volvemos a armar los campos uno por uno para que el Front no se pierda
                        dose: (prescription.dose_amount || '0') + (prescription.dose_unit || ''),
                        frequency: (prescription.timing_frequency || '0') + 'h',
                        route: prescription.route || 'N/A',
                        date_start: prescription.date_start || 'N/D',
                        date_end: prescription.date_end || 'Indefinida',
                        quantity: prescription.quantity || '0',
                        status: status,
                        row_number: prescription.row_number || 0,
                        unidentified_medication: prescription.unidentified_medication || '',
                        max_query: allPrescriptions + parseInt(auxCount.total)
                    },
                    medication: medication
                };
            })
        );

        // =====================================================
        // 6. RESPUESTA FINAL
        // =====================================================
        return {
            all_active: allActive.length,
            all_prescription: allPrescriptions,
            unident_count: unidentCount,
            prescriptionsWithMedication
        };

    } catch (error) {
        console.error(
            'Error origin controller -> getprescriptionsPatient:',
            error
        );
        throw error;
    }
}

export async function getMedicationsPatient(data) {
    try {

        const [start, end, limit] = calculatePagination(data.page, data.pageSize);

        const dataMed = await getMedicationUniqueByEpisode(start, end, limit, data.uuid);

        return dataMed;

    } catch (error) {
        console.error('Error origin controller:', error);
        throw error;
    }
}

export async function getMedicationsOptions(data) {
    try {

        const dataMed = await getMedicationUniqueOptions(data.uuid);

        return dataMed;

    } catch (error) {
        console.error('Error origin controller:', error);
        throw error;
    }
}

export async function saveAmount(data) {
    try {
        let codeRequest = await getCodeMedicationRequestByCode(data.uuid);
        let isAuxiliar = false;

        if (!codeRequest) {
            const [auxRequest] = await sequelize.query(`
                SELECT id FROM medication_request_auxiliar WHERE uuid = :uuid LIMIT 1
            `, { replacements: { uuid: data.uuid }, type: QueryTypes.SELECT });

            if (auxRequest) {
                codeRequest = auxRequest;
                isAuxiliar = true;
            } else {
                return { success: false, message: 'El medicamento no existe' };
            }
        }

        if (isAuxiliar) {
            // 👇 ACTUALIZAMOS LA NUEVA COLUMNA 'amount'
            await sequelize.query(`
                UPDATE medication_request_auxiliar 
                SET amount = :amount 
                WHERE uuid = :uuid
            `, { replacements: { amount: data.amount, uuid: data.uuid } });

        } else {
            await createOrUpdateAmountMedication(codeRequest.id, data.amount);
        }

        return { message: 'Data save' };

    } catch (error) {
        console.error('Error origin controller:', error);
        throw error;
    }
}