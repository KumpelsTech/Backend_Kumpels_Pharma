import { z } from "zod";


const medicationSchema = z.object({
    id_patient: z.string().regex(/^\d+$/, { message: "Must be a valid patient number." }),
    medication_code: z.string().regex(/^\d+$/, { message: "Must be a valid medication code." }),
    dose: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: "Must be a valid dose" }),
    dose_unit: z.string().max(10, { message: "Must be a valid dose unit (max 10 characters)." }),
    frecuency: z.string(10),
    route: z.string().max(50, { message: "Must be a valid route (max 50 characters)." }),
    date_start: z.string(10),
    date_end: z.string(10),
    kumpels_code: z.string(),

});

const medicationArraySchema = z.array(medicationSchema);

const fullSchema = z.object({
    status: z.string(),
    data: medicationArraySchema
});



export const requestPrescriptionSchema = z.object({
    id_patient: z.string().regex(/^\d+$/, { message: "Must be a valid patient number." }),
    medication_code: z.string().regex(/^\d+$/, { message: "Must be a valid medication code." }),
    dose: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: "Must be a valid dose" }),
    dose_unit: z.string().max(10, { message: "Must be a valid dose unit (max 10 characters)." }),
    frecuency: z.string(10),
    route: z.string().max(50, { message: "Must be a valid route (max 50 characters)." }),
    date_start: z.string(10),
    date_end: z.string(10),
    kumpels_code: z.string(),

});


export const amountSchema = z.object({
    uuid: z.string().uuid({ message: 'Invalid UUID format' }),
    amount: z.string().refine((val) => {
        const number = parseFloat(val);
        return !isNaN(number) && number >= 0;
    }, {
        message: 'Amount must be a positive integer or float',
    })
});


export default fullSchema;