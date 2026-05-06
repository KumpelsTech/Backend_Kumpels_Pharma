import { signInProcess, refreshToken, forgotPassword, createUserData, resetPassword } from '../../controllers/authController.js';
import { resetPasswordSchema, userSchemaValidate, userSchemaValidateForgotPassword, userSchemaValidateSignIn } from '../../validators/userSchemaValidate.js';
import { formatZodError } from '../../validators/generalSchemaValidate.js';
import express from 'express';
import z from 'zod';
import verifyRefreshToken from '../../middlewares/verifyRefreshToken.js';
import tokenNewPassword from '../../middlewares/verifyTokenNewPassword.js';


const router = express.Router();


router.post('/sign-in', async (req, res) => {

    try {
        const { email, password } = userSchemaValidateSignIn.parse(req.body);

        const { tokenAccess, tokenRefresh } = await signInProcess(email, password);

        res.setHeader('Authorization', `Bearer ${tokenAccess}`);

        res.cookie('refreshToken', tokenRefresh, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ authTokenAccess: tokenAccess });

    } catch (error) {
        if (error instanceof z.ZodError) {

            console.error(error);
            res.status(400).json({ errors: formatZodError(error) });

        } else if (error.message === '401') {

            console.error(error);
            res.status(401).json({ errors: 'Unauthorized' });

        } else {

            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });

        }
    }
});


router.post('/refresh-token', verifyRefreshToken, async (req, res) => {

    try {
        const tokenData = req.userData;

        const tokenAccess = await refreshToken(tokenData);

        res.json({ authTokenAccess: tokenAccess });

    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.post('/sign-up', async (req, res) => {
    try {

        const data = userSchemaValidate.parse(req.body);

        const resp = await createUserData(data);

        res.status(201).json(resp);

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ errors: formatZodError(error) });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});


router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });

    res.status(200).send('Logout exitoso');
});


router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = userSchemaValidateForgotPassword.parse(req.body);

        await forgotPassword(email);

        res.status(200).json({ message: 'Password reset email sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error(error);
            res.status(400).json({ errors: formatZodError(error) });
        } else if (error.message === '404') {
            console.error(error);
            res.status(404).json({ errors: 'User not found' });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});


router.get('/verify-reset-token', tokenNewPassword, (req, res) => {
    res.status(200).json({ message: 'El token de restablecimiento de contraseña es válido' });
});


router.patch('/reset-password', tokenNewPassword, async (req, res) => {

    try {

        const tokenData = req.user;

        const dataPass = resetPasswordSchema.parse(req.body);

        const status = await resetPassword(tokenData.email, tokenData.iden, dataPass);

        res.json(status);

    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
