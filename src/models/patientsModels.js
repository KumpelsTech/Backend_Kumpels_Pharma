import sequelize, { fn, where, col, Op } from '../config/db.js';

import { Patient, Specialty, MedicalService, Allergy, DetectedIssue, EpisodeOfCare, AdministrativeGender, DiagnosisCode, Atc, Medication, MedicationAtc, ReportDiagnosis, DiagnosisCodeI18n, AtcI18n, KnownIssueGenerate } from './entities/entities.js';

async function getPatientsData(start, end, limit, queryFilter) {
    try {
        if (queryFilter) {
            queryFilter = ' ' + 'AND' + ' ' + queryFilter;
        }
        const query = `
                        WITH alerts AS (SELECT COALESCE(di.patient_id, kig.patient_id)                                     AS patient_id,
                                                COALESCE(di.count_detected_issues, 0) + COALESCE(kig.count_known_issues, 0) AS alerts
                                            FROM (SELECT patient_id, COUNT(*) AS count_detected_issues
                                                FROM detected_issue
                                                GROUP BY patient_id) AS di
                                                    FULL OUTER JOIN (SELECT patient_id, COUNT(*) AS count_known_issues
                                                                    FROM known_issue_generate
                                                                    GROUP BY patient_id) AS kig
                                                                    ON di.patient_id = kig.patient_id
                                            WHERE di.patient_id IS NOT NULL
                                            OR kig.patient_id IS NOT NULL),
                            patient_data AS (SELECT pt.uuid                                                     AS patient_code,
                                                    pt.t_identification,
                                                    pt.identification,
                                                    pt.first_name,
                                                    pt.last_name,
                                                    ms.history_clinic,
                                                    eoc.code_episode,
                                                    ag.symbol                                                   AS sex,
                                                    eoc.bed,
                                                    eoc.uuid                                                    AS code,
                                                    eoc.id                                                      AS id_ep_of_care,
                                                    TO_CHAR(pt.birth_date, 'YYYY-MM-DD')                        AS birth_date,
                                                    TO_CHAR(eoc.period_start, 'YYYY-MM-DD')                     AS period_start,
                                                    TO_CHAR(eoc.period_end, 'YYYY-MM-DD')                       AS period_end,
                                                    COALESCE(al.alerts, 0)                                      AS alerts,
                                                    ROW_NUMBER() OVER (PARTITION BY pt.id ORDER BY eoc.id DESC) AS recent_episode
                                            FROM patient pt
                                                    FULL OUTER JOIN
                                                medical_service ms ON pt.id = ms.patient_id
                                                    FULL OUTER JOIN
                                                public.episode_of_care eoc ON ms.id = eoc.medical_service_id
                                                    INNER JOIN
                                                public.administrative_gender ag ON ag.id = pt.gender_id
                                                    LEFT JOIN
                                                alerts al ON al.patient_id = pt.id),
                            filtered_patient_data AS (SELECT *
                                                    FROM patient_data
                                                    WHERE recent_episode = 1 ${queryFilter}),
                            numbered_patient_data AS (SELECT *,
                                                            ROW_NUMBER()
                                                            OVER (ORDER BY period_end DESC, COALESCE(alerts, 0) DESC, period_start) AS row_number
                                                    FROM filtered_patient_data),
                            max_query AS (SELECT MAX(numbered_patient_data.row_number)::INT AS num
                                        FROM numbered_patient_data)
                        SELECT *, max_query.num AS max_query
                        FROM numbered_patient_data,
                            max_query
                        WHERE row_number BETWEEN ? AND ?
                        ORDER BY row_number
                        LIMIT ?;
        `;
        const replacements = [start, end, limit];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get list patient origin from model: ->', error);
        throw error;
    }
}

