import { DataTypes } from 'sequelize';
import sequelize from '../../config/db.js';


export const Language = sequelize.define('Language', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(2),
        allowNull: false
    },
    display: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'language',
    timestamps: false,
});

// ------------------------------------------------------------------------------------------


/**
 * Entidades del usuario, configuración de roles y permisos.
 * 
 */


// ------------------------------------------------------------------------------------------

export const User = sequelize.define('user', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type_identification: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    identification: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    second_email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    id_rol: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'role',
            key: 'id'
        }
    },
    id_token: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'personal_access_token',
            key: 'id'
        }
    }
}, {
    timestamps: true,
    underscored: true
});

export const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    guard_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'role',
    timestamps: true,
    underscored: true
});

export const Permission = sequelize.define('Permission', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    guard_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'permission',
    timestamps: true,
    underscored: true
});

export const RolePermission = sequelize.define('RolePermission', {
    permission_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'Permission',
            key: 'id'
        }
    },
    role_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'Role',
            key: 'id'
        }
    }
}, {
    tableName: 'role_permission',
    timestamps: true,
    underscored: true
});

export const PasswordReset = sequelize.define('PasswordReset', {
    token: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    generate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    used: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: false
    }

}, {
    tableName: 'password_reset',
    timestamps: false,
    underscored: true
});

// ------------------------------------------------------------------------------------------


/**
 * Entidades generalizadas del servicio.
 * 
 */


// ------------------------------------------------------------------------------------------

export const Organization = sequelize.define('organization', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    uuid: {
        type: DataTypes.CHAR(36)
    },
    name: {
        type: DataTypes.STRING(255)
    }
}, {
    tableName: 'organization',
    timestamps: false,
})

export const Specialty = sequelize.define('specialty', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'specialty',
    timestamps: true,
    underscored: true
});

// controllers/medicationsController.js

export async function createFlowMedication(loadData) {
    try {
        // Ya no necesitamos la función compleja formatToDateOnly, 
        // simplemente pasamos lo que venga a string.
        const allPrescriptions = loadData.data.flatMap(patient => {
            return (patient.prescripciones || []).map(presc => ({
                episode_id: String(patient.episode || ''),
                identification: String(patient.identification || ''),
                medication_code: String(presc.kumpels_code || ''),
                status: String(loadData.status || 'Activo'),
                route: String(presc.route || ''),
                dose_amount: String(presc.dose || ''),
                dose_unit: String(presc.dose_unit || ''),
                timing_frequency: String(presc.frequency || presc.frecuency || ''),
                date_start: String(presc.date_start || ''),
                date_end: String(presc.date_end || ''),
                unidentified_medication: presc.kumpels_code ? null : 'No identificado'
            }));
        });

        console.log(`📦 Preparados ${allPrescriptions.length} registros para la tabla auxiliar.`);

        // Insertamos todo en bloque (mucho más rápido y sin errores de tipo)
        await MedicationRequestAuxiliar.bulkCreate(allPrescriptions);

        return { message: 'Datos guardados en tabla auxiliar correctamente' };

    } catch (error) {
        console.error('Error cargando en tabla auxiliar:', error);
        throw error;
    }
}

// ------------------------------------------------------------------------------------------


/**
 * Entidades inherentes al paciente, al servicio médico que adquieren y al episodio de cuidado correspondiente.
 * 
 */


// ------------------------------------------------------------------------------------------

export const AdministrativeGender = sequelize.define('administrative_gender', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(255)
    },
    symbol: {
        type: DataTypes.STRING(2)
    }
}, {
    tableName: 'administrative_gender',
    timestamps: false,
    underscored: false
});

export const Patient = sequelize.define('patient', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    t_identification: {
        type: DataTypes.CHAR(5),
        allowNull: false
    },
    identification: {
        type: DataTypes.CHAR(20),
        allowNull: false,
        unique: true
    },
    first_name: {
        type: DataTypes.CHAR(50),
        allowNull: false
    },
    second_name: {
        type: DataTypes.CHAR(50)
    },
    last_name: {
        type: DataTypes.CHAR(50),
        allowNull: false
    },
    second_last_name: {
        type: DataTypes.CHAR(50)
    },
    birth_date: {
        type: DataTypes.DATE
    },
    gender_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'administrative_gender',
            key: 'id'
        }
    },
    id_alerts: {
        type: DataTypes.BIGINT
    },
    deceased_date_time: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'patient',
    timestamps: true,
    underscored: true
});

