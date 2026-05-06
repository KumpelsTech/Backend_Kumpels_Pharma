import { ActionFramework, DetectedIssue, DetectedIssueMitigation, DetectedIssueStatus, DetectedIssueStatusI18n, Intervene, KnownIssue, KnownIssueCategory, KnownIssueCategoryI18n, KnownIssueGenerate, KnownIssueGenerateImplicated, KnownIssueSeverity, KnownIssueSeverityI18n, Patient, ProcessStage, User } from './entities/entities.js';
import sequelize from '../config/db.js';

async function getAlertsPatientData(uuid_patient) {
    try {

        const issues = await DetectedIssue.findAll({
            attributes: [
                'id',
                'uuid',
                [sequelize.fn('TO_CHAR', sequelize.col('identified_date_time'), 'YYYY-MM-DD HH24:MI'), 'identified_date_time'],
                'author_type',
                'created_at'
            ],
            order: [
                ['id', 'DESC']
            ],
            include: [
                {
                    model: DetectedIssueStatus,
                    attributes: ['code'],
                    include: [{
                        model: DetectedIssueStatusI18n,
                        attributes: ['display'],
                        where: {
                            language_id: 2
                        }
                    }]
                },
                {
                    model: Patient,
                    attributes: [[sequelize.fn('CONCAT', sequelize.fn('TRIM', sequelize.col('first_name')), ' ', sequelize.fn('TRIM', sequelize.col('last_name'))), 'name']],
                    where: {
                        uuid: uuid_patient
                    }
                },
                {
                    model: KnownIssue,
                    attributes: ['detail'],
                    include: [
                        {
                            model: KnownIssueCategory,
                            attributes: ['code'],
                            include: [
                                {
                                    model: KnownIssueCategoryI18n,
                                    attributes: ['display'],
                                    where: {
                                        language_id: 2
                                    }
                                }
                            ]
                        },
                        {
                            model: KnownIssueSeverity,
                            attributes: ['code'],
                            include: [
                                {
                                    model: KnownIssueSeverityI18n,
                                    attributes: ['display'],
                                    where: {
                                        language_id: 2
                                    }
                                }
                            ]
                        }
                    ]
                }
            ],
        });

        return issues;

    } catch (error) {
        console.error('Error get alerts origin from model: ->', error);
        throw error;
    }
}

