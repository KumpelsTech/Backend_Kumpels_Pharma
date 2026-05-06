import { fetchAllOptions, getAgentRiskIntervention, getAlertByIntervention, getAlertsPatient, getInterventions, getInterventionsAlertData, getOptionsAlert, getOptionsAlertsIntervention, saveAlertGenerate, saveInterventionGenerate } from "../controllers/alertsController.js";
import authorize from "../middlewares/authorizeRole.js";
import { getInterventionByCode } from "../models/alertsModel.js";
import { agentSchema, alertGenerateSchema, interventionSchema } from "../validators/alertsValidate.js";
import { formatZodError, uuidSchema } from "../validators/generalSchemaValidate.js";
import express from 'express';
import z from 'zod';

import { ingestExcelData } from "../controllers/alertsController.js";


const router = express.Router();

const MODULE = 'Module_Alerts';

router.post('/ingest-excel', async (req, res) => {
    try {
        // Llamamos a la lógica del controlador
        const result = await ingestExcelData(req.body);
        
        // Respondemos al front con éxito
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: 'Fallo la ingesta', detall: error.message });
    }
});

router.post('/get-alerts', authorize(MODULE, 'alert.read'), async (req, res) => {
    try {

        const medicationData = uuidSchema.parse(req.body);

        const data = await getAlertsPatient(medicationData);

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


router.post('/get-alert-intervention', authorize(MODULE, 'alert.read'), async (req, res) => {
    try {

        const alert =
            uuidSchema.parse(req.body);

        const data = await getAlertByIntervention(alert);

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

router.get('/get-options-alerts', async (_, res) => {

    try {

        const result = await getOptionsAlert();

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

router.get('/get-options-intervention', async (_, res) => {
    try {
        const result = await fetchAllOptions();
        res.status(200).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/get-data-intervention', async (req, res) => {
    try {

        const patient = uuidSchema.parse(req.body);

        const result = await getInterventions(patient);

        res.status(200).json(result);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});


router.post('/get-intervention-from-alert', async (req, res) => {
    try {

        const patient = uuidSchema.parse(req.body);

        const result = await getInterventionsAlertData (patient);

        res.status(200).json(result);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});



router.post('/save-generate-alert', authorize(MODULE, 'alert.save'), async (req, res) => {
    try {

        const alert = alertGenerateSchema.parse(req.body);

        const data = await saveAlertGenerate(alert);

        res.status(201).json(data);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.post('/save-generate-intervention', authorize(MODULE, 'alert.save'), async (req, res) => {
    try {

        const alert = interventionSchema.parse(req.body);

        const data = await saveInterventionGenerate(alert);

        res.status(201).json(data);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});



router.post('/get-alerts-option-intervention', authorize(MODULE, 'alert.read'), async (req, res) => {
    try {

        const alert = uuidSchema.parse(req.body);

        const data = await getOptionsAlertsIntervention(alert);

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

router.post('/get-agents-option-intervention', authorize(MODULE, 'alert.read'), async (req, res) => {
    try {

        const alert = agentSchema.parse(req.body);

        const data = await getAgentRiskIntervention(alert);

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