export const MedicalService = sequelize.define('medical_service', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    patient_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'patient',
            key: 'id'
        }
    },
    history_clinic: {
        type: DataTypes.CHAR(20),
        unique: true
    }
}, {
    tableName: 'medical_service',
    timestamps: true,
    underscored: true
});

export const EpisodeOfCareStatus = sequelize.define('episode_of_care_status', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: DataTypes.STRING(22)

}, {
    tableName: 'episode_of_care_status',
    timestamps: true,
    underscored: true
})

export const EpisodeOfCare = sequelize.define('episode_of_care', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    uuid: {
        type: DataTypes.STRING
    },
    name_doctor: {
        type: DataTypes.STRING(100)
    },
    medical_center: {
        type: DataTypes.STRING(100)
    },
    specialty_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'specialty',
            key: 'id'
        }
    },
    code_episode:
    {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    bed: {
        type: DataTypes.STRING(10)
    },
    status_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'episode_of_care_status',
            key: 'id'
        }
    },
    period_start: {
        type: DataTypes.DATE,
        allowNull: false
    },
    medical_service_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    service_provider_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'organization',
            key: 'id'
        }
    },
    period_end: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'episode_of_care',
    timestamps: true,
    underscored: true
});

export const ServicePharma = sequelize.define('service_pharma', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    episode_of_care_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'episode_of_care',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'user',
            key: 'id'
        }
    }
}, {
    tableName: 'service_pharma',
    timestamps: false,
    underscored: true
});

// ------------------------------------------------------------------------------------------


/**
 * Submódulo de alergias
 * 
 */


// ------------------------------------------------------------------------------------------

export const Allergy = sequelize.define('allergies', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    observation: {
        type: DataTypes.TEXT
    },
    code: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    medical_service_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'medical_service',
            key: 'id'
        }
    },
    medication_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
            model: 'medication',
            key: 'id'
        }
    }
}, {
    tableName: 'allergies',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['medical_service_id', 'medication_id', 'code']
        }
    ]
});

// ------------------------------------------------------------------------------------------


/**
 * Submódulo de diagnosticos
 * 
 */


// ------------------------------------------------------------------------------------------

export const DiagnosisCode = sequelize.define('DiagnosisCode', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'diagnosis_code',
    timestamps: false,
    underscored: true
});

export const DiagnosisRole = sequelize.define('DiagnosisRole', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    }
}, {
    tableName: 'diagnosis_role',
    timestamps: false,
    underscored: true
});

export const DiagnosisCodeI18n = sequelize.define('DiagnosisCodeI18n', {
    diagnosis_code_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true, // <--- Agregar esto
        references: {
            model: 'diagnosis_code',
            key: 'id'
        }
    },
    // Si tienes language_id en el modelo, agrégalo también como primaryKey
    // En tu entities.txt actual no aparece, pero en la imagen de la DB sí está.
    language_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true // <--- Agregar esto para formar la clave compuesta
    },
    display: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'diagnosis_code_i18n',
    timestamps: false,
    underscored: true
});

export const ReportDiagnosis = sequelize.define('ReportDiagnosis', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.UUID,
        allowNull: false
    },
    medical_service_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'medical_service',
            key: 'id'
        }
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'diagnosis_role',
            key: 'id'
        }
    },
    diagnosis_code_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'diagnosis_code',
            key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    },
    date_report: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    rank_report: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    observations: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'report_diagnosis',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['medical_service_id', 'diagnosis_code_id', 'rank_report']
        }
    ]
});

// ------------------------------------------------------------------------------------------


/**
 * Submódulo de medicamentos
 * 
 */


// ------------------------------------------------------------------------------------------

export const Medication = sequelize.define('medication', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    dose_form_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'dose_form',
            key: 'id',
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT'
        }
    },
    total_volume_value: {
        type: DataTypes.NUMERIC(12, 4)
    },
    total_volume_unit_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'unit',
            key: 'id',
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT'
        }
    }
}, {
    tableName: 'medication',
    timestamps: false,
    underscored: false
});

export const Atc = sequelize.define('atc', {}, {
    tableName: 'atc',
    timestamps: false,
    underscored: false
});

