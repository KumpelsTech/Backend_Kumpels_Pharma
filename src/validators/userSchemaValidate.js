import z from 'zod';

export const userSchemaValidate = z.object({
    type_identification: z.string()
        .max(20)
        .regex(/^[^<>]+$/, { message: 'Type of identification must only contain letters' }),
    name: z.string()
        .min(1)
        .regex(/^[a-zA-Z\s]+$/, { message: 'Name must only contain letters and spaces' }),
    last_name: z.string()
        .regex(/^[a-zA-Z\s]+$/, { message: 'Last name must only contain letters and spaces' }).optional(),
    identification: z.string()
        .max(50)
        .regex(/^[0-9]+$/, { message: 'Identification must only contain numbers' }),
    email: z.string()
        .email(),
    phone: z.string()
        .max(10)
        .regex(/^[0-9]+$/, { message: 'Phone must only contain numbers' }),
    second_email: z.string()
        .email()
        .optional(),
    password: z.string()
        .min(8, { message: 'Password must be at least 8 characters long' })
        .max(40, { message: 'Password has a maximum of 40 characters' })
        .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()-=_+{};':"\\|,.<>?]).{8,}$/, {
            message: 'Password must contain at least one digit, one lowercase letter, one uppercase letter, and one special character'
        })
});

export const userSchemaValidateSignIn = z.object({
    email: z.string().email(),
    password: z.string()
        .min(8, { message: 'Password must be at least 8 characters long' }).max(40, { message: 'The password has a maximum of 40 characters' })
        .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()-=_+{};':"\\|,.<>?]).{8,}$/, {
            message: 'Password must contain at least one digit, one lowercase letter, one uppercase letter, and one special character'
        })
});

export const codesAssign = z.object({
    codeService: z.string().uuid({ message: 'Invalid UUID format' }),
    codeUser: z.string().uuid({ message: 'Invalid UUID format' }),
    status: z.boolean()
});

export const codeAutosAssign = z.object({
    codeService: z.string().uuid({ message: 'Invalid UUID format' }),
    codeUser: z.string().uuid({ message: 'Invalid UUID format' }),
});

export const userSchemaValidateForgotPassword = z.object({
    email: z.string().email()
});

const passwordSchema = z.string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(40, { message: 'Password has a maximum of 40 characters' })
    .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()-=_+{};':"\\|,.<>?]).{8,}$/, {
        message: 'Password must contain at least one digit, one lowercase letter, one uppercase letter, and one special character'
    });


export const resetPasswordSchema = z.object({
    password: passwordSchema,
    confirmPassword: passwordSchema
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});