import { MedicationRequestStatus, Medication, MedicationRequest, EpisodeOfCare, MedicationDispense, AtcI18n } from './entities/entities.js';
import sequelize from '../config/db.js';
import { Op, fn } from 'sequelize';

async function createPrescriptionFromDataHospital(data) {
    try {

        await MedicationRequest.create({
            medication_id: data.medication_code,
            status_id: data.status,
            authored_on: data.authored_on,
            route: data.route,
            dose_amount: data.dose_amount,
            dose_unit: data.dose_unit,
            timing_frequency: data.timing_frequency,
            episode_of_care_id: data.episode_id,
            date_start: data.date_start,
            date_end: data.date_end,
            unidentified_medication: data.unidentified_medication
        })

    } catch (error) {
        console.error('Error create medication origin from model: ->', error);
        throw error;
    }
}

async function getIdStatusByCode(code) {
    try {
        const data = await MedicationRequestStatus.findOne({
            attributes: ['id'],
            where: {
                // Forzamos que sea un string y si no viene nada usamos 'active' o '1'
                code: code || 'active'
            }
        });

        // 🔥 Si data existe, devuelve el id. Si no, devuelve 1 (el ID estándar para Activo)
        return data ? data.id : 1;

    } catch (error) {
        console.error('Error get status origin from model: ->', error);
        // Devolvemos 1 en el catch también para que el flujo principal no se detenga
        return 1;
    }
}

async function getMedicationByIdentification(idMedication) {

    try {

        const data = await Medication.findOne(
            {
                attributes: ['id'],
                where: {
                    code: idMedication
                }
            }
        )

        return data;


    } catch (error) {
        console.error('Error get medication identification origin from model: ->', error);
        throw error;
    }
}

async function getDataMedicationWithPotency(idMedication) {
    try {
        const query = `
                        WITH medication_data AS (SELECT medication.code AS code,
                                                        medication.id   AS medication_id,
                                                        ai18n.display   AS medication_description,
                                                        dfi18n.display  AS form_description,
                                                        u.symbol
                                                FROM medication
                                                        INNER JOIN public.medication_atc ma ON medication.id = ma.medication_id
                                                        INNER JOIN public.atc a ON a.id = ma.atc_id
                                                        INNER JOIN public.atc_i18n ai18n ON a.id = ai18n.atc_id
                                                        INNER JOIN public.dose_form df ON df.id = medication.dose_form_id
                                                        INNER JOIN public.dose_form_i18n dfi18n ON df.id = dfi18n.dose_form_id
                                                        LEFT OUTER JOIN public.unit u ON u.id = medication.total_volume_unit_id
                                                WHERE ai18n.language_id = 2
                                                AND dfi18n.language_id = 2
                                                AND medication.id = ?),
                            medication_all AS (SELECT md.*,
                                                    STRING_AGG(CAST(mi.strength_numerator_value AS TEXT) || u.symbol,
                                                                ' + ') AS concatenated_strength
                                                FROM medication_ingredient mi
                                                        INNER JOIN public.unit u ON u.id = mi.strength_numerator_unit_id
                                                        INNER JOIN medication_data md ON md.medication_id = mi.medication_id
                                                GROUP BY md.code, md.medication_id, md.medication_description, md.form_description, md.symbol)
                        SELECT *
                        FROM medication_all;
                    `;

        const replacements = [idMedication];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get data medication with potency origin from model:', error);
        throw error;
    }
}

