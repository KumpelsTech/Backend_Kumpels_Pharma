CREATE OR REPLACE FUNCTION get_patient_id_by_episode_of_care(episode_of_care_id BIGINT)
    RETURNS BIGINT AS
$$
DECLARE
    patient_id BIGINT;
BEGIN
    SELECT p.id
    INTO patient_id
    FROM patient p
             INNER JOIN public.medical_service ms ON p.id = ms.patient_id
             INNER JOIN public.episode_of_care eoc ON ms.id = eoc.medical_service_id
    WHERE eoc.id = episode_of_care_id
    LIMIT 1;

    RETURN patient_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE trigger_logs
(
    id              SERIAL PRIMARY KEY,
    log_time        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    log_message     TEXT,
    additional_info JSONB
);

------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_alert_duplicate(episode_id BIGINT, new_medication BIGINT, level TEXT)
    RETURNS TABLE
            (
                first_medication  BIGINT,
                second_medication BIGINT
            )
AS
$$
DECLARE
    levels CONSTANT jsonb := '{
        "1": 1,
        "2": 3,
        "3": 4,
        "4": 5,
        "5": 7
    }';
BEGIN
    -- Log start of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Starting verify_alert_duplicate function',
            jsonb_build_object('episode_id', episode_id, 'new_medication', new_medication, 'level', level));

    RETURN QUERY
        WITH new_medication_cte AS (SELECT LEFT(a.code, (levels ->> level)::int) AS first_characters,
                                           m.id                     AS medication_id
                                    FROM public.medication m
                                             INNER JOIN public.medication_atc ma
                                                        ON m.id = ma.medication_id
                                             INNER JOIN public.atc a ON a.id = ma.atc_id
                                    WHERE m.id = new_medication),
             all_prescription_cte AS (SELECT LEFT(a.code,(levels ->> level)::int) AS first_characters,
                                             mr.medication_id         AS medication_id
                                      FROM medication_request mr
                                               INNER JOIN public.medication m ON m.id = mr.medication_id
                                               INNER JOIN public.medication_atc ma ON m.id = ma.medication_id
                                               INNER JOIN public.atc a ON a.id = ma.atc_id
                                      WHERE mr.episode_of_care_id = episode_id
                                        AND TO_DATE(mr.date_end, 'DD-MM-YYYY') >= current_date),
             duplicate_medication_cte AS (SELECT ap.medication_id AS first_medication,
                                                 nm.medication_id AS second_medication
                                          FROM all_prescription_cte ap
                                                   INNER JOIN new_medication_cte nm ON nm.first_characters = ap.first_characters)
        SELECT *
        FROM duplicate_medication_cte AS cte
        GROUP BY cte.first_medication,
                 cte.second_medication;

    -- Log end of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Ending verify_alert_duplicate function',
            jsonb_build_object('episode_id', episode_id, 'new_medication', new_medication, 'level', level));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION alert_duplicate()
    RETURNS TRIGGER AS
$$
DECLARE
    new_medication    BIGINT;
    episode_of_care   BIGINT;
    patient_id        BIGINT;
    group_id          RECORD;
    detected_issue_id BIGINT;
