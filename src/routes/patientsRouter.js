import express from 'express';
import { getPatients, createFlowPatients, getAllDetailsPatient, searchPatient, searchPatientChain } from '../controllers/patientController.js';
import { criteriaSearchSchema, formatZodError, paginationWithFiltersSchema, uuidSchema } from '../validators/generalSchemaValidate.js';
import z from 'zod';
import authorize from '../middlewares/authorizeRole.js';
import { patientsArraySchemaValidate, patientSearchSchema } from '../validators/flowPatientsValidate.js';
import paraclinicalRoutes from './paraclinicalRoutes.js';
import medicationRoutes from './medicationRoute.js';
import alertsRoutes from './alertsRoute.js';

const router = express.Router();

const MODULE = 'Module_Patients';

router.post('/get-patients', authorize(MODULE, 'patient.read'), async (req, res) => {
    try {
        const { page, pageSize, filters } = paginationWithFiltersSchema.parse(req.body);

        const patients = await getPatients(page, pageSize, filters);

        res.json(patients);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.post('/create-patients', async (req, res) => {
    try {

        const patientData = patientsArraySchemaValidate.parse(req.body);

        const result = await createFlowPatients(patientData);

        res.status(201).json(result);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.post('/details-patients', async (req, res) => {
    try {
        const patientData = uuidSchema.parse(req.body);

        const result = await getAllDetailsPatient(patientData);

        res.status(200).json(result);

    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(err) });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.post('/search-patient', async (req, res) => {

    try {
        const patientData = patientSearchSchema.parse(req.body);

        const result = await searchPatient(patientData);

        res.status(200).json(result);

    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(err) });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

});


router.post('/search-patient-options', async (req, res) => {

    try {
        const patientData = criteriaSearchSchema.parse(req.body);

        const result = await searchPatientChain(patientData);

        res.status(200).json(result);

    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(err) });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

});


router.use('/medications', medicationRoutes);
router.use('/paraclinicals', paraclinicalRoutes);
router.use('/alerts', alertsRoutes);

export default router;