export const AtcI18n = sequelize.define('atc_i18n', {}, {
    tableName: 'atc_i18n',
    timestamps: false,
    underscored: false
});

export const MedicationAtc = sequelize.define('MedicationAtc', {
    medication_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: Medication,
            key: 'id'
        }
    },
    atc_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: Atc,
            key: 'id'
        }
    }
}, {
    tableName: 'medication_atc',
    timestamps: false,
    underscored: false
});



// ------------------------------------------------------------------------------------------


/**
 * Submódulo de prescripción conectado a medicamentos
 * 
 */


// ------------------------------------------------------------------------------------------

export const MedicationDispense = sequelize.define('MedicationDispense', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    uuid: {
        type: DataTypes.CHAR(36)
    },
    request_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'MedicationRequest',
            key: 'id'
        }
    },
    status_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'MedicationDispenseStatus',
            key: 'id'
        }
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    when_handed_over: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'medication_dispense',
    timestamps: false
});

export const MedicationRequestStatus = sequelize.define('MedicationRequestStatus', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'medication_request_status',
    timestamps: false
});

export const MedicationRequest = sequelize.define('MedicationRequest', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    medication_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
            model: 'Medication',
            key: 'id'
        }
    },
    status_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'MedicationRequestStatus',
            key: 'id'
        }
    },
    unidentified_medication: {
        type: DataTypes.STRING(),
        allowNull: true
    },
    authored_on: {
        type: DataTypes.DATE,
        allowNull: false
    },
    route: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    dose_amount: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false
    },
    dose_unit: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    timing_frequency: {
        type: DataTypes.STRING(10)
    },
    episode_of_care_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
            model: 'EpisodeOfCare',
            key: 'id'
        }
    },
    date_start: {
        type: DataTypes.DATE,
        allowNull: true
    },
    date_end: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'medication_request',
    timestamps: true
});


// ------------------------------------------------------------------------------------------


/**
 * Submódulo de paraclinicos
 * 
 */


// ------------------------------------------------------------------------------------------

export const ObservationCategory = sequelize.define('observation_category', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING(255)
    }
}, {
    tableName: 'observation_category',
    timestamps: true,
    underscored: true
});

export const ObservationCode = sequelize.define('observation_code', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING(255)
    }
}, {
    tableName: 'observation_code',
    timestamps: true,
    underscored: true
});

export const ObservationStatus = sequelize.define('observation_status', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING(255)
    }
}, {
    tableName: 'observation_status',
    timestamps: true,
    underscored: true
});

export const Observation = sequelize.define('observation', {
    episode_of_care_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'episode_of_care',
            key: 'id'
        }
    },
    status_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'observation_status',
            key: 'id'
        }
    },
    category_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'observation_category',
            key: 'id'
        }
    },
    code_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'observation_code',
            key: 'id'
        }
    },
    issued: {
        type: DataTypes.DATE, // Es mejor usar DATE para fechas
    },
    value: {
        type: DataTypes.TEXT
    },
    unit: {
        type: DataTypes.STRING(255),
        allowNull: true // Cambiado a true por si acaso
    }
}, {
    tableName: 'observation',
    timestamps: true,
    underscored: true,
    primaryKey: false
});

Observation.removeAttribute('id');

// ------------------------------------------------------------------------------------------


/**
 * Submódulo de alertas
 * 
 */


// ------------------------------------------------------------------------------------------

export const DetectedIssue = sequelize.define('DetectedIssue', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true
    },
    uuid: {
        type: DataTypes.CHAR(36),
        unique: true,
    },
    group_detected: {
        type: DataTypes.BIGINT,
    },
    status_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'detected_issue_status',
            key: 'id',
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
    },
    patient_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'patient',
            key: 'id',
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
    },
    identified_date_time: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    author_type: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    author_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    known_issue_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'known_issue',
            key: 'id',
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
    }
}, {
    tableName: 'detected_issue',
    timestamps: false,
});

export const DetectedIssueStatus = sequelize.define('DetectedIssueStatus', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    variation: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
}, {
    tableName: 'detected_issue_status',
    timestamps: false,
});

export const KnownIssue = sequelize.define('KnownIssue', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    detail: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    trial893: {
        type: DataTypes.CHAR
    }
}, {
    tableName: 'known_issue',
    timestamps: false
});

