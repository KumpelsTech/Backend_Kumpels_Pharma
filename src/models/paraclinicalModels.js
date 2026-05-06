import { ObservationStatus, ObservationCategory, ObservationCode, Observation } from './entities/entities.js';
import sequelize from '../config/db.js';


async function getStatusObservation(code) {
    try {

        const idStatus = await ObservationStatus.findOne({
            attributes: ['id'],
            where: {
                code: code
            }
        })

        return idStatus;

    } catch (error) {
        console.error('Error get status observartion origin from model: ->', error);
        throw error;
    }

}

async function getCategoryObservation(category) {
    try {
        const data = await ObservationCategory.findOne({
            attributes: ['id'],
            where: {
                code: category
            }
        });

        return data ? data.id : null;

    } catch (error) {
        console.error('Error get category observation:', error);
        throw error;
    }
}

async function getCodeObservation(code) {
    try {
        const result = await ObservationCode.findOne({
            attributes: ['id'],
            where: { code }
        });

        return result?.id ?? null;

    } catch (error) {
        console.error('Error get code observation:', error);
        throw error;
    }
}

// 1. Agregamos el parámetro 't' a la función
export async function createParaclinicalFromDataHospital(structData, t = null) {
    try {
        // 🔴 VALIDACIÓN CRÍTICA
        if (!structData.status) {
            throw new Error(`status_id es requerido pero llegó: ${structData.status}`);
        }
        if (!structData.category && structData.category !== 0) {
            throw new Error(`category_id es requerido pero llegó: ${structData.category}`);
        }
        if (!structData.code) {
            throw new Error(`code_id es requerido pero llegó: ${structData.code}`);
        }

        // 2. Pasamos la transacción dentro de las opciones del create
        const observation = await Observation.create({
            episode_of_care_id: structData.episode,
            status_id: structData.status,
            category_id: structData.category,
            code_id: structData.code,
            value: structData.code === 5 ? structData.value : Number(structData.value),
            unit: structData.unit ?? null,
            issued: structData.date ?? new Date()
        }, { transaction: t }); // <--- 🔥 ESTO ES LO QUE HACÍA FALTA

        return observation;

    } catch (error) {
        console.error("❌ Error al insertar en tabla observation:");
        if (error instanceof Error) {
            console.error("🧨 Mensaje:", error.message);
        }
        console.error(error);
        // Ojo: es mejor lanzar el error para que la transacción principal haga rollback
        throw error;
    }
}

async function getDataParaclinical(idEpisode, size) {
    try {
        const query = `
            WITH RankedObservations AS (
                SELECT
                    oc.id AS code_id,
                    oc.code AS code_param,
                    ob.value AS value,       -- ⬅️ CAMBIO: Antes era value_param
                    ob.issued AS issued,     -- ⬅️ CAMBIO: Antes era date_param
                    ob.unit AS unit,         -- ⬅️ CAMBIO: Antes era unit_param
                    DENSE_RANK() OVER (ORDER BY oc.code) AS range,
                    ROW_NUMBER() OVER (
                        PARTITION BY oc.code
                        ORDER BY ob.issued DESC
                    ) AS row_number
                FROM observation ob
                INNER JOIN public.observation_code oc ON ob.code_id = oc.id
                INNER JOIN public.episode_of_care eoc ON eoc.id = ob.episode_of_care_id
                WHERE eoc.uuid = ?
            )
            SELECT
                code_id,
                code_param,
                value,   -- ⬅️ Coincide con record.value
                issued,  -- ⬅️ Coincide con record.issued
                unit,    -- ⬅️ Coincide con record.unit
                range
            FROM RankedObservations
            WHERE row_number <= ?
            ORDER BY range DESC, issued DESC;
        `;

        const replacements = [idEpisode, size];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        // DEBUG PARA TI: Si esto sale vacío en consola, el UUID no existe en episode_of_care
        // console.log("DATA DESDE SQL:", results);

        return results;

    } catch (error) {
        console.error('Error getting paraclinical data from model:', error);
        throw error;
    }
}

async function verifyCodeParaclinical(code) {
    try {
        const data = await Observation.findOne({
            attributes: ['code_register'],
            where: {
                code_register: code
            }
        });
        if (data && data.code_register) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error verify code paraclinical origin from model: ->', error);
        throw error;
    }

}

export {
    getStatusObservation,
    getCategoryObservation,
    getCodeObservation,
    getDataParaclinical,
    verifyCodeParaclinical
};

