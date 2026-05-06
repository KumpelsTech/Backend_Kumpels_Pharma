import express from 'express';
import { formatZodError, listWithCodeAndPaginationSchema, listWithCodeAndPaginationSchemaAndFilters } from '../validators/generalSchemaValidate.js';
import z from 'zod';
import authorize from '../middlewares/authorizeRole.js'
import { createFlowMedication, getMedicationsOptions, getMedicationsPatient, getprescriptionsPatient, saveAmount } from '../controllers/medicationsController.js';
import fullSchema, { amountSchema } from '../validators/medicationSchemaValidate.js';
import { getMedicationUniqueOptions } from '../models/medicationsModel.js';


const router = express.Router();

const MODULE = 'Module_Medication';


router.post('/create-medication', authorize(MODULE, 'medication.create'), async (req, res) => {
    try {

        const medicationData = fullSchema.parse(req.body);

        const message = createFlowMedication(medicationData);

        res.status(201).json(message);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.post('/get-all-prescription', authorize(MODULE, 'medication.read'), async (req, res) => {
    try {

        const medicationData = listWithCodeAndPaginationSchemaAndFilters.parse(req.body);

        const data = await getprescriptionsPatient(medicationData);

        res.status(200).json(data);

    } catch (error) {
        if (error instanceof z.ZodError) {

            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.post('/get-all-medications-prescription', authorize(MODULE, 'medication.read'), async (req, res) => {
    try {

        const medicationData = listWithCodeAndPaginationSchemaAndFilters.parse(req.body);

        const data = await getMedicationsPatient(medicationData);

        res.status(200).json(data);

    } catch (error) {
        if (error instanceof z.ZodError) {
            // ESTO es lo que necesitamos ver en la terminal
            console.log("ERROR DE VALIDACIÓN EN ZOD:");
            console.log(JSON.stringify(error.errors, null, 2));

            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});



router.post('/get-all-medication-option', authorize(MODULE, 'medication.read'), async (req, res) => {
    try {

        const medicationData = listWithCodeAndPaginationSchemaAndFilters.parse(req.body);

        const data = await getMedicationsOptions(medicationData);

        res.status(200).json(data);

    } catch (error) {
        if (error instanceof z.ZodError) {

            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});


router.patch('/apply-amount', authorize(MODULE, 'medication.create'), async (req, res) => {
    try {

        const medicationData = amountSchema.parse(req.body);

        const data = await saveAmount(medicationData);

        res.status(200).json(data);

    } catch (error) {
        if (error instanceof z.ZodError) {

            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

export default router;
