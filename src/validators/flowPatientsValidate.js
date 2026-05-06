import { z } from 'zod';

const noHtmlRegex = /^(?!.*<[^>]+>).+$/;

const parseDate = (value, ctx) => {

    if (value === '') return null;

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid date format'
        });
        return z.NEVER;
    }

    const formattedDate = date.toISOString().split('T')[0];
    return formattedDate;
};

const patientSchemaValidate = z.object({
    t_identification: z.string()
        .max(5)
        .regex(/^[A-Za-z]+$/, {
            message: 'Type of identification must contain only letters'
        })
        .regex(noHtmlRegex, { message: 'Type of identification format invalid' }),
    identification: z.string()
        .min(3)
        .max(20)
        .regex(/^[0-9\s]+$/, {
            message: 'Identification must contain only numbers'
        })
        .regex(noHtmlRegex, { message: 'Identification format invalid' }),
    first_name: z.string()
        .max(50)
        .min(1)
        .regex(noHtmlRegex, { message: 'First name format invalid' }),
    second_name: z.string()
        .max(50)
        .nullable()
        .transform(val => val === null ? '' : val)
        .refine(val => val === '' || noHtmlRegex.test(val), { message: 'Second name format invalid' }),
    last_name: z.string()
        .max(50)
        .min(1)
        .regex(noHtmlRegex, { message: 'Last name format invalid' }),
    second_last_name: z.string()
        .max(50)
        .nullable()
        .transform(val => val === null ? '' : val)
        .refine(val => val === '' || noHtmlRegex.test(val), { message: 'Second last name format invalid' }),
    id_history_clinic: z.string()
        .max(20)
        .regex(/^[0-9\s]+$/, {
            message: 'History clinic must contain only numbers'
        })
        .nullable()
        .transform(val => val === null ? '' : val),

    episode: z.string()
        .max(20)
        .nullable()
        .transform(val => val === null ? '' : val)
        .refine(val => val === '' || /^[0-9]+$/.test(val), { message: 'Episode must contain only numbers' }),
    bed: z.string()
        .max(20)
        .nullable()
        .transform(val => val === null ? '' : val)
        .refine(val => val === '' || noHtmlRegex.test(val), { message: 'Bed format invalid' }),
    birth_date: z.string()
        .transform(parseDate)
        .nullable(),
    sex: z.string()
        .max(5)
        .regex(noHtmlRegex, { message: 'Sex format invalid' }),
    date_of_entry: z.string()
        .transform(parseDate),
    discharge_date: z.string()
        .transform(parseDate)
        .nullable(),
    p_diagnostic: z.string(),
    doctor_name: z.string()
        .max(50).
        refine(val => val === '' || noHtmlRegex.test(val), { message: 'Episode format invalid' }),
    s_diagnostic: z.string(),
    medical_center: z.string()
        .max(100)
        .refine(val => val === '' || noHtmlRegex.test(val), { message: 'Episode format invalid' }),
    specialty: z.string()
        .max(50)
        .refine(val => val === '' || noHtmlRegex.test(val), { message: 'Episode format invalid' }),
    id_allergies: z.string().max(20).refine(val => val === '' || noHtmlRegex.test(val), { message: 'Episode format invalid' })
});


export const patientSearchSchema = z.object({
    name: z.string().regex(/^[A-Za-z\s]+$/, "Name must contain only letters and spaces").regex(noHtmlRegex, "Name must not contain HTML").optional(),
    hc: z.string().regex(/^\d+$/, "hc must be a 20-digit number").regex(noHtmlRegex, "hc must not contain HTML").optional(),
    bed: z.string()
        .regex(/^[a-zA-Z0-9-]+$/, "Bed must contain only letters, numbers, and hyphens")
        .regex(noHtmlRegex, "Bed must not contain HTML")
        .optional(),
    ep: z.string().regex(/^\d+$/, "Ep must be a numeric string").regex(noHtmlRegex, "Ep must not contain HTML").optional()
}).refine((data) => {
    return Object.values(data).some((value) => value !== undefined && value !== null && value !== '');
}, {
    message: "At least one field must be provided",
    path: [
        "name",
        "hc",
        "bed",
        "ep"
    ]
});

export const patientsArraySchemaValidate = z.array(patientSchemaValidate);