async function getAlertsByUUid(uuid_alert) {
    try {

        const issues = await DetectedIssue.findOne({
            attributes: [
                'id',
                'uuid',
                [sequelize.fn('TO_CHAR', sequelize.col('identified_date_time'), 'YYYY-MM-DD HH24:MI'), 'identified_date_time'],
                'author_type',
                'created_at'
            ],
            where: {
                uuid: uuid_alert
            },
            order: [
                ['id', 'DESC']
            ],
            include: [
                {
                    model: DetectedIssueStatus,
                    attributes: ['code'],
                    include: [{
                        model: DetectedIssueStatusI18n,
                        attributes: ['display'],
                        where: {
                            language_id: 2
                        }
                    }]
                },
                {
                    model: Patient,
                    attributes: [[sequelize.fn('CONCAT', sequelize.fn('TRIM', sequelize.col('first_name')), ' ', sequelize.fn('TRIM', sequelize.col('last_name'))), 'name']]
                },
                {
                    model: KnownIssue,
                    attributes: ['detail'],
                    include: [
                        {
                            model: KnownIssueCategory,
                            attributes: ['id', 'code'],
                            include: [
                                {
                                    model: KnownIssueCategoryI18n,
                                    attributes: ['display'],
                                    where: {
                                        language_id: 2
                                    }
                                }
                            ]
                        },
                        {
                            model: KnownIssueSeverity,
                            attributes: ['code'],
                            include: [
                                {
                                    model: KnownIssueSeverityI18n,
                                    attributes: ['display'],
                                    where: {
                                        language_id: 2
                                    }
                                }
                            ]
                        }
                    ]
                }
            ],
        });

        if (!issues) {

            const issues = await KnownIssueGenerate.findOne({
                attributes: [
                    'id',
                    'uuid',
                    [sequelize.fn('TO_CHAR', sequelize.col('date_report'), 'YYYY-MM-DD'), 'identified_date_time'],
                    'warning',
                    'created_at'
                ],
                where: {
                    uuid: uuid_alert
                },
                order: [
                    ['id', 'DESC']
                ],
                include: [
                    {
                        model: Patient,
                        attributes: [[sequelize.fn('CONCAT', sequelize.fn('TRIM', sequelize.col('patient.first_name')), ' ', sequelize.fn('TRIM', sequelize.col('patient.last_name'))), 'name']]
                    },
                    {
                        model: KnownIssueCategory,
                        attributes: ['code'],
                        include: [
                            {
                                model: KnownIssueCategoryI18n,
                                attributes: ['display'],
                                where: {
                                    language_id: 2
                                }
                            }
                        ]
                    },
                    {
                        model: KnownIssueSeverity,
                        attributes: ['code'],
                        include: [
                            {
                                model: KnownIssueSeverityI18n,
                                attributes: ['display'],
                                where: {
                                    language_id: 2
                                }
                            }
                        ]
                    },
                    {
                        model: DetectedIssueStatus,
                        attributes: ['code'],
                        include: [{
                            model: DetectedIssueStatusI18n,
                            attributes: ['display'],
                            where: {
                                language_id: 2
                            }
                        }]
                    },
                    {
                        model: User,
                        attributes: [[sequelize.fn('CONCAT', sequelize.fn('TRIM', sequelize.col('user.name')), ' ', sequelize.fn('TRIM', sequelize.col('user.last_name'))), 'name_user']]
                    }
                ],
            });

            return issues
        }

        return issues;

    } catch (error) {
        console.error('Error  getAlertsByUUid origin from model: ->', error);
        throw error;
    }
}

async function getAlertsPatientDataGenerate(uuid_patient) {
    try {
        const issues = await KnownIssueGenerate.findAll({
            attributes: [
                'id',
                'uuid',
                [sequelize.fn('TO_CHAR', sequelize.col('date_report'), 'YYYY-MM-DD'), 'identified_date_time'],
                'warning',
                'created_at'
            ],
            order: [
                ['id', 'DESC']
            ],
            include: [
                {
                    model: Patient,
                    attributes: [[sequelize.fn('CONCAT', sequelize.fn('TRIM', sequelize.col('patient.first_name')), ' ', sequelize.fn('TRIM', sequelize.col('patient.last_name'))), 'name']],
                    where: {
                        uuid: uuid_patient
                    }
                },
                {
                    model: KnownIssueCategory,
                    attributes: ['code'],
                    include: [
                        {
                            model: KnownIssueCategoryI18n,
                            attributes: ['display'],
                            where: {
                                language_id: 2
                            }
                        }
                    ]
                },
                {
                    model: KnownIssueSeverity,
                    attributes: ['code'],
                    include: [
                        {
                            model: KnownIssueSeverityI18n,
                            attributes: ['display'],
                            where: {
                                language_id: 2
                            }
                        }
                    ]
                },
                {
                    model: DetectedIssueStatus,
                    attributes: ['code'],
                    include: [{
                        model: DetectedIssueStatusI18n,
                        attributes: ['display'],
                        where: {
                            language_id: 2
                        }
                    }]
                },
                {
                    model: User,
                    attributes: [[sequelize.fn('CONCAT', sequelize.fn('TRIM', sequelize.col('user.name')), ' ', sequelize.fn('TRIM', sequelize.col('user.last_name'))), 'name_user']]
                }
            ],
        });

        return issues;

    } catch (error) {
        console.error('Error get alerts origin from model: ->', error);
        throw error;
    }
}