async function getPatientsDataPharmacist(start, end, limit, queryFilter) {
    try {
        const query = `
                        WITH alerts AS (SELECT di.patient_id,
                                            COALESCE(di.count_detected_issues, 0) + COALESCE(kig.count_known_issues, 0) AS alerts
                                        FROM (SELECT patient_id, COUNT(*) AS count_detected_issues
                                            FROM detected_issue
                                            GROUP BY patient_id) AS di
                                                FULL OUTER JOIN (SELECT patient_id, COUNT(*) AS count_known_issues
                                                                FROM known_issue_generate
                                                                GROUP BY patient_id) AS kig
                                                                ON di.patient_id = kig.patient_id), -- Calcular las alertas del paciente
                            patient_data AS (SELECT pt.uuid                                                     AS patient_code,
                                                    pt.t_identification,
                                                    pt.identification,
                                                    pt.first_name,
                                                    pt.last_name,
                                                    ms.history_clinic,
                                                    eoc.code_episode,
                                                    ag.symbol                                                   AS sex,
                                                    eoc.bed,
                                                    eoc.uuid                                                    AS code,
                                                    eoc.id                                                      AS id_ep_of_care,
                                                    TO_CHAR(pt.birth_date, 'YYYY-MM-DD')                        AS birth_date,
                                                    TO_CHAR(eoc.period_start, 'YYYY-MM-DD')                     AS period_start,
                                                    TO_CHAR(eoc.period_end, 'YYYY-MM-DD')                       AS period_end,
                                                    COALESCE(al.alerts, 0)                                      AS alerts,
                                                    ROW_NUMBER() OVER (PARTITION BY pt.id ORDER BY eoc.id DESC) AS recent_episode
                                            FROM patient pt
                                                    FULL OUTER JOIN
                                                medical_service ms ON pt.id = ms.patient_id
                                                    FULL OUTER JOIN
                                                public.episode_of_care eoc ON ms.id = eoc.medical_service_id
                                                    INNER JOIN
                                                public.administrative_gender ag ON ag.id = pt.gender_id
                                                    LEFT JOIN
                                                alerts al ON al.patient_id = pt.id),              -- Datos del paciente con alertas
                            filtered_patient_data AS (SELECT *
                                                    FROM patient_data
                                                    WHERE recent_episode = 1),                    -- Traer por defecto el último episodio de cuidado
                            filtered_with_pharma AS (SELECT fpt.*,
                                                            CONCAT(TRIM(u.name), ' ', TRIM(u.last_name), ' ',
                                                                    u.identification) AS pharma
                                                    FROM filtered_patient_data fpt
                                                            INNER JOIN
                                                        service_pharma sp ON sp.episode_of_care_id = fpt.id_ep_of_care
                                                            INNER JOIN
                                                        public.users u ON u.id = sp.user_id),     -- Traer pacientes con alguna asociación de farmaceutico
                            filtered_pharma AS (SELECT DISTINCT ON (patient_code) *
                                                FROM filtered_with_pharma
                                                WHERE ${queryFilter}),                    -- Filtrado especifico
                            numbered_patient_data AS (SELECT *,
                                                            ROW_NUMBER()
                                                            OVER (ORDER BY period_end DESC, COALESCE(alerts, 0) DESC, period_start) AS row_number
                                                    FROM filtered_pharma),
                            max_query AS (SELECT MAX(numbered_patient_data.row_number)::INT AS num
                                        FROM numbered_patient_data)
                        SELECT *, max_query.num AS max_query
                        FROM numbered_patient_data,
                            max_query
                        WHERE row_number BETWEEN ? AND ?
                        ORDER BY row_number
                        LIMIT ?;
        `;

        const replacements = [start, end, limit];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get list patient origin from model: ->', error);
        throw error;
    }
}