async function getPrescriptionsByEpisode(start, end, limit, episodeId) {
    try {

        const query = `
                        SELECT *
                        FROM (
                            SELECT
                                mr.uuid AS code_pres,
                                mr.medication_id,
                                mr.route,
                                mr.dose_amount,
                                mr.dose_unit,
                                mr.timing_frequency,
                                mr.episode_of_care_id,
                                TO_DATE(mr.date_start, 'DD-MM-YYYY') AS date_start,
                                TO_DATE(mr.date_end, 'DD-MM-YYYY') AS date_end,
                                mr.unidentified_medication,
                                COALESCE(md.quantity, 0) AS quantity,
                                ROW_NUMBER() OVER (ORDER BY mr.id DESC, TO_DATE(mr.date_start, 'DD-MM-YYYY') DESC) AS row_number
                            FROM (
                                SELECT
                                    medication_request.id,
                                    medication_request.uuid,
                                    medication_request.medication_id,
                                    medication_request.route,
                                    medication_request.dose_amount,
                                    medication_request.dose_unit,
                                    medication_request.timing_frequency,
                                    medication_request.episode_of_care_id,
                                    medication_request.date_start,
                                    medication_request.date_end,
                                    medication_request.unidentified_medication
                                FROM medication_request
                                WHERE episode_of_care_id = ?
                            ) mr
                            LEFT JOIN (
                                SELECT
                                    medication_dispense.request_id,
                                    COALESCE(SUM(medication_dispense.quantity), 0) AS quantity
                                FROM public.medication_dispense
                                GROUP BY medication_dispense.request_id
                            ) md ON mr.id = md.request_id
                        ) prescription
                        WHERE row_number BETWEEN ? AND ?
                        LIMIT ?;
                    `;

        const replacements = [episodeId, start, end, limit];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get data medication with potency origin from model:', error);
        throw error;
    }
}

async function getPrescriptionsByEpisodeWithFilters(start, end, limit, episodeId, queryFilter) {
    try {

        // El planteamineto de query concatenado puede mejorar para el aparatado de filtros. Sin embargo, por ahora se tiene validado los datos con el fin de evitar sql inyection

        const query = `
                        WITH all_prescriptions AS (SELECT 
                                                        medication_request.uuid AS code_pres,  
                                                        ai18n.display                    AS medication_name,
                                                        medication_request.medication_id AS medication_id,
                                                        m.code                           AS code_kumpesl_medication,
                                                        route,
                                                        dose_amount,
                                                        dose_unit,
                                                        timing_frequency,
                                                        episode_of_care_id,
                                                        COALESCE(md.quantity,0) AS quantity,
                                                        TO_DATE(date_start, 'DD-MM-YYYY') AS date_start,
                                                        TO_DATE(date_end, 'DD-MM-YYYY') AS date_end
                                                FROM medication_request
                                                            INNER JOIN public.medication m ON m.id = medication_request.medication_id
                                                            INNER JOIN public.medication_atc ma ON m.id = ma.medication_id
                                                            INNER JOIN public.atc a ON a.id = ma.atc_id
                                                            INNER JOIN public.atc_i18n ai18n ON a.id = ai18n.atc_id
                                                            LEFT JOIN public.medication_dispense md ON medication_request.id = md.request_id
                                                WHERE episode_of_care_id = ?
                                                    AND ai18n.language_id = 2)
                        , filtered_prescriptions AS (SELECT *,
                                                            ROW_NUMBER()
                                                            OVER (ORDER BY date_start DESC, medication_id DESC ) AS row_number
                                                        FROM all_prescriptions
                                                        WHERE ${queryFilter}),
                        max_query AS (SELECT MAX(filtered_prescriptions.row_number)::INT AS num
                                        FROM filtered_prescriptions)
                        SELECT *
                        FROM (SELECT *, max_query.num AS max_query
                            FROM filtered_prescriptions, max_query
                            WHERE row_number BETWEEN ? AND ?) AS paginated_prescriptions
                            ORDER BY date_start DESC
                        LIMIT ?;
                    `;

        const replacements = [episodeId, start, end, limit];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get data medication with potency origin from model:', error);
        throw error;
    }
}

