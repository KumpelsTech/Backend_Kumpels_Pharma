import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import patientRoutes from './routes/patientsRouter.js';
import pharmacistRoutes from './routes/pharmacistRouter.js';
import authRouter from './routes/auth/authRouter.js';
import { errorHandler, notFoundHandler } from './middlewares/errorsHandler.js';
import verifyToken from './middlewares/verifyToken.js';
import cookieParser from 'cookie-parser';
import tokenNewPassword from './middlewares/verifyTokenNewPassword.js';
import alertsRoutes from './routes/alertsRoute.js';

const app = express();

app.disable('x-powered-by');
app.use(cookieParser());


const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// }));
app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (por ejemplo, herramientas como Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


app.use(express.json());

app.use('/v1/alerts', alertsRoutes);
app.use('/v1/auth', authRouter);
app.use('/v1/patients', verifyToken, patientRoutes);
app.use('/v1/pharmacist', verifyToken, pharmacistRoutes);
app.use('/v1/verify-key', tokenNewPassword);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