async function createDataPatientFromDataHospital(data) {
    const transaction = await sequelize.transaction();
    try {
        // Upsert patient
        const [patient] = await Patient.upsert({
            gender_id: data.gender_id,
            birth_date: data.birth_date,
            t_identification: String(data.t_identification),
            identification: data.identification,
            first_name: data.first_name,
            second_name: data.second_name,
            last_name: data.last_name,
            second_last_name: data.second_last_name,
        }, {
            where: {
                identification: String(data.identification),
            },
            returning: true,
            transaction,
        });

        // Upsert medical service
        const [medicalS] = await MedicalService.upsert({
            patient_id: patient.id,
            history_clinic: String(data.id_history_clinic)
        }, {
            where: {
                history_clinic: String(data.id_history_clinic)
            },
            returning: true,
            transaction
        });

        // Upsert allergies
        await Promise.all(data.allergies.map(async (resp) => {
            await Allergy.upsert({
                medical_service_id: medicalS.id,
                medication_id: resp.medication_id,
                observation: resp.observation,
                code: resp.code
            }, {
                where: {
                    medical_service_id: medicalS.id,
                    medication_id: resp.medication,
                    code: resp.code
                },
                returning: true,
                transaction
            });
        }));

        // Upsert report diagnoses
        const diagnosesTasks = [...data.p_diagnostic, ...data.s_diagnostic].map(async (resp) => {
            await ReportDiagnosis.upsert({
                date_report: resp.date_report,
                rank_report: resp.category,
                observations: resp.observation,
                medical_service_id: medicalS.id,
                category_id: resp.role_diagnosis,
                diagnosis_code_id: resp.id_diagnosis
            }, {
                where: {
                    medical_service_id: medicalS.id,
                    diagnosis_code_id: resp.id_diagnosis,
                    rank_report: resp.category,
                },
                returning: true,
                transaction
            });
        });

        await Promise.all(diagnosesTasks);

        // Find or create specialty
        const [specialty] = await Specialty.findOrCreate({
            where: { name: data.specialty },
            defaults: { name: data.specialty },
            transaction
        });

        // Create episode of care
        await EpisodeOfCare.create({
            period_start: data.date_of_entry,
            period_end: data.discharge_date,
            medical_service_id: medicalS.id,
            specialty_id: specialty.id,
            bed: data.bed,
            service_provider_id: data.service_provider,
            code_episode: String(data.episode),
            name_doctor: data.doctor_name,
            status_id: data.status_episode,
            medical_center: data.medical_center
        }, {
            transaction
        });

        await transaction.commit();

    } catch (error) {
        await transaction.rollback();
        console.error('Error creating records patient origin from model: ->', error);
        throw error;
    }
}

export async function getRecentEpisodeByIdentificationPatient(identification) {
    try {

        const id = String(identification);

        const episode = await EpisodeOfCare.findOne({
            include: [{
                model: MedicalService,
                include: [{
                    model: Patient,
                    where: {
                        identification: id
                    }
                }]
            }],
            where: {
                period_end: null
            },
            order: [['created_at', 'DESC']]
        });

        return episode;

    } catch (error) {
        console.error("Error getRecentEpisode:", error);
        throw error;
    }
}


async function searchGenderByPatient(symbol) {
    try {
        const defaultSymbol = 'O';

        const upperSymbol = symbol.toUpperCase();

        let gender = await AdministrativeGender.findOne({
            attributes: ['id'],
            where: { symbol: upperSymbol }
        });

        if (!gender) {
            gender = await AdministrativeGender.findOne({
                attributes: ['id'],
                where: { symbol: defaultSymbol }
            });
        }

        return gender.id;

    } catch (err) {
        console.error('Error searching gender origin from model: ->', err);
        throw err;
    }
}

async function searchDiagnosisByCode(codeD) {
    try {
        const data = await DiagnosisCode.findOne({
            attributes: [
                'id'
            ],
            where: {
                code: codeD
            }
        });
        if (data) {
            return data.id;
        } else {
            return "";
        }
    } catch (err) {
        console.error('Error get diagnostic origin from model: ->', err);
        throw err;
    }
}

async function searchMedicationByAllergy(atc) {
    try {
        const code = await Medication.findOne({
            attributes: ['id'],
            include: [{
                model: MedicationAtc,
                attributes: [],
                include: [{
                    model: Atc,
                    where: {
                        code: atc
                    }
                }]
            }]
        });
        if (code) {
            return code.id
        } else {
            return null;
        }

    } catch (err) {
        console.error('Error get medication by allergies origin from model: ->', err);
        throw err;
    }

}