BEGIN
    IF (NEW.medication_id IS NOT NULL) AND TO_DATE(NEW.date_end, 'DD-MM-YYYY') >= current_date THEN
        -- Log start of trigger
        INSERT INTO trigger_logs (log_message, additional_info)

        VALUES ('Starting alert_duplicate trigger',
                jsonb_build_object('medication_id', NEW.medication_id, 'episode_of_care_id', NEW.episode_of_care_id));

        new_medication := NEW.medication_id;
        episode_of_care := NEW.episode_of_care_id;
        FOR group_id IN
            SELECT *
            FROM verify_alert_duplicate(episode_of_care, new_medication, '3')
            LOOP
                patient_id := get_patient_id_by_episode_of_care(episode_of_care);

                -- Log detected issue insertion
                INSERT INTO trigger_logs (log_message, additional_info)
                VALUES ('Inserting into detected_issue',
                        jsonb_build_object('patient_id', patient_id, 'episode_of_care_id', episode_of_care,
                                           'new_medication', new_medication));

                INSERT INTO detected_issue (status_id, patient_id, identified_date_time, author_type, known_issue_id,
                                            created_at, updated_at)
                VALUES (1, patient_id, current_timestamp, 'SYSTEM', 26, current_timestamp, current_timestamp)
                RETURNING id INTO detected_issue_id;
                IF group_id.first_medication <> group_id.second_medication THEN
                    INSERT INTO detected_issue_implicated (detected_issue_id, implicated_type, implicated_id)
                    VALUES (detected_issue_id, 'App\Models\MedicationRequest', group_id.first_medication);
                    INSERT INTO detected_issue_implicated (detected_issue_id, implicated_type, implicated_id)
                    VALUES (detected_issue_id, 'App\Models\MedicationRequest', group_id.second_medication);
                ELSE
                    INSERT INTO detected_issue_implicated (detected_issue_id, implicated_type, implicated_id)
                    VALUES (detected_issue_id, 'App\Models\MedicationRequest', group_id.first_medication);
                END IF;
            END LOOP;

        -- Log end of trigger
        INSERT INTO trigger_logs (log_message, additional_info)
        VALUES ('Ending alert_duplicate trigger',
                jsonb_build_object('medication_id', NEW.medication_id, 'episode_of_care_id', NEW.episode_of_care_id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alert_duplicate
    BEFORE INSERT OR UPDATE OF medication_id, date_end
    ON medication_request
    FOR EACH ROW
EXECUTE FUNCTION alert_duplicate();

------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_alert_allergies(
    p_medication_id BIGINT,
    p_episode_of_care_id BIGINT,
    level TEXT
)
    RETURNS TABLE
            (
                first_medication  BIGINT,
                second_medication BIGINT
            )
    LANGUAGE plpgsql
AS
$$
DECLARE
    levels CONSTANT jsonb := '{
        "1": 1,
        "2": 3,
        "3": 4,
        "4": 5,
        "5": 7
    }';
BEGIN
    -- Log start of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Starting verify_alert_allergies function',
            jsonb_build_object('episode_of_care_id', p_episode_of_care_id, 'medication_id', p_medication_id, 'level',
                               level));

    RETURN QUERY
        WITH allergies_patient AS (SELECT LEFT(a.code, (levels ->> level)::int) AS first_characters, ma.medication_id
                                   FROM episode_of_care ep
                                            INNER JOIN public.medical_service ms ON ms.id = ep.medical_service_id
                                            INNER JOIN public.allergies a ON ms.id = a.medical_service_id
                                            INNER JOIN public.medication_atc ma ON a.medication_id = ma.medication_id
                                   WHERE ep.id = p_episode_of_care_id
                                     AND (a.observation = '' OR a.observation IS NULL)),
             medication AS (SELECT LEFT(a.code, (levels ->> level)::int) AS first_characters,
                                   mr.medication_id                      AS medication_id
                            FROM medication_request mr
                                     INNER JOIN public.medication m ON m.id = mr.medication_id
                                     INNER JOIN public.medication_atc ma ON m.id = ma.medication_id
                                     INNER JOIN public.atc a ON a.id = ma.atc_id
                            WHERE mr.medication_id = p_medication_id
                              AND TO_DATE(mr.date_end, 'DD-MM-YYYY') >= current_date
                              AND mr.episode_of_care_id = p_episode_of_care_id
                            GROUP BY first_characters, mr.medication_id),
             medication_with_allergies AS (SELECT medication.medication_id AS first_medication,
                                                  ap.medication_id         AS second_medication
                                           FROM medication
                                                    INNER JOIN allergies_patient ap
                                                               ON ap.first_characters = medication.first_characters)
        SELECT *
        FROM medication_with_allergies AS cte
        GROUP BY cte.first_medication, cte.second_medication;

    -- Log end of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Ending verify_alert_allergies function',
            jsonb_build_object('episode_of_care_id', p_episode_of_care_id, 'medication_id', p_medication_id, 'level',
                               level));
