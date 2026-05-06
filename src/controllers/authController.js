import bc from 'bcrypt';
import { generateAccessToken, generateDateNow, generateRefreshToken, getMinutesDifference } from '../helpers/helpers.js';
import getUserWithRolesAndPermissions, { createUser, existUser, getIdRolePharmaceutical, getResetVerify, newPassword, saveTokenPassword, updateResetVerify, verifyEmail } from '../models/userModels.js';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken'

dotenv.config();


const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN_AUTHGOOGLE });

async function signInProcess(email, password) {
    try {
        const user = await getUserWithRolesAndPermissions(email);

        if (!user) {
            throw new Error('401');
        }

        const result = await new Promise((resolve, reject) => {
            bc.compare(password, user[0].password, (err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result);
            });
        });

        if (!result) {
            throw new Error('401');
        }

        const tokenAccess = generateAccessToken(user[0].code, user[0].role, user[0].permissions, user[0].name);
        const tokenRefresh = generateRefreshToken(user[0].email);

        return { tokenAccess, tokenRefresh };

    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function refreshToken(decode) {
    try {
        if (!decode) {
            throw new Error('Unauthorized');
        }

        const user = await getUserWithRolesAndPermissions(decode.email);

        if (!user) {
            throw new Error('Unauthorized');
        }

        const tokenAccess = generateAccessToken(user[0].code, user[0].role, user[0].permissions);

        return tokenAccess;

    } catch (error) {
        console.error(error);
        throw new Error('Invalid token');
    }
}

async function forgotPassword(email) {
    try {
        const verify = await verifyEmail(email);

        if (!verify) {
            throw new Error('404');
        }
        const datReset = await getResetVerify(verify.id);

        if (datReset) {
            if (getMinutesDifference(datReset.generate, generateDateNow()) < 30 && datReset.used === 'T') {
                throw new Error('401');
            }
        }

        const token = jwt.sign(
            { email: verify.email, iden: verify.identification },
            process.env.KEY_FORGOT_PASSWORD,
            { expiresIn: process.env.TOKEN_EXPIRY_FORGOT_PASSWORD }
        );

        const structData = {
            token: token,
            id_user: verify.id,
            generate: generateDateNow()
        }

        await saveTokenPassword(structData);

        const result = await sendMail(email, verify.name, token);

        console.log('Email sent...', result);

    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function createUserData(userData) {
    try {
        const existingUser = await existUser(userData);

        if (existingUser) {
            return { status: 400, message: 'Email already exists' };
        }

        const saltRounds = 10;
        const salt = await bc.genSalt(saltRounds);
        const hashedPassword = await bc.hash(userData.password, salt);

        userData.password = hashedPassword;
        const role = await getIdRolePharmaceutical();

        userData.id_rol = role.id;

        await createUser(userData);

        return { status: 201, message: 'User Created' };

    } catch (error) {
        console.error('Error origin controller :' + error);
        throw error;
    }
}

async function sendMail(email, name, token) {
    try {
        const accessToken = await oAuth2Client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('Failed to obtain access token');
        }

        const transport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.USER_EMAIL,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN_AUTHGOOGLE,
                accessToken: accessToken.token,
            },
        });

        const mailOptions = {
            from: `Kumpels <${process.env.USER_EMAIL}>`,
            to: email,
            subject: 'Restablecer contraseña',
            html: `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Restablecer Contraseña</title>
                </head>
                <body style="font-family: 'Nunito Sans', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
                        <tr>
                            <td>
                                <table width="900px"style="margin: 0 auto; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 15px;">
                                    <tr>
                                        <td style="text-align: center; position:absolute; top: 10px">
                                            <img src="https://ingenieria.unal.edu.co/innovate/images/Emprendedores/kumpels.png" alt="Logo Kumpels" style="width: 200px;">
                                        </td>
                                    </tr>
                                    <tr style="position:relative; top: -210px">
                                        <td>
                                            <p>Estimado/a ${name},</p>
                                            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si realizaste esta solicitud, por favor sigue las instrucciones a continuación. Si no realizaste esta solicitud, puedes ignorar este mensaje.</p>
                                            <p>Para restablecer tu contraseña, por favor haz clic en el siguiente enlace o cópialo y pégalo en la barra de direcciones de tu navegador:</p>
                                            <br/>
                                            <p style="text-align: center;">
                                                <a href="${process.env.LINK_FORGOT_PASSWORD + token}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #000C83; border: none; border-radius: 5px; text-decoration: none;">Restablecer Contraseña</a>
                                            </p>
                                            <br/>
                                            <p>Este enlace es válido por 20 minutos. Si no restableces tu contraseña dentro de este período, deberás solicitar un nuevo enlace.</p>
                                            <p>Por favor, ten en cuenta las siguientes recomendaciones al crear tu nueva contraseña:</p>
                                            <ul>
                                                <li>Debe tener al menos 8 caracteres.</li>
                                                <li>Debe incluir al menos una letra mayúscula y una letra minúscula.</li>
                                                <li>Debe contener al menos un número y un carácter especial (por ejemplo: !, @, #, $, etc.).</li>
                                            </ul>
                                            <br />
                                            <p class="note" style="text-align: center; color: #888; font-size: 14px;">Nota: No compartas este enlace ni tu nueva contraseña con nadie. La seguridad de tu cuenta es muy importante para nosotros.</p>
                                            <br />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd;">
                                            <p style="margin: 0;">&copy; Kumpels. Todos los derechos reservados.</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `
        };

        const result = await transport.sendMail(mailOptions);

        return result;

    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}


async function resetPassword(email, iden, password) {
    try {

        const verify = await verifyEmail(email);

        if (!verify) {
            throw new Error('404');
        }

        const saltRounds = 10;
        const salt = await bc.genSalt(saltRounds);
        const hashedPassword = await bc.hash(password.confirmPassword, salt);

        await newPassword(email, iden, hashedPassword);

        await updateResetVerify(email);

        return { "message": "Password update" };

    } catch (error) {
        console.error(error);
        throw error;
    }
}


export { signInProcess, refreshToken, forgotPassword, createUserData, resetPassword };