async function getDetailsPatient(uuid) {
    try {
        const patientData = await Patient.findOne({
            attributes: [
                'first_name',
                'last_name',
                'birth_date',
                'identification',
                't_identification'
            ],
            include: [
                {
                    model: MedicalService,
                    attributes: ['id', 'history_clinic'],
                    include: [
                        {
                            model: EpisodeOfCare,
                            attributes: ['id', 'uuid', 'name_doctor', 'bed', 'period_start', 'period_end', 'code_episode'],
                            include: [{
                                model: Specialty,
                                attributes: ['name']
                            }],
                            limit: 1,
                            order: [['id', 'DESC']]
                        },
                    ],
                },
                {
                    model: AdministrativeGender,
                    attributes: ['symbol']
                }
            ],
            where: {
                uuid: uuid
            }
        });
        return patientData;

    } catch (err) {
        console.error('Error get details patient from model: ->', err);
        throw err;
    }
}

async function getPatientAlertsByUuid(uuid) {
    try {
        const alertsCount = await DetectedIssue.count({
            include: [{
                model: Patient,
                where: { uuid: uuid }
            }]
        });

        return alertsCount || 0;
    } catch (error) {
        console.error('Error fetching patient alerts origin from model -> :', error);
        throw error;
    }
}

export async function getTotalPatientAlerts(uuid) {
    try {
        const queryAlerts = `
            WITH patient_info AS (
                SELECT id FROM patient WHERE uuid = :uuid
            )
            SELECT 
                (SELECT COUNT(*) FROM detected_issue WHERE patient_id = (SELECT id FROM patient_info)) +
                (SELECT COUNT(*) FROM known_issue_generate WHERE patient_id = (SELECT id FROM patient_info)) AS total_alerts
        `;

        const alertResult = await sequelize.query(queryAlerts, {
            replacements: { uuid: uuid },
            type: sequelize.QueryTypes.SELECT
        });

        return alertResult[0]?.total_alerts || 0;
    } catch (error) {
        console.error('Error calculando el total de alertas:', error);
        return 0;
    }
}

async function getPatientAlertsGenerateByUuid(uuid) {
    try {
        const alerts = await KnownIssueGenerate.findAll({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('user_id')), 'alerts']
            ],
            include: [{
                model: Patient,
                attributes: [],
                where: { uuid: uuid }
            }],
            group: ['user_id']
        });

        const alertsCount = alerts.length > 0 ? alerts[0].get('alerts') : 0;
        return alertsCount;
    } catch (error) {
        console.error('Error fetching patient alerts origin from model -> :', error);
        throw error;
    }
}

async function getAllTotalPatients() {

    const all = await Patient.count()
    return all;
}

async function getAllActiveTotalPatients() {
    try {
        const query = `                        
                        WITH patient_data AS (SELECT TO_CHAR(eoc.period_end, 'YYYY-MM-DD')                       AS period_end,
                                                ROW_NUMBER() OVER (PARTITION BY pt.id ORDER BY eoc.id DESC) AS recent_episode
                                        FROM patient pt
                                                FULL OUTER JOIN
                                            medical_service ms ON pt.id = ms.patient_id
                                                FULL OUTER JOIN
                                            public.episode_of_care eoc ON ms.id = eoc.medical_service_id),
                        filtered_patient_data AS (SELECT COUNT(*)
                                                FROM patient_data
                                                WHERE recent_episode = 1 AND period_end IS NULL)
                        SELECT *
                        FROM filtered_patient_data
        `
        const results = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
        });
        return results[0].count;

    } catch (error) {
        console.error('Error counting patients:', error);
        throw error;
    }
}

async function getAllergies(uuid) {
    try {
        const allergies = await Allergy.findAll({
            attributes: [
                'code',
                'description'
            ],
            include: [
                {
                    model: AllergyPatient,
                    attributes: [],
                    include: [
                        {
                            model: Patient,
                            attributes: [],
                            where: {
                                uuid: uuid
                            }
                        }
                    ]
                }
            ]
        });

        return allergies;

    } catch (error) {
        console.error('Error get allergies origin from model -> :', error);
        throw error;
    }

}