async function optionTypeAlert() {
    try {
        const data = await KnownIssueCategory.findAll({
            attributes: ['id'],
            include: [{
                model: KnownIssueCategoryI18n,
                attributes: ['display'],
                where: { language_id: 2 }
            }]
        });

        return data.map(item => ({
            id: item.id,
            display: item.KnownIssueCategoryI18ns[0].display
        }));

    } catch (error) {
        console.error('Error en optionTypeAlert:', error);
        throw error;
    }
}

async function optionLevelRiskAlert() {
    try {
        const data = await KnownIssueSeverity.findAll({
            attributes: ['id'],
            include: [{
                model: KnownIssueSeverityI18n,
                attributes: ['display'],
                where: { language_id: 2 }
            }]
        });

        return data.map(item => ({
            id: item.id,
            display: item.KnownIssueSeverityI18ns[0].display
        }));

    } catch (error) {
        console.error('Error en optionLevelRiskAlert:', error);
        throw error;
    }
}

async function optionStatusAlert() {
    try {
        const data = await DetectedIssueStatus.findAll({
            attributes: ['id'],
            include: [{
                model: DetectedIssueStatusI18n,
                attributes: ['display'],
                where: { language_id: 2 }
            }]
        });

        return data.map(item => ({
            id: item.id,
            display: item.DetectedIssueStatusI18ns[0].display
        }));

    } catch (error) {
        console.error('Error en optionStatusAlert:', error);
        throw error;
    }
}

async function createKnownIssueGenerate(data) {
    try {
        const newKnownIssueGenerate = await KnownIssueGenerate.create({
            warning: data.adver,
            date_report: data.date_report,
            user_id: data.id_report,
            level_id: data.level_alert,
            patient_id: data.patient_id,
            status_id: data.status_alert,
            type_id: data.type_alert
        });

        return newKnownIssueGenerate;
    } catch (error) {
        console.error('Error al crear KnownIssueGenerate:', error);
        throw error;
    }
}

async function createIntervention(data) {
    try {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];

        const newIntervention = await DetectedIssueMitigation.create({
            detected_issue_id: data.alert,
            comment: data.comment,
            date: formattedDate,
            author_type: 'App\Models\Practitioner',
            author_id: data.user,
            process_stage_id: data.stepAlert,
            intervene_id: data.intervention,
            action_framework_id: data.action,
            detected_issue_status_id: data.status
        });

        return newIntervention;

    } catch (error) {
        console.error('Error al crear KnownIssueGenerate:', error);
        throw error;
    }
}

async function createKnownIssueGenerateImplicated(knownIssueGenerateId, agentId) {
    try {
        const newKnownIssueGenerateImplicated = await KnownIssueGenerateImplicated.create({
            known_issue_generate_id: knownIssueGenerateId,
            medication_id: parseInt(agentId),
            created_at: new Date(),
            updated_at: new Date()
        });

        return newKnownIssueGenerateImplicated;
    } catch (error) {
        console.error('Error al crear KnownIssueGenerateImplicated:', error);
        throw error;
    }
}

async function getCombinedAlerts(patientUuid) {
    try {
        const sqlQuery = `
            SELECT di.uuid AS code, CONCAT(di.uuid, ' - ', kici18n.display) AS alert, 'detected_issue' AS source
            FROM patient
                INNER JOIN detected_issue di ON patient.id = di.patient_id
                INNER JOIN known_issue ki ON ki.id = di.known_issue_id
                INNER JOIN known_issue_category kic ON kic.id = ki.code_id
                INNER JOIN known_issue_category_i18n kici18n ON kic.id = kici18n.category_id
            WHERE kici18n.language_id = 2 AND patient.uuid = ?
            
            UNION ALL
            
            SELECT kig.uuid AS code, CONCAT(kig.uuid, ' - ', kici18n.display) AS alert, 'known_issue_generate' AS source
            FROM patient
                INNER JOIN known_issue_generate kig ON patient.id = kig.patient_id
                INNER JOIN known_issue_category kic ON kic.id = kig.type_id
                INNER JOIN known_issue_category_i18n kici18n ON kic.id = kici18n.category_id
            WHERE kici18n.language_id = 2 AND patient.uuid = ?
        `;

        const results = await sequelize.query(sqlQuery, {
            replacements: [patientUuid, patientUuid],
            type: sequelize.QueryTypes.SELECT
        });

        return results;
    } catch (error) {
        console.error('Error getCombinedAlerts origin model -> :', error);
        throw error;
    }
}

