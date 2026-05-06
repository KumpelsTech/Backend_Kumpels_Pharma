import { z } from 'zod';

export const paginationSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive()
});

export const uuidSchema = z.object({
    uuid: z.string().uuid({ message: 'Invalid UUID format' })
});


const filterSchema = z.object({
    field: z.string().regex(/^[a-zA-Z0-9_]+$/),
    value: z.union([
        z.string().regex(/^[a-zA-Z0-9-]*$/),
        z.number(),
        z.tuple([z.string().regex(/^[0-9-]*$/), z.string().regex(/^[0-9-]*$/)]),
        z.tuple([z.number(), z.number()])
    ]),
    pattern: z.enum(['contain', 'equals', 'range', 'custom']),
    type: z.enum(['string', 'number', 'boolean', 'date']),
    operator: z.string().regex(/^(<|<=|>|>=|<>)*$/).optional(),
    second_operator: z.string().regex(/^(<|<=|>|>=|<>)*$/).optional(),
}).refine(data => {
    if (data.pattern === 'custom') {
        if (!data.operator) {
            throw new Error("Operator is required when pattern is 'custom'.");
        }
    }
    return true;
}, {
    message: "Operator is required when pattern is 'custom'.",
    path: ['operator']
}).refine(data => {
    if (data.pattern === 'range') {
        const [start, end] = data.value;
        return (typeof start === typeof end);
    }
    return true;
}, {
    message: "If pattern is 'range', value must be an array of two elements of the same type (both numbers or both strings).",
    path: ['value'],
}).refine(data => {
    const { type, value } = data;

    if (type === 'string') {
        if (typeof value === 'number' || (typeof value[0] === 'number' && typeof value[1] === 'number')) {
            throw new Error(`Invalid value type: expected string, got ${typeof value}`);
        }
    } else if (type === 'number') {
        if (data.second_operator === null || data.second_operator === undefined || data.second_operator === '') {
            if (typeof value !== 'number') {
                throw new Error(`Invalid value type: expected number, got ${typeof value}`);
            }
        } else {
            if ((typeof value[0] !== 'number' && typeof value[1] !== 'number')) {
                throw new Error(`Invalid value type: expected string, got ${typeof value}`);
            }
        }
    }

    return true;
}, {
    message: "Value type must match the specified 'type' (string or number).",
    path: ['value']
});

export const criteriaSearchSchema = z.object({
    pattern: z.string().regex(/^[a-zA-Z0-9 ]+$/).max(50)
});

export const filtersSchema = z.array(filterSchema);

export const paginationWithFiltersSchema = paginationSchema.extend({
    filters: z.array(filterSchema).optional()
});

export const listWithCodeAndPaginationSchema = paginationSchema.merge(uuidSchema);


export const listWithCodeAndPaginationSchemaAndFilters = listWithCodeAndPaginationSchema.extend({
    filters: filtersSchema.optional()
});

const formatZodIssue = (issue) => {
    const { path, message } = issue
    const pathString = path.join('.')

    return `${pathString}: ${message}`
}

export const formatZodError = (error) => {
    const { issues } = error

    if (issues.length) {
        const currentIssue = issues[0]

        return formatZodIssue(currentIssue)
    }
}