async function getDiagnosisByService(codeService) {
    try {
        const reportDiagnosisDataList = await ReportDiagnosis.findAll({
            attributes: [
                'id',
                'date_report',
                'rank_report',
                'observations'
            ],
            include: [
                {
                    model: DiagnosisCode,
                    attributes: ['id', 'code'],
                    include: [
                        {
                            model: DiagnosisCodeI18n,
                            // CRUCIAL: Solo solicita la columna 'display'. 
                            // Esto evita que Sequelize intente buscar un 'id' inexistente.
                            attributes: ['display']
                        }
                    ]
                }
            ],
            where: {
                medical_service_id: codeService
            }
        });

        // Si no hay diagnósticos, retornamos un array vacío para no romper el controlador
        if (!reportDiagnosisDataList || reportDiagnosisDataList.length === 0) {
            return [];
        }

        return reportDiagnosisDataList.map(item => {
            // Verificamos que existan las relaciones antes de acceder a ellas
            const translation = item.DiagnosisCode?.DiagnosisCodeI18ns?.[0]?.display || 'Sin descripción';

            return {
                date_report: item.date_report,
                rank_report: item.rank_report,
                observations: item.observations,
                diagnosis_code: {
                    code: item.DiagnosisCode?.code || 'N/A',
                    translations: translation
                }
            };
        });

    } catch (err) {
        console.error('Error get diagnosis patient from model: ->', err);
        throw err;
    }
}

async function getAllergiesByService(codeService) {
    try {

        const reportAllergies = await Allergy.findAll({
            attributes: [
                'code',
                'observation'
            ],
            include: [
                {
                    model: Medication,
                    attributes: ['id'],
                }
            ],
            where: {
                medical_service_id: codeService
            }
        });

        if (!reportAllergies || reportAllergies.length === 0) {
            return [];
        }

        const patientDataList = await Promise.all(reportAllergies.map(async (report) => {
            let atc_medications = { translations: null };

            if (report.medication && report.medication.id) {
                const medication = report.medication.id;

                const medicationAtcCodes = await MedicationAtc.findAll({
                    attributes: ['atc_id'],
                    where: {
                        medication_id: medication
                    }
                });

                const atcIds = medicationAtcCodes.map(item => item.atc_id);

                const allergiesCodeI18nData = await AtcI18n.findAll({
                    attributes: ['display'],
                    where: {
                        atc_id: atcIds[0]
                    }
                });

                if (allergiesCodeI18nData && allergiesCodeI18nData.length > 0) {
                    atc_medications = {
                        translations: allergiesCodeI18nData[1].dataValues.display
                    };
                }
            }

            return {
                observation: report.observation,
                code: report.code,
                atc_medications: atc_medications
            };
        }));

        return patientDataList;

    } catch (err) {
        console.error('Error get allergies patient from model: ->', err);
        throw err;
    }
}

async function getEpisodeOfcareByUuid(uuidData) {
    try {

        const data = await EpisodeOfCare.findOne({
            attributes: ['id'],
            where: {
                uuid: uuidData
            },
            order: [['id', 'DESC']]
        })

        return data;

    } catch (err) {
        console.error('Error get epsiode patient from model: ->', err);
        throw err;
    }
}

async function getPatientByEpisode(uuidEpisode) {
    try {
        const data = await Patient.findOne({
            attributes: ['id', 'uuid', 'birth_date'],
            include: [
                {
                    model: MedicalService,
                    attributes: ['id'],
                    required: true,
                    include: [
                        {
                            model: EpisodeOfCare,
                            attributes: [],
                            where: {
                                uuid: uuidEpisode
                            },
                            required: true
                        }
                    ]
                },
                {
                    model: AdministrativeGender,
                    attributes: ['symbol']

                }
            ]
        });

        return data;

    } catch (err) {
        console.error('Error get patient by episode from model: ->', err);
        throw err;
    }
}

