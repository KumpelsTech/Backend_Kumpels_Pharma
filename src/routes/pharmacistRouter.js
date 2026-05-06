import express from 'express';
import { formatZodError, uuidSchema } from '../validators/generalSchemaValidate.js';
import z from 'zod';
import authorize from '../middlewares/authorizeRole.js';
import { assignPharmacistToPatient, getAllPharmacistWithAssociates, autoAssignPharmacistToPatient, getAssociation } from '../controllers/userController.js';
import { codeAutosAssign, codesAssign } from '../validators/userSchemaValidate.js';
import { decodeJWT } from '../helpers/helpers.js';

const router = express.Router();

const MODULE = 'Module_Patients';

router.post('/get-pharmacists', authorize(MODULE, 'patient.assign'), async (req, res) => {
	try {
		const { uuid } = uuidSchema.parse(req.body);

		const patients = await getAllPharmacistWithAssociates(uuid);

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

router.patch('/assign-pharmacists', authorize(MODULE, 'patient.assign'), async (req, res) => {
	try {
		const { codeService, codeUser, status } = codesAssign.parse(req.body);

		const result = await assignPharmacistToPatient(codeService, codeUser, status);

		res.json(result);

	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json({ errors: formatZodError(error) });
		} else {
			console.error(error);
			res.status(500).json({ error: 'Internal Server Error' });
		}
	}
});


router.post('/get-assign', authorize(MODULE, 'patient.auto_assign'), async (req, res) => {
	try {
		const { codeService, codeUser } = codeAutosAssign.parse(req.body);

		const result = await getAssociation(codeService, codeUser);

		res.json(result);

	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json({ errors: formatZodError(error) });
		} else {
			console.error(error);
			res.status(500).json({ error: 'Internal Server Error' });
		}
	}
});


router.patch('/auto-assign-pharmacists', authorize(MODULE, 'patient.auto_assign'), async (req, res) => {
	try {

		const { codeService, codeUser, status } = codesAssign.parse(req.body);
		
		const authHeader = req.headers['authorization'];

		const token = authHeader && authHeader.split(' ')[1];

		const data = decodeJWT(token);

		const result = await autoAssignPharmacistToPatient(codeService, codeUser, data.id, status);

		res.json(result);

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