END;
$$;

CREATE OR REPLACE FUNCTION alert_allergies()
    RETURNS TRIGGER AS
$$
DECLARE
    new_medication    BIGINT;
    episode_of_care   BIGINT;
    patient_id        BIGINT;
    group_id          RECORD;
    detected_issue_id BIGINT;
BEGIN
    IF (NEW.medication_id IS NOT NULL) AND TO_DATE(NEW.date_end, 'DD-MM-YYYY') >= current_date THEN
        new_medication := NEW.medication_id;
        episode_of_care := NEW.episode_of_care_id;

        -- Log start of trigger
        INSERT INTO trigger_logs (log_message, additional_info)
        VALUES ('Starting alert_allergies trigger',
                jsonb_build_object('medication_id', NEW.medication_id, 'episode_of_care_id', NEW.episode_of_care_id));

        FOR group_id IN
            SELECT *
            FROM verify_alert_allergies(new_medication, episode_of_care, '3')
            LOOP
                patient_id := get_patient_id_by_episode_of_care(episode_of_care);

                -- Log detected issue insertion
                INSERT INTO trigger_logs (log_message, additional_info)
                VALUES ('Inserting into detected_issue',
                        jsonb_build_object('patient_id', patient_id, 'episode_of_care_id', episode_of_care,
                                           'new_medication', new_medication));

                INSERT INTO detected_issue (status_id, patient_id, identified_date_time, author_type, known_issue_id,
                                            created_at, updated_at)
                VALUES (1, patient_id, current_timestamp, 'SYSTEM', 31, current_timestamp, current_timestamp)
                RETURNING id INTO detected_issue_id;

                -- Insert implicated medications
                IF group_id.first_medication <> group_id.second_medication THEN
                    INSERT INTO detected_issue_implicated (detected_issue_id, implicated_type, implicated_id)
                    VALUES (detected_issue_id, 'App\Models\MedicationRequest', group_id.first_medication);
                    INSERT INTO detected_issue_implicated (detected_issue_id, implicated_type, implicated_id)
                    VALUES (detected_issue_id, 'App\Models\MedicationRequest', group_id.second_medication);
                ELSE
                    INSERT INTO detected_issue_implicated (detected_issue_id, implicated_type, implicated_id)
                    VALUES (detected_issue_id, 'App\Models\MedicationRequest', group_id.first_medication);
                END IF;
            END LOOP;

        -- Log end of trigger
        INSERT INTO trigger_logs (log_message, additional_info)
        VALUES ('Ending alert_allergies trigger',
                jsonb_build_object('medication_id', NEW.medication_id, 'episode_of_care_id', NEW.episode_of_care_id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alert_allergies
    AFTER INSERT OR UPDATE OF medication_id, date_end
    ON medication_request
    FOR EACH ROW
EXECUTE FUNCTION alert_allergies();

------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_alert_interaction_or_drug(
    p_medication_id BIGINT,
    p_episode_of_care_id BIGINT
)
    RETURNS TABLE
            (
                group_implicated BIGINT
            )
    LANGUAGE plpgsql
AS
$$
BEGIN
    -- Log start of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Starting verify_alert_interaction_or_drug function',
            jsonb_build_object('episode_of_care_id', p_episode_of_care_id, 'medication_id', p_medication_id));

    RETURN QUERY
        WITH medication_active_prescription AS (SELECT medication_request.medication_id
                                                FROM medication_request
                                                WHERE medication_request.episode_of_care_id = p_episode_of_care_id
                                                  AND TO_DATE(date_end, 'DD-MM-YYYY') >= current_date
                                                  AND medication_id IS NOT NULL),
             medication_active_with_alerts AS (SELECT kig.id, kii.implicated_id AS id_medication
                                               FROM known_issue
                                                        INNER JOIN public.known_issue_category kic ON kic.id = known_issue.code_id
                                                        INNER JOIN public.known_issue_group kig ON known_issue.id = kig.known_issue_id
                                                        INNER JOIN public.known_issue_implicated kii ON kig.id = kii.known_issue_group_id
                                                        INNER JOIN medication_active_prescription ma
                                                                   ON ma.medication_id = kii.implicated_id
                                               WHERE kic.id = 1),
             build_comparation AS (SELECT kig.id,
                                          kig.id                                   AS group_implicated,
                                          mawa.id_medication,
                                          STRING_AGG(kii.implicated_id::TEXT, ',') AS combination_interaction
                                   FROM known_issue ku
                                            INNER JOIN public.known_issue_category kic ON kic.id = ku.code_id
                                            INNER JOIN public.known_issue_group kig ON ku.id = kig.known_issue_id
                                            INNER JOIN public.known_issue_implicated kii ON kig.id = kii.known_issue_group_id
                                            INNER JOIN medication_active_with_alerts mawa ON mawa.id = kig.id
                                   WHERE kic.id = 1
                                   GROUP BY mawa.id_medication, kic.code, kig.id)
        SELECT bc.group_implicated
        FROM build_comparation bc
        WHERE bc.combination_interaction ILIKE '%' || p_medication_id::TEXT || '%'
          AND bc.id_medication <> p_medication_id
        ORDER BY bc.id;

    -- Log end of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Ending verify_alert_interaction_or_drug function',
            jsonb_build_object('episode_of_care_id', p_episode_of_care_id, 'medication_id', p_medication_id));