async function getMedicationsFromKnownIssueGenerate(knownIssueGenerateId) {
    try {
        const sqlQuery = `
                        SELECT CONCAT(medication.code, ' - ', ai18n.display, ' - ', COALESCE(u.symbol, 'sin unidad')) AS medicationInfo
                        FROM medication
                                INNER JOIN known_issue_generate_implicated kigi ON medication.id = kigi.medication_id
                                INNER JOIN public.medication_atc ma ON medication.id = ma.medication_id
                                LEFT JOIN public.unit u ON u.id = medication.total_volume_unit_id
                                INNER JOIN public.atc a ON a.id = ma.atc_id
                                INNER JOIN public.atc_i18n ai18n ON a.id = ai18n.atc_id
                        WHERE ai18n.language_id = 2
                        AND kigi.known_issue_generate_id = ?;
        `;

        const results = await sequelize.query(sqlQuery, {
            replacements: [knownIssueGenerateId],
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error getMedicationsFromKnownIssueGenerate origin model -> :', error);
        throw error;
    }
}

async function getMedicationsFromDetectedIssue(detectedIssueId) {
    try {
        const sqlQuery = `
            SELECT CONCAT(medication.code, ' - ', ai18n.display, ' - ', COALESCE(u.symbol, 'sin unidad')) AS medicationInfo
            FROM medication
                INNER JOIN detected_issue_implicated dii ON medication.id = dii.implicated_id
                INNER JOIN public.medication_atc ma ON medication.id = ma.medication_id
                LEFT JOIN public.unit u ON u.id = medication.total_volume_unit_id
                INNER JOIN public.atc a ON a.id = ma.atc_id
                INNER JOIN public.atc_i18n ai18n ON a.id = ai18n.atc_id
            WHERE ai18n.language_id = 2
            AND dii.detected_issue_id = ?
        `;

        const results = await sequelize.query(sqlQuery, {
            replacements: [detectedIssueId],
            type: sequelize.QueryTypes.SELECT
        });

        return results;
    } catch (error) {
        console.error('Error getMedicationsFromDetectedIssue origin model -> :', error);
        throw error;
    }
}

async function getMedicationsFromDetectedIssueAndKnowIssue(detectedIssueId) {
    try {
        const sqlQuery = `
                            SELECT CONCAT(m.code, ' - ', ai18n.display, ' - ', COALESCE(u.symbol, 'sin unidad')) AS medicationInfo, m.id
                            FROM detected_issue
                                    INNER JOIN public.known_issue ki ON ki.id = detected_issue.known_issue_id
                                    INNER JOIN public.known_issue_group kig ON ki.id = kig.known_issue_id
                                    INNER JOIN public.known_issue_implicated kii ON kii.known_issue_group_id = kig.id
                                    INNER JOIN public.medication m ON m.id = kii.implicated_id
                                    INNER JOIN public.medication_atc ma ON m.id = ma.medication_id
                                    LEFT JOIN public.unit u ON u.id = m.total_volume_unit_id
                                    INNER JOIN public.atc a ON a.id = ma.atc_id
                                    INNER JOIN public.atc_i18n ai18n ON a.id = ai18n.atc_id
                            WHERE detected_issue.id = ? AND detected_issue.group_detected = kig.id
                            AND ai18n.language_id = 2
                            GROUP BY m.id, m.code, ai18n.display, u.symbol;
        `;

        const results = await sequelize.query(sqlQuery, {
            replacements: [detectedIssueId],
            type: sequelize.QueryTypes.SELECT
        });

        return results;
    } catch (error) {
        console.error('Error getMedicationsFromDetectedIssue origin model -> :', error);
        throw error;
    }
}

async function getCodeKnownIssueGenerate(code) {
    try {

        const data = await KnownIssueGenerate.findOne({
            attributes: ['id'],
            where: {
                uuid: code
            }
        })

        return data;

    } catch (error) {
        console.error('Error getCodeKnownIssueGenerate origin model -> :', error);
        throw error;
    }
}

async function getCodeDetectedIssue(code) {
    try {

        const data = await DetectedIssue.findOne({
            attributes: ['id', 'group_detected'],
            where: {
                uuid: code
            }
        })

        return data;

    } catch (error) {
        console.error('Error getCodeDetectedIssue origin model -> :', error);
        throw error;
    }
}

async function getProcessStageOptions() {
    try {
        const data = await ProcessStage.findAll({
            attributes: ['id', 'option']
        });

        return data.map(item => ({
            id: item.id,
            display: item.option
        }));
    } catch (error) {
        console.error('Error en getProcessStageOptions:', error);
        throw error;
    }
}

async function getInterveneOptions() {
    try {
        const data = await Intervene.findAll({
            attributes: ['id', 'option']
        });

        return data.map(item => ({
            id: item.id,
            display: item.option
        }));
    } catch (error) {
        console.error('Error en getInterveneOptions:', error);
        throw error;
    }
}

async function getActionFrameworkOptions() {
    try {
        const data = await ActionFramework.findAll({
            attributes: ['id', 'option']
        });

        return data.map(item => ({
            id: item.id,
            display: item.option
        }));
    } catch (error) {
        console.error('Error en getActionFrameworkOptions:', error);
        throw error;
    }
}


async function getInterventionsFromAlert(detectedIssueId) {
    try {
        const sqlQuery = `
                        SELECT 
                            detected_issue_mitigation.uuid AS code,
                            af.option AS status,
                            disi18n.display AS action,
                            TO_CHAR(detected_issue_mitigation.date, 'YYYY-MM-DD') AS date
                        FROM detected_issue_mitigation
                        INNER JOIN public.detected_issue_status dis ON dis.id = detected_issue_mitigation.detected_issue_status_id
                        INNER JOIN public.detected_issue_status_i18n disi18n ON dis.id = disi18n.detected_issue_status_id
                        INNER JOIN public.action_framework af ON af.id = detected_issue_mitigation.action_framework_id
                        WHERE disi18n.language_id = 2 AND detected_issue_id = ?;
        `;

        const results = await sequelize.query(sqlQuery, {
            replacements: [detectedIssueId],
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error getInterventionsFromAlert origin model -> :', error);
        throw error;
    }
}

async function getInterventionByCode(code) {
    try {
        const sqlQuery = `
                        SELECT detected_issue_mitigation.uuid                                      AS code,
                            af.option                                                           AS status,
                            disi18n.display                                                     AS action,
                            ps.option                                                           AS step,
                            i.option                                                            AS intervene,
                            detected_issue_mitigation.comment                                   AS comment,
                            TO_CHAR(detected_issue_mitigation.date, 'YYYY-MM-DD')               AS date,
                            TO_CHAR(detected_issue_mitigation.created_at, 'YYYY-MM-DD HH24:MI') AS dateDetected
                        FROM detected_issue_mitigation
                                INNER JOIN public.detected_issue_status dis ON dis.id = detected_issue_mitigation.detected_issue_status_id
                                INNER JOIN public.detected_issue_status_i18n disi18n ON dis.id = disi18n.detected_issue_status_id
                                INNER JOIN public.action_framework af ON af.id = detected_issue_mitigation.action_framework_id
                                INNER JOIN public.intervene i on i.id = detected_issue_mitigation.intervene_id
                                INNER JOIN public.process_stage ps on ps.id = detected_issue_mitigation.process_stage_id
                        WHERE disi18n.language_id = 2
                        AND detected_issue_mitigation.uuid = ?;
        `;

        const results = await sequelize.query(sqlQuery, {
            replacements: [code],
            type: sequelize.QueryTypes.SELECT
        });

        return results;

    } catch (error) {
        console.error('Error getInterventionByCode origin model -> :', error);
        throw error;
    }
}


async function getInterventionData(patient_id) {
    try {
        const sqlQuery = `
                            WITH combined_uuids AS (SELECT kig.uuid, kici18n.display
                                                    FROM patient
                                                            INNER JOIN public.known_issue_generate kig ON patient.id = kig.patient_id
                                                            INNER JOIN public.known_issue_category k on k.id = kig.type_id
                                                            INNER JOIN public.known_issue_category_i18n kici18n on k.id = kici18n.category_id
                                                    WHERE patient.id = ?
                                                    AND kici18n.language_id = 2
                                                    UNION
                                                    SELECT di.uuid, kici18n.display
                                                    FROM patient
                                                            INNER JOIN detected_issue di ON patient.id = di.patient_id
                                                            INNER JOIN public.known_issue ki on ki.id = di.known_issue_id
                                                            INNER JOIN public.known_issue_category k on k.id = ki.code_id
                                                            INNER JOIN public.known_issue_category_i18n kici18n on k.id = kici18n.category_id
                                                    WHERE patient.id = ?
                                                    AND kici18n.language_id = 2)
                            SELECT 
                                TO_CHAR(dim.created_at, 'YYYY-MM-DD HH24:MI') AS date_detected_system,
                                dim.comment,
                                TO_CHAR(dim.date, 'YYYY-MM-DD')         AS date_detected,
                                ps.option                               AS step_process,
                                i.option                                AS intervene,
                                af.option                               AS action,
                                disi18n.display                         AS status,
                                dim.uuid,
                                dim.detected_issue_id                   AS alert_id,
                                CONCAT(TRIM(u.name), TRIM(u.last_name)) AS name_int,
                                cu.display
                            FROM detected_issue_mitigation dim
                                    INNER JOIN users u ON u.id = dim.author_id
                                    INNER JOIN public.process_stage ps ON ps.id = dim.process_stage_id
                                    INNER JOIN public.intervene i ON i.id = dim.intervene_id
                                    INNER JOIN public.action_framework af ON af.id = dim.action_framework_id
                                    INNER JOIN public.detected_issue_status dis ON dis.id = dim.detected_issue_status_id
                                    INNER JOIN combined_uuids cu ON cu.uuid = dim.detected_issue_id
                                    INNER JOIN public.detected_issue_status_i18n disi18n on dis.id = disi18n.detected_issue_status_id
                            WHERE disi18n.language_id = 2
                            ORDER BY dim.created_at DESC;
        `;

        const results = await sequelize.query(sqlQuery, {
            replacements: [patient_id, patient_id],
            type: sequelize.QueryTypes.SELECT
        });

        return results

    } catch (error) {
        console.error('Error getInterventionData origin model -> :', error);
        throw error;
    }
}

export {
    getAlertsPatientData,
    optionTypeAlert,
    optionLevelRiskAlert,
    optionStatusAlert,
    createKnownIssueGenerate,
    createKnownIssueGenerateImplicated,
    getCombinedAlerts,
    getMedicationsFromDetectedIssue,
    getMedicationsFromKnownIssueGenerate,
    getCodeKnownIssueGenerate,
    getCodeDetectedIssue,
    getProcessStageOptions,
    getInterveneOptions,
    getActionFrameworkOptions,
    getAlertsPatientDataGenerate,
    createIntervention,
    getInterventionData,
    getMedicationsFromDetectedIssueAndKnowIssue,
    getInterventionsFromAlert,
    getAlertsByUUid,
    getInterventionByCode
}