async function getAllActivePrescription(episode_id) {
    try {
        const today = new Date().toISOString().split('T')[0];

        const data = await MedicationRequest.findAll({
            include: [
                {
                    model: EpisodeOfCare,
                    where: { uuid: episode_id }
                },
                {
                    model: Medication // Solo Medication, sin el include de atc_i18n
                }
            ],
            where: {
                [Op.and]: [
                    sequelize.where(
                        fn('to_date', sequelize.col('date_end'), 'DD-MM-YYYY'),
                        { [Op.gte]: today }
                    )
                ]
            }
        });

        // 🕵️‍♂️ LOG DE EMERGENCIA EN TERMINAL
        if (data.length > 0) {
            console.log(`\n--- 💊 CHEQUEO DE DATOS RECUPERADOS ---`);
            data.forEach(item => {
                console.log(`ID Med: ${item.medication_id} | Texto Guardado: ${item.unidentified_medication}`);
            });
            console.log(`---------------------------------------\n`);
        }

        return data;

    } catch (error) {
        console.error('❌ ERROR EN BACKEND:', error.message);
        throw error;
    }
}

async function countPrescriptionPatient(episode_id) {
    try {

        const count = await MedicationRequest.count({
            include: [{
                model: EpisodeOfCare,
                where: {
                    uuid: episode_id
                }
            }]
        });

        return count;

    } catch (error) {
        console.error('Error get all count medication origin from model:', error);
        throw error;
    }
}


async function countUnidentiMedication(episode_id) {
    try {

        const count = await MedicationRequest.count({
            include: [{
                model: EpisodeOfCare,
                where: {
                    uuid: episode_id
                }
            }],
            where: {
                medication_id: null
            }
        });

        return count;

    } catch (error) {
        console.error('Error countUnidentiMedicationorigin from model:', error);
        throw error;
    }
}

async function getMedicationUniqueByEpisode(start, end, limit, episodeId) {
    try {
        const query = `
WITH ranked_medications AS (
    -- 1. Obtenemos los medicamentos únicos del episodio y el patient_id
    SELECT DISTINCT ON (mrax.medication_code, mrax.unidentified_medication) 
        mrax.medication_code,
        p.id AS patient_id,
        mrax.date_start AS date,
        COALESCE(
            NULLIF(mrax.unidentified_medication, 'null'), 
            ai18n.display || ' : ' || COALESCE(UPPER(u.symbol), 'Sin unidad'),
            'ID: ' || mrax.identification
        ) AS name_format,
        m.id AS medication_id
    FROM public.medication_request_auxiliar mrax
    INNER JOIN public.episode_of_care eoc ON eoc.id = mrax.episode_id::bigint
    INNER JOIN public.medical_service ms ON ms.id = eoc.medical_service_id
    INNER JOIN public.patient p ON p.id = ms.patient_id
    LEFT JOIN public.medication m ON m.code = mrax.medication_code
    LEFT JOIN public.unit u ON m.total_volume_unit_id = u.id
    LEFT JOIN public.medication_atc ma ON m.id = ma.medication_id
    LEFT JOIN public.atc a ON a.id = ma.atc_id
    LEFT JOIN public.atc_i18n ai18n ON a.id = ai18n.atc_id AND ai18n.language_id = 2
    WHERE eoc.uuid = ? -- Parámetro: episodeId
    ORDER BY mrax.medication_code, mrax.unidentified_medication, mrax.date_start DESC
),
patient_alerts_count AS (
    -- 2. Contamos TODAS las alertas en known_issue_generate para el paciente identificado
    SELECT COUNT(*) AS total_alerts
    FROM public.known_issue_generate
    WHERE patient_id = (SELECT patient_id FROM ranked_medications LIMIT 1)
),
ranked_medications_data AS (
    -- 3. Unimos los medicamentos con el conteo global de alertas del paciente
    SELECT 
        rm.*,
        (SELECT total_alerts FROM patient_alerts_count) AS alert_val,
        ROW_NUMBER() OVER (ORDER BY rm.date DESC) AS row_number_act
    FROM ranked_medications rm
),
counted_medications AS (
    -- 4. Conteo total de registros para la paginación del frontend
    SELECT COUNT(*) AS total_records FROM ranked_medications_data
)
-- 5. Resultado final para el mapeo del frontend
SELECT 
    rm.medication_code AS code,
    rm.name_format AS "nameMedication",
    rm.date,
    rm.alert_val AS alert, -- Aquí llegará el número de alertas (ej. 3)
    rm.row_number_act,
    cm.total_records,
    rm.medication_id
FROM ranked_medications_data rm
CROSS JOIN counted_medications cm
WHERE rm.row_number_act BETWEEN ? AND ? -- Parámetros: start y end
ORDER BY rm.row_number_act
LIMIT ?; -- Parámetro: limit
        `;

        const replacements = [episodeId, start, end, limit];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get unique medication from auxiliary:', error);
        throw error;
    }
}

