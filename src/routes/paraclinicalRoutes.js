import express from 'express';
import { createFlowParaclinical, dataParaclinical } from '../controllers/paraclinicalController.js';
import { formatZodError, uuidSchema } from '../validators/generalSchemaValidate.js';
import z from 'zod'
import authorize from '../middlewares/authorizeRole.js';
import paraclinicalSchema from '../validators/paraclinicalSchemaValidate.js';


const router = express.Router();

const MODULE = 'Module_Paraclinical';


router.post('/create-paraclinical', authorize(MODULE, 'paraclinical.create'), async (req, res) => {
    try {
        const paraclinicalData = paraclinicalSchema.parse(req.body);

        const result = await createFlowParaclinical(paraclinicalData);

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

router.post('/details-paraclinical', authorize(MODULE, 'paraclinical.read'), async (req, res) => {
    try {
        const paraclinicalData = uuidSchema.parse(req.body);

        const result = await dataParaclinical(paraclinicalData.uuid);

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

export default router;