async function dataPatientForSearch(criteria) {
    try {
        let query = `
                    WITH resent_episode AS (SELECT *
                                            FROM episode_of_care
                                            ORDER BY id DESC, period_start::DATE DESC),
                        paient_data AS (SELECT patient.uuid                                                               AS uuid,
                                                patient_id,
                                                rp.uuid                                                                   AS id_episode_search,
                                                CONCAT(TRIM(first_name), ' ', TRIM(last_name))                            AS name,
                                                ms.history_clinic                                                         AS hc,
                                                rp.bed                                                                    AS bed,
                                                rp.code_episode                                                           AS ep,
                                                rp.uuid                                                                   AS code_episode_of_care,
                                                ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY rp.id DESC) AS rn
                                        FROM patient
                                                INNER JOIN public.medical_service ms ON patient.id = ms.patient_id
                                                INNER JOIN resent_episode rp ON rp.medical_service_id = ms.id)
                    SELECT *
                    FROM paient_data
                    WHERE rn = 1
        `;

        const whereClauses = [];
        const replacements = {};

        if (criteria.name) {
            whereClauses.push(`name ILIKE :name`);
            replacements.name = `%${criteria.name}%`;
        }
        if (criteria.hc) {
            whereClauses.push(`hc ILIKE :hc`);
            replacements.hc = `%${criteria.hc}%`;
        }
        if (criteria.bed) {
            whereClauses.push(`bed ILIKE :bed`);
            replacements.bed = `%${criteria.bed}%`;
        }
        if (criteria.ep) {
            whereClauses.push(`ep ILIKE :ep`);
            replacements.ep = `%${criteria.ep}%`;
        }
        if (whereClauses.length > 0) {
            query += ' AND ' + whereClauses.join(' AND ');
        }

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error get list patient origin from model: ->', error);
        throw error;
    }
}

async function searchPatientForOptions(crit) {
    try {
        const data = await Patient.findAll({
            attributes: [
                'uuid',
                [fn('trim', col('identification')), 'identification'],
                [fn('concat', fn('trim', col('first_name')), ' ', fn('trim', col('last_name')), ' ', fn('trim', col('identification'))), 'full_name']
            ],
            where: where(
                fn('concat', fn('trim', col('first_name')), ' ', fn('trim', col('second_name')), ' ', fn('trim', col('identification'))),
                {
                    [Op.iLike]: `%${crit}%`
                }
            )
        });

        return data;

    } catch (err) {
        console.error('Error origin model SearchPatientChain: ->', err);
        throw err;
    }
}

async function getPatientIdByCode(uuid) {
    try {
        // 1. Intentamos buscar si es un PACIENTE
        let data = await Patient.findOne({
            attributes: ['id'],
            where: { uuid: uuid }
        });

        if (data) return data;

        // 2. Si no, buscamos el EPISODIO
        console.log("🔍 Buscando Paciente a través del Episodio:", uuid);
        const episode = await EpisodeOfCare.findOne({
            where: { uuid: uuid }
        });

        if (episode) {
            // Log para ver qué columnas tiene realmente tu tabla EpisodeOfCare
            console.log("📊 Datos reales del Episodio 99:", episode.dataValues);

            // Intentamos obtener el ID del servicio médico (puede llamarse de varias formas)
            const serviceId = episode.medical_service_id || episode.id_medical_service || episode.medicalServiceId;

            if (serviceId) {
                // Buscamos el servicio médico directamente
                const service = await MedicalService.findOne({
                    where: { id: serviceId }
                });

                if (service) {
                    const patientId = service.patient_id || service.id_patient;
                    console.log("✅ Paciente encontrado con ID:", patientId);
                    return { id: patientId };
                }
            }
            console.error("❌ El episodio no tiene un medical_service_id válido o el servicio no existe.");
        }

        return null;
    } catch (err) {
        console.error('Error en getPatientIdByCode:', err);
        throw err;
    }
}

export {
    getPatientsData,
    createDataPatientFromDataHospital,
    getDetailsPatient, getPatientAlertsByUuid,
    getAllTotalPatients,
    searchGenderByPatient,
    searchDiagnosisByCode,
    searchMedicationByAllergy,
    getDiagnosisByService,
    getAllergiesByService,
    getAllergies,
    getEpisodeOfcareByUuid,
    getPatientByEpisode,
    dataPatientForSearch,
    getAllActiveTotalPatients,
    getPatientsDataPharmacist,
    searchPatientForOptions,
    getPatientIdByCode,
    getPatientAlertsGenerateByUuid
}
