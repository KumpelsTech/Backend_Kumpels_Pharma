import { z } from 'zod';
import moment from 'moment';

const sizeUnits = ['m'];
const weightUnits = ['kg'];
const temperatureUnits = ['C'];
const pressureUnits = ['S/D'];
const glucoseUnits = ['mg/dL'];
const inrUnits = ['segundos'];
const ptUnits = ['segundos'];
const astUnits = ['U/L'];
const altUnits = ['U/L'];
const creatinineUnits = ['mg/dL'];
const heartRateUnits = ['bpm'];
const respiratoryRateUnits = ['rpm'];
const painUnits = ['score'];



const unitMetricsSchema = z.object({
    size_unit: z.enum(sizeUnits),
    current_weight_unit: z.enum(weightUnits),
    usual_weight_unit: z.enum(weightUnits),
    body_temperature_unit: z.enum(temperatureUnits),
    blood_pressure_unit: z.enum(pressureUnits),
    glucose_level_unit: z.enum(glucoseUnits),
    INR_unit: z.enum(inrUnits),
    PT_unit: z.enum(ptUnits),
    AST_unit: z.enum(astUnits),
    ALT_unit: z.enum(altUnits),
    creatinine_unit: z.enum(creatinineUnits),
    heart_rate_unit: z.enum(heartRateUnits),
    respiratory_rate_unit: z.enum(respiratoryRateUnits),
    pain_unit: z.enum(painUnits)
});


const dateString = (field) => z.preprocess(
    (val) => {
        if (val === null || val === "") return null;
        const date = moment(val, 'DD-MM-YYYY HH:mm', true);
        return date.isValid() ? val : null;
    },
    z.string().nullable().refine(date => date === null || moment(date, 'DD-MM-YYYY HH:mm', true).isValid(), { message: `${field} must be a valid date in DD-MM-YYYY HH:mm format` })
);


const paraclinicalDataSchema = z.object({
    id_patient: z.string(),
    size: z.number().min(0).max(99.99).nullable().optional(),
    current_weight: z.number().min(0).max(999.99).nullable().optional(),
    current_weight_date: dateString('current_weight_date').optional(),
    usual_weight: z.number().min(0).max(999.99).nullable().optional(),
    body_temperature: z.number().min(0).max(99.99).nullable().optional(),
    body_temperature_date: dateString('body_temperature_date').optional(),
    blood_pressure: z.string().max(7).nullable().optional().optional(),
    blood_pressure_date: dateString('blood_pressure_date').optional(),
    heart_rate: z.number().int().nullable().optional(),
    heart_rate_date: dateString('heart_rate_date').optional(),
    respiratory_rate: z.number().int().nullable().optional(),
    respiratory_rate_date: dateString('respiratory_rate_date').optional(),
    pain: z.number().int().nullable().optional(),
    pain_date: dateString('pain_date').optional(),
    glucose_level: z.number().min(0).max(999.99).nullable().optional(),
    glucose_level_date: dateString('glucose_level_date').optional(),
    INR: z.number().min(0).max(99.99).nullable().optional(),
    INR_date: dateString('INR_date').optional(),
    PT: z.number().nullable().optional(),
    PT_date: dateString('PT_date').optional(),
    AST: z.number().min(0).max(999.99).nullable().optional(),
    AST_date: dateString('AST_date').optional(),
    ALT: z.number().min(0).max(999.99).nullable().optional(),
    ALT_date: dateString('ALT_date').optional(),
    creatinine: z.number().min(0).max(999.99).nullable().optional(),
    creatinine_date: dateString('creatinine_date').optional()
});


const paraclinicalSchema = z.object({
    status: z.object({
        code: z.string()
    }),
    params_unit: unitMetricsSchema,
    params_category: z.object({
        size_category: z.string(),
        current_weight_category: z.string(),
        usual_weight_category: z.string(),
        body_temperature_category: z.string(),
        blood_pressure_category: z.string(),
        glucose_level_category: z.string(),
        INR_category: z.string(),
        PT_category: z.string(),
        AST_category: z.string(),
        ALT_category: z.string(),
        creatinine_category: z.string(),
        heart_rate_category: z.string(),
        respiratory_rate_category: z.string(),
        pain_category: z.string(),
        id_patient_category: z.string()
    }),
    paraclinicalData: z.array(paraclinicalDataSchema)
});

export default paraclinicalSchema;