END;
$$;

CREATE OR REPLACE FUNCTION alert_interaction_or_drug()
    RETURNS TRIGGER AS
$$
DECLARE
    new_medication  BIGINT;
    episode_of_care BIGINT;
    patient_id      BIGINT;
    group_id        BIGINT;
    k_issue_id      BIGINT;
BEGIN
    IF (NEW.medication_id IS NOT NULL) AND TO_DATE(NEW.date_end, 'DD-MM-YYYY') >= current_date THEN
        new_medication := NEW.medication_id;
        episode_of_care := NEW.episode_of_care_id;

        -- Log start of function
        INSERT INTO trigger_logs (log_message, additional_info)
        VALUES ('Starting alert_interaction_or_drug function',
                jsonb_build_object('medication_id', NEW.medication_id, 'episode_of_care_id', NEW.episode_of_care_id));

        FOR group_id IN
            SELECT group_implicated
            FROM verify_alert_interaction_or_drug(new_medication, episode_of_care)
            LOOP
                patient_id := get_patient_id_by_episode_of_care(episode_of_care);

                -- Log detected issue insertion
                INSERT INTO trigger_logs (log_message, additional_info)
                VALUES ('Inserting into detected_issue',
                        jsonb_build_object('patient_id', patient_id, 'episode_of_care_id', episode_of_care,
                                           'new_medication', new_medication));

                SELECT known_issue.id
                INTO k_issue_id
                FROM known_issue
                         INNER JOIN public.known_issue_group kig ON known_issue.id = kig.known_issue_id
                         INNER JOIN public.known_issue_implicated kii ON kig.id = kii.known_issue_group_id
                WHERE kig.id = group_id
                LIMIT 1;

                -- Insert into detected_issue
                INSERT INTO detected_issue (status_id, patient_id, identified_date_time, author_type, known_issue_id,
                                            created_at, updated_at, group_detected)
                VALUES (1, patient_id, current_timestamp, 'SYSTEM', k_issue_id, current_timestamp, current_timestamp,
                        group_id);
            END LOOP;

        -- Log end of function
        INSERT INTO trigger_logs (log_message, additional_info)
        VALUES ('Ending alert_interaction_or_drug function',
                jsonb_build_object('medication_id', NEW.medication_id, 'episode_of_care_id', NEW.episode_of_care_id));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alert_interaction_or_drug
    AFTER INSERT OR UPDATE OF medication_id, date_end
    ON medication_request
    FOR EACH ROW
EXECUTE FUNCTION alert_interaction_or_drug();