export const KnownIssueCategory = sequelize.define('KnownIssueCategory', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'known_issue_category',
    timestamps: false
});

export const KnownIssueSeverity = sequelize.define('KnownIssueSeverity', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    trial887: {
        type: DataTypes.CHAR
    }
}, {
    tableName: 'known_issue_severity',
    timestamps: false
});

export const DetectedIssueStatusI18n = sequelize.define('DetectedIssueStatusI18n', {
    detected_issue_status_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'detected_issue_status',
            key: 'id',
        }
    },
    language_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'language',
            key: 'id',
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
    },
    display: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'detected_issue_status_i18n',
    timestamps: false,
});

export const KnownIssueCategoryI18n = sequelize.define('KnownIssueCategoryI18n', {
    category_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'known_issue_category',
            key: 'id',
        }
    },
    language_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'language',
            key: 'id',
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
    },
    display: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'known_issue_category_i18n',
    timestamps: false,
});

export const KnownIssueSeverityI18n = sequelize.define('KnownIssueSeverityI18n', {
    known_issue_severity_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'known_issue_severity',
            key: 'id',
        }
    },
    language_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'language',
            key: 'id',
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
    },
    display: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'known_issue_severity_i18n',
    timestamps: false,
});

export const KnownIssueGenerate = sequelize.define('KnownIssueGenerate', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    warning: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    date_report: {
        type: DataTypes.DATE,
        allowNull: false
    },
    user_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'Users ',
            key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    },
    level_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'KnownIssueSeverity',
            key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    },
    patient_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'Patient',
            key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    },
    status_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'DetectedIssueStatus',
            key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    },
    type_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'KnownIssueCategory',
            key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'known_issue_generate',
    timestamps: true,
});

export const KnownIssueGenerateImplicated = sequelize.define('KnownIssueGenerateImplicated', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    known_issue_generate_id: {
        type: DataTypes.BIGINT,
        references: {
            model: 'KnownIssueGenerate',
            key: 'id'
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    },
    medication_id: {
        type: DataTypes.BIGINT
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'known_issue_generate_implicated',
    timestamps: false,
});

export const DetectedIssueMitigation = sequelize.define('DetectedIssueMitigation', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    detected_issue_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    action_id: {
        type: DataTypes.BIGINT,
    },
    comment: {
        type: DataTypes.TEXT,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    author_type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    author_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    trial923: {
        type: DataTypes.CHAR,
    },
    process_stage_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'process_stage',
            key: 'id',
        },
    },
    intervene_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'intervene',
            key: 'id',
        },
    },
    action_framework_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'action_framework',
            key: 'id',
        },
    },
    detected_issue_status_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'detected_issue_status',
            key: 'id',
        },
    },
}, {
    tableName: 'detected_issue_mitigation',
    timestamps: true,
});

