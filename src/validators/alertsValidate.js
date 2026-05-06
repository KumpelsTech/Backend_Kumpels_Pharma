import { z } from 'zod';

export const alertGenerateSchema = z.object({
	patient_id: z.string().uuid(),
	id_report: z.string().uuid(),
	date_report: z.string().refine(date => {
		const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
		return datePattern.test(date);
	}, {
		message: "Date must be in the format MM/DD/YYYY"
	}),
	adver: z.string().max(250).refine(value => /^[a-zA-Z0-9\s,.;()!¡?¿áéíóúÁÉÍÓÚñÑ]+$/.test(value), {
		message: "adver must contain only letters, numbers, spaces, and certain special characters"
	}),
	agents: z.array(z.string().min(1)).min(1).max(3),
	type_alert: z.string().refine(value => /^\d+$/.test(value), {
		message: "type_alert must contain only digits"
	}),
	level_alert: z.string().refine(value => /^\d+$/.test(value), {
		message: "level_alert must contain only digits"
	}),
	status_alert: z.string().refine(value => /^\d+$/.test(value), {
		message: "status_alert must contain only digits"
	})
});

export const agentSchema = z.object({
	uuid: z.string().uuid({ message: 'Invalid UUID format' }),
	source: z.string()
});

export const interventionSchema = z.object({
	patient: z.string().uuid(),
	alert: z.string().uuid(),
	stepAlert: z.number().int().positive(),
	intervention: z.number().int().positive(),
	action: z.number().int().positive(),
	comment: z.string().min(1),
	status: z.number().int().positive(),
	user: z.string().uuid(),
});