async function getMedicationUniqueOptions(episodeId) {
    try {

        const query = `
                        SELECT  DISTINCT ON(m.id)
                                m.id                                                                AS medication_id,
                                m.code                                                              AS medication_code,
                                CONCAT(ai18n.display, ' - ', COALESCE(UPPER(symbol), 'Sin unidad')) AS name_format
                        FROM medication_request
                                INNER JOIN public.episode_of_care eoc
                                            ON eoc.id = medication_request.episode_of_care_id
                                INNER JOIN public.medical_service ms ON ms.id = eoc.medical_service_id
                                INNER JOIN public.patient p ON p.id = ms.patient_id
                                INNER JOIN public.medication m ON m.id = medication_request.medication_id
                                LEFT JOIN public.unit u ON m.total_volume_unit_id = u.id
                                INNER JOIN public.dose_form df ON df.id = m.dose_form_id
                                INNER JOIN public.dose_form_i18n dfi18n ON df.id = dfi18n.dose_form_id
                                INNER JOIN public.medication_atc ma ON m.id = ma.medication_id
                                INNER JOIN public.atc a ON a.id = ma.atc_id
                                INNER JOIN public.atc_i18n ai18n ON a.id = ai18n.atc_id
                        WHERE eoc.uuid = ?
                        AND ai18n.language_id = 2
                        AND dfi18n.language_id = 2
                        GROUP BY p.id, m.id, m.code, dfi18n.display, u.symbol, medication_request.date_start,
                                ai18n.display
                    `;

        const replacements = [episodeId];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get unique medication origin from model:', error);
        throw error;
    }
}

async function createOrUpdateAmountMedication(code, amount) {
    try {
        const existingRecord = await MedicationDispense.findOne({ where: { request_id: code } });

        let result;

        if (existingRecord) {
            result = await existingRecord.update({
                quantity: amount,
                when_handed_over: new Date()
            });
        } else {
            result = await MedicationDispense.create({
                request_id: code,
                status_id: 1,
                quantity: amount,
                when_handed_over: new Date()
            });
        }

        return result;

    } catch (error) {
        console.error('Error createOrUpdateAmountMedication origin from model ->:', error);
        throw error;
    }
}

async function getCodeMedicationRequestByCode(uuidO) {
    try {

        const data = await MedicationRequest.findOne({
            attributes: ['id'],
            where: {
                uuid: uuidO
            }
        })

        return data;

    } catch (error) {
        console.error('Error createOrUpdateAmountMedication origin from model ->:', error);
        throw error;
    }
}

export async function getMedicationNameByAtcCode(code, languageId = 2) {
    try {
        const query = `
            SELECT ai.display
            FROM medication m
            INNER JOIN atc_i18n ai
                ON m.id = ai.atc_id
            WHERE m.code = :code
            AND ai.language_id = :languageId
            LIMIT 1
        `;

        const result = await sequelize.query(query, {
            replacements: {
                code: String(code),
                languageId
            },
            type: sequelize.QueryTypes.SELECT
        });

        return result[0] || null;

    } catch (error) {
        console.error("Error getMedicationNameByAtcCode:", error);
        return null;
    }
}

export {
    createPrescriptionFromDataHospital,
    getIdStatusByCode,
    getMedicationByIdentification,
    getDataMedicationWithPotency,
    getPrescriptionsByEpisode,
    getPrescriptionsByEpisodeWithFilters,
    getAllActivePrescription,
    countPrescriptionPatient,
    getMedicationUniqueByEpisode,
    createOrUpdateAmountMedication,
    getCodeMedicationRequestByCode,
    countUnidentiMedication,
    getMedicationUniqueOptions,

}