export const ActionFramework = sequelize.define('ActionFramework', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    option: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'action_framework',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export const Intervene = sequelize.define('Intervene', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    option: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'intervene',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export const ProcessStage = sequelize.define('ProcessStage', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    option: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'process_stage',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

// ------------------------------------------------------------------------------------------

/**
 * 
 * Asociaciones entre tablas
 * 
 */


// ------------------------------------------------------------------------------------------

User.hasOne(Role);
Role.belongsTo(User);

User.hasOne(PasswordReset);
PasswordReset.belongsTo(User);

Role.belongsToMany(RolePermission, { through: 'role_permission' });
RolePermission.belongsToMany(Role, { through: 'role_permission' });

Permission.belongsToMany(RolePermission, { through: 'role_permission' });
RolePermission.belongsToMany(Permission, { through: 'role_permission' });

Patient.hasOne(MedicalService);
MedicalService.belongsTo(Patient);

Patient.belongsTo(AdministrativeGender, { foreignKey: 'gender_id' });
AdministrativeGender.hasOne(Patient, { foreignKey: 'gender_id' });


// Apartado de alergias

Allergy.belongsTo(MedicalService, { foreignKey: 'medical_service_id' });
MedicalService.hasMany(Allergy, { foreignKey: 'medical_service_id' });

Medication.hasMany(Allergy, { foreignKey: 'medication_id' });
Allergy.belongsTo(Medication, { foreignKey: 'medication_id' });


//  Apartado de diagnosticos

MedicalService.belongsToMany(DiagnosisCode, { through: 'report_diagnosis' });
DiagnosisCode.belongsToMany(MedicalService, { through: 'report_diagnosis' })

DiagnosisCode.hasMany(ReportDiagnosis, { foreignKey: 'diagnosis_code_id' });
ReportDiagnosis.belongsTo(DiagnosisCode, { foreignKey: 'diagnosis_code_id' });

DiagnosisRole.hasMany(ReportDiagnosis, { foreignKey: 'category_id' });
ReportDiagnosis.belongsTo(DiagnosisRole, { foreignKey: 'category_id' });

DiagnosisCode.hasMany(DiagnosisCodeI18n, { foreignKey: 'diagnosis_code_id' });
DiagnosisCodeI18n.belongsTo(DiagnosisCode, { foreignKey: 'diagnosis_code_id' });


// Apartado de episodio de cuidado

Specialty.hasMany(EpisodeOfCare, { foreignKey: 'specialty_id' });
EpisodeOfCare.belongsTo(Specialty, { foreignKey: 'specialty_id' });

EpisodeOfCare.belongsTo(EpisodeOfCareStatus, { foreignKey: 'status_id' });
EpisodeOfCareStatus.hasOne(EpisodeOfCare, { foreignKey: 'status_id' });

EpisodeOfCare.belongsTo(Organization, { foreignKey: 'service_provider_id' });
Organization.hasOne(EpisodeOfCare, { foreignKey: 'service_provider_id' });

EpisodeOfCare.belongsTo(MedicalService, { foreignKey: 'medical_service_id' });
MedicalService.hasMany(EpisodeOfCare, { foreignKey: 'medical_service_id' });


// Apartado de asociaciones de farmaceuticos

ServicePharma.belongsTo(EpisodeOfCare, { foreignKey: 'episode_of_care_id' });
ServicePharma.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ServicePharma, { foreignKey: 'user_id' });
ServicePharma.belongsTo(User, { foreignKey: 'user_id' });


// Apartado de medicamentos

Medication.hasMany(MedicationAtc, { foreignKey: 'medication_id' });
MedicationAtc.belongsTo(Medication, { foreignKey: 'medication_id' });

Atc.hasMany(MedicationAtc, { foreignKey: 'atc_id' });
MedicationAtc.belongsTo(Atc, { foreignKey: 'atc_id' });

Atc.hasMany(AtcI18n, { foreignKey: 'atc_id' });
AtcI18n.belongsTo(Atc, { foreignKey: 'atc_id' });


// Aparatado de precripciones

MedicationRequestStatus.hasMany(MedicationRequest, {
    foreignKey: 'status_id'
});
MedicationRequest.belongsTo(MedicationRequestStatus, {
    foreignKey: 'status_id'
});

MedicationRequest.hasMany(MedicationDispense, {
    foreignKey: 'request_id'
});
MedicationDispense.belongsTo(MedicationRequest, {
    foreignKey: 'request_id'
});

MedicationRequest.belongsTo(Medication, {
    foreignKey: 'medication_id'
});
Medication.hasMany(MedicationRequest, {
    foreignKey: 'medication_id'
})

MedicationRequest.belongsTo(EpisodeOfCare, {
    foreignKey: 'episode_of_care_id'
});

EpisodeOfCare.hasMany(MedicationRequest, {
    foreignKey: 'episode_of_care_id'
});


// Apartado de paraclínicos

Observation.belongsTo(ObservationStatus, { foreignKey: 'status_id' });
ObservationStatus.hasMany(Observation, { foreignKey: 'status_id' });

Observation.belongsTo(ObservationCategory, { foreignKey: 'category_id' });
ObservationCategory.hasMany(Observation, { foreignKey: 'category_id' });

Observation.belongsTo(ObservationCode, { foreignKey: 'code_id' });
ObservationCode.hasMany(Observation, { foreignKey: 'code_id' });

Observation.belongsTo(EpisodeOfCare, { foreignKey: 'episode_of_care_id' });
EpisodeOfCare.hasMany(Observation, { foreignKey: 'episode_of_care_id' });

// Apartado de alertas

DetectedIssue.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(DetectedIssue, { foreignKey: 'patient_id' });


KnownIssueCategory.hasMany(KnownIssue, {
    foreignKey: 'code_id',
    sourceKey: 'id'
});

KnownIssueSeverity.hasMany(KnownIssue, {
    foreignKey: 'severity_id',
    sourceKey: 'id'
});

KnownIssue.belongsTo(KnownIssueCategory, {
    foreignKey: 'code_id',
    targetKey: 'id'
});

KnownIssue.belongsTo(KnownIssueSeverity, {
    foreignKey: 'severity_id',
    targetKey: 'id'
});

DetectedIssue.belongsTo(Patient, { foreignKey: 'patient_id' });
DetectedIssue.belongsTo(KnownIssue, { foreignKey: 'known_issue_id' });
DetectedIssue.belongsTo(DetectedIssueStatus, { foreignKey: 'status_id' })

KnownIssue.belongsTo(KnownIssueCategory, { foreignKey: 'code_id' });
KnownIssue.belongsTo(KnownIssueSeverity, { foreignKey: 'severity_id' });

KnownIssueCategory.hasMany(KnownIssueCategoryI18n, { foreignKey: 'category_id' });
KnownIssueCategoryI18n.belongsTo(KnownIssueCategory, { foreignKey: 'category_id' });

KnownIssueSeverity.hasMany(KnownIssueSeverityI18n, { foreignKey: 'known_issue_severity_id' });
KnownIssueSeverityI18n.belongsTo(KnownIssueSeverity, { foreignKey: 'known_issue_severity_id' });

DetectedIssueStatus.hasMany(DetectedIssueStatusI18n, { foreignKey: 'detected_issue_status_id' });
DetectedIssueStatusI18n.belongsTo(DetectedIssueStatus, { foreignKey: 'detected_issue_status_id' });

Language.hasMany(KnownIssueCategoryI18n, { foreignKey: 'language_id' });
KnownIssueCategoryI18n.belongsTo(Language, { foreignKey: 'language_id' });

Language.hasMany(KnownIssueSeverityI18n, { foreignKey: 'language_id' });
KnownIssueSeverityI18n.belongsTo(Language, { foreignKey: 'language_id' });

Language.hasMany(DetectedIssueStatusI18n, { foreignKey: 'language_id' });
DetectedIssueStatusI18n.belongsTo(Language, { foreignKey: 'language_id' });

KnownIssueGenerate.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(KnownIssueGenerate, { foreignKey: 'user_id' });

KnownIssueGenerate.belongsTo(KnownIssueSeverity, { foreignKey: 'level_id' });
KnownIssueSeverity.hasMany(KnownIssueGenerate, { foreignKey: 'level_id' });

KnownIssueGenerate.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(KnownIssueGenerate, { foreignKey: 'patient_id' });

KnownIssueGenerate.belongsTo(DetectedIssueStatus, { foreignKey: 'status_id' });
DetectedIssueStatus.hasMany(KnownIssueGenerate, { foreignKey: 'status_id' });

KnownIssueGenerate.belongsTo(KnownIssueCategory, { foreignKey: 'type_id' });
KnownIssueCategory.hasMany(KnownIssueGenerate, { foreignKey: 'type_id' });

KnownIssueGenerate.hasMany(KnownIssueGenerateImplicated, { foreignKey: 'known_issue_generate_id' });
KnownIssueGenerateImplicated.belongsTo(KnownIssueGenerate, { foreignKey: 'known_issue_generate_id' });

DetectedIssueMitigation.belongsTo(ProcessStage, { foreignKey: 'process_stage_id' });
DetectedIssueMitigation.belongsTo(Intervene, { foreignKey: 'intervene_id' });
DetectedIssueMitigation.belongsTo(ActionFramework, { foreignKey: 'action_framework_id' });
DetectedIssueMitigation.belongsTo(DetectedIssueStatus, { foreignKey: 'detected_issue_status_id' });
ProcessStage.hasMany(DetectedIssueMitigation, { foreignKey: 'process_stage_id' });
Intervene.hasMany(DetectedIssueMitigation, { foreignKey: 'intervene_id' });
ActionFramework.hasMany(DetectedIssueMitigation, { foreignKey: 'action_framework_id' });
DetectedIssueStatus.hasMany(DetectedIssueMitigation, { foreignKey: 'detected_issue_status_id' });