------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_alert_dosage(
    p_medication_id BIGINT,
    p_episode_of_care_id BIGINT
)
    RETURNS TABLE
            (
                alert_group BIGINT
            )
    LANGUAGE plpgsql
AS
$$
BEGIN
    -- Log start of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Starting verify_alert_dosage function',
            jsonb_build_object('medication_id', p_medication_id, 'episode_of_care_id', p_episode_of_care_id));

    RETURN QUERY
        WITH new_medication AS (SELECT mr.medication_id
                                FROM medication_request mr
                                         INNER JOIN public.medication m ON m.id = mr.medication_id
                                         INNER JOIN public.medication_atc ma ON m.id = ma.medication_id
                                         INNER JOIN public.atc a ON a.id = ma.atc_id
                                WHERE mr.medication_id = p_medication_id
                                  AND TO_DATE(mr.date_end, 'DD-MM-YYYY') >= current_date
                                  AND mr.episode_of_care_id = p_episode_of_care_id),
             medication_dosage_alerts AS (SELECT kii.implicated_id, kig.known_issue_id, kig.id AS group_id
                                          FROM known_issue
                                                   INNER JOIN public.known_issue_category kic on kic.id = known_issue.code_id
                                                   INNER JOIN public.known_issue_group kig on known_issue.id = kig.known_issue_id
                                                   INNER JOIN public.known_issue_implicated kii on kig.id = kii.known_issue_group_id
                                          WHERE kic.id = 5),
             alert_dosage AS (SELECT medication_dosage_alerts.group_id AS alert_group
                              FROM medication_dosage_alerts
                                       INNER JOIN new_medication nm
                                                  ON nm.medication_id = medication_dosage_alerts.implicated_id)
        SELECT alert_dosage.alert_group
        FROM alert_dosage;

    -- Log end of function
    INSERT INTO trigger_logs (log_message, additional_info)
    VALUES ('Ending verify_alert_dosage function',
            jsonb_build_object('medication_id', p_medication_id

------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_alerts_diagnosis_by_diagnosis(v_diagnosis_id bigint, v_medical_service bigint)
    returns TABLE(alert_id bigint, group_id bigint)
    language plpgsql
as
$$
BEGIN
    RETURN QUERY
        WITH new_diagnosis AS (SELECT (SELECT LEFT(dc.code, 3)) AS code_report
                               FROM public.diagnosis_code dc
                               WHERE dc.id = v_diagnosis_id),
             medications_patient AS (SELECT a.code
                                     FROM medication_request
                                              INNER JOIN public.episode_of_care eoc
                                                         ON eoc.id = medication_request.episode_of_care_id
                                              INNER JOIN public.medical_service ms ON ms.id = eoc.medical_service_id
                                              INNER JOIN public.medication m ON m.id = medication_request.medication_id
                                              INNER JOIN public.medication_atc ma ON m.id = ma.medication_id
                                              INNER JOIN public.atc a ON a.id = ma.atc_id
                                     WHERE ms.id = v_medical_service
                                       AND TO_DATE(medication_request.date_end, 'DD-MM-YYYY') >= current_date),
             medication_alerts_diganosis AS (SELECT known_issue.id                                                                 AS alert_id,
                                                    kig.id                                                                         AS group_id,
                                                    MAX(CASE
                                                            WHEN kii.implicated_type = 'App\Models\DiagnosisCode'
                                                                THEN (SELECT diagnosis_code.code
                                                                      FROM diagnosis_code
                                                                      WHERE diagnosis_code.id = kii.implicated_id) END)            AS diagnosis,
                                                    MAX(CASE
                                                            WHEN kii.implicated_type = 'App\Models\Medication'
                                                                THEN (SELECT a2.code
                                                                      FROM medication_atc
                                                                               INNER JOIN public.atc a2 ON a2.id = medication_atc.atc_id
                                                                      WHERE medication_atc.medication_id = kii.implicated_id) END) AS medication
                                             FROM known_issue
                                                      INNER JOIN public.known_issue_category kic ON kic.id = known_issue.code_id
                                                      INNER JOIN public.known_issue_group kig ON known_issue.id = kig.known_issue_id
                                                      INNER JOIN public.known_issue_implicated kii ON kig.id = kii.known_issue_group_id
                                             WHERE kic.id = 4
                                             GROUP BY kic.id, known_issue.id, kig.id),
             diagnosis_with_alert AS (SELECT mad.alert_id,
                                             mad.group_id                    AS group_id,
                                             new_diagnosis.code_report       AS new_med,
                                             mad.medication                  As med_imp,
                                             (SELECT LEFT(mad.diagnosis, 3)) AS diag_imp
                                      FROM new_diagnosis
                                               INNER JOIN medication_alerts_diganosis mad
                                                          ON mad.diagnosis::TEXT = new_diagnosis.code_report::TEXT),
             diagnosis_with_alert_act AS (SELECT dwa.alert_id AS alert_id, dwa.group_id AS group_id
                                          FROM diagnosis_with_alert dwa
                                                   INNER JOIN medications_patient mp ON mp.code = dwa.med_imp)
        SELECT dea.alert_id,
               dea.group_id
        FROM diagnosis_with_alert_act dea;
END;
$$;

CREATE OR REPLACE FUNCTION verify_alerts_diagnosis_by_medication(v_medication_id bigint, v_medical_service bigint)
    returns TABLE(alert_id bigint, group_id bigint)
    language plpgsql
as
$$
BEGIN
    RETURN QUERY
        WITH new_medication AS (SELECT a.code
                                FROM medication
                                         INNER JOIN public.medication_atc ma ON medication.id = ma.medication_id
                                         INNER JOIN public.atc a ON a.id = ma.atc_id
                                WHERE medication.id = v_medication_id),
             diagnosis_patient AS (SELECT (SELECT LEFT(dc.code, 3)) AS code_report
                                   FROM report_diagnosis
                                            INNER JOIN public.diagnosis_code dc ON report_diagnosis.diagnosis_code_id = dc.id
                                   WHERE report_diagnosis.medical_service_id = v_medical_service),
             medication_alerts_diganosis AS (SELECT known_issue.id                                                                 AS alert_id,
                                                    kig.id                                                                         AS group_id,
                                                    MAX(CASE
                                                            WHEN kii.implicated_type = 'App\Models\DiagnosisCode'
                                                                THEN (SELECT diagnosis_code.code
                                                                      FROM diagnosis_code
                                                                      WHERE diagnosis_code.id = kii.implicated_id) END)            AS diagnosis,
                                                    MAX(CASE
                                                            WHEN kii.implicated_type = 'App\Models\Medication'
                                                                THEN (SELECT a2.code
                                                                      FROM medication_atc
                                                                               INNER JOIN public.atc a2 ON a2.id = medication_atc.atc_id
                                                                      WHERE medication_atc.medication_id = kii.implicated_id) END) AS medication
                                             FROM known_issue
                                                      INNER JOIN public.known_issue_category kic ON kic.id = known_issue.code_id
                                                      INNER JOIN public.known_issue_group kig ON known_issue.id = kig.known_issue_id
                                                      INNER JOIN public.known_issue_implicated kii ON kig.id = kii.known_issue_group_id
                                             WHERE kic.id = 4
                                             GROUP BY kic.id, known_issue.id, kig.id),
             medication_with_alert AS (SELECT mad.alert_id,
                                              mad.group_id                    AS group_id,
                                              new_medication.code             AS new_med,
                                              mad.medication                  As med_imp,
                                              (SELECT LEFT(mad.diagnosis, 3)) AS diag_imp
                                       FROM new_medication
                                                INNER JOIN medication_alerts_diganosis mad
                                                           ON mad.medication::TEXT = new_medication.code::TEXT),
             diagnosis_with_alert AS (SELECT mwa.alert_id AS alert_id,
                                             mwa.group_id AS group_id
                                      FROM medication_with_alert mwa
                                               INNER JOIN diagnosis_patient dp ON dp.code_report = mwa.diag_imp)
        SELECT dwa.alert_id, dwa.group_id
        FROM diagnosis_with_alert dwa;

END;
$$;

CREATE OR REPLACE FUNCTION alert_diagnosis_by_diagnosis() returns trigger
    language plpgsql
as
$$
DECLARE
    v_new_diagnosis   BIGINT;
    v_medical_service BIGINT;
    v_patient_id      BIGINT;
    v_alert_id          BIGINT;
    v_group_id          BIGINT;
    has_alerts        BOOLEAN := FALSE;
BEGIN

    v_medical_service := NEW.medical_service_id;
    v_new_diagnosis := NEW.diagnosis_code_id;

    SELECT p.id
    INTO v_patient_id
    FROM medical_service
             INNER JOIN patient p ON medical_service.patient_id = p.id
    WHERE medical_service.id = v_medical_service;

    FOR v_alert_id, v_group_id IN
        SELECT alert_id, group_id
        FROM verify_alerts_diagnosis_by_diagnosis(v_new_diagnosis, v_medical_service)
        LOOP
            has_alerts := TRUE;
            INSERT INTO detected_issue (status_id, patient_id, identified_date_time, author_type, known_issue_id,
                                        created_at, updated_at, group_detected)
            VALUES (1, v_patient_id, current_timestamp, 'SYSTEM', v_alert_id, current_timestamp, current_timestamp, v_group_id);
        END LOOP;
    IF NOT has_alerts THEN
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION alert_diagnosis_by_medication() returns trigger
    language plpgsql
as
$$
DECLARE
    new_medication    BIGINT;
    v_medical_service BIGINT;
    v_patient_id      BIGINT;
    v_alert_id          BIGINT;
    v_group_id          BIGINT;
    has_alerts        BOOLEAN := FALSE;
BEGIN
    IF (NEW.medication_id IS NOT NULL) AND TO_DATE(NEW.date_end, 'DD-MM-YYYY') >= current_date THEN

        new_medication := NEW.medication_id;

        SELECT medical_service.id, p.id
        INTO v_medical_service, v_patient_id
        FROM medical_service
                 INNER JOIN patient p ON medical_service.patient_id = p.id
                 INNER JOIN public.episode_of_care eoc ON medical_service.id = eoc.medical_service_id
        WHERE eoc.id = NEW.episode_of_care_id;

        FOR v_alert_id, v_group_id IN
            SELECT alert_id, group_id
            FROM verify_alerts_diagnosis_by_medication(new_medication, v_medical_service)
            LOOP
                has_alerts := TRUE;
                INSERT INTO detected_issue (status_id, patient_id, identified_date_time, author_type, known_issue_id,
                                            created_at, updated_at, group_detected)
                VALUES (1, v_patient_id, current_timestamp, 'SYSTEM', v_alert_id, current_timestamp, current_timestamp, v_group_id);
            END LOOP;
        IF NOT has_alerts THEN
            RETURN NEW;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alert_diagnosis_by_medication
    AFTER
        INSERT
        OR
        UPDATE
            OF medication_id,
            date_end
    ON medication_request
    FOR EACH ROW
EXECUTE FUNCTION alert_diagnosis_by_medication();

CREATE TRIGGER trg_alert_diagnosis_by_diagnosis
    AFTER
        INSERT
        OR
        UPDATE
            OF diagnosis_code_id
    ON report_diagnosis
    FOR EACH ROW
EXECUTE FUNCTION alert_diagnosis_by_diagnosis();


-- DROP TRIGGER IF EXISTS trg_alert_duplicate ON medication_request;

-- DROP TRIGGER IF EXISTS trg_alert_allergies ON medication_request;

-- DROP TRIGGER IF EXISTS trg_alert_interaction_or_drug ON medication_request;

-- DROP TRIGGER IF EXISTS trg_alert_dosage ON medication_request;

-- DROP TRIGGER IF EXISTS trg_alert_diagnosis_by_medication ON medication_request;

-- DROP TRIGGER IF EXISTS trg_alert_diagnosis_by_diagnosis ON report_diagnosis;
