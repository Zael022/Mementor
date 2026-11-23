import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import routes from './routes/index.js';
import { readTrustProxy } from './config/proxy.js';
import { corsOptions, readAllowedOrigins } from './config/cors.js';
import { requestId } from './middlewares/common.js';
import { csrfProtection, loadSession } from './middlewares/auth.js';
import { requireCurrentConsents } from './middlewares/consent.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

// Orígenes del frontend autorizados a usar la API.
const allowedOrigins = readAllowedOrigins();

// Configura la API y sus rutas.
const app = express();
app.disable('x-powered-by');
// Detrás de un proxy, los límites por IP necesitan la IP real del cliente y no la del proxy.
const trustProxy = readTrustProxy();
if (trustProxy !== null) app.set('trust proxy', trustProxy);
app.use(requestId);
app.use(helmet());
app.use(cors(corsOptions(allowedOrigins)));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(loadSession);
app.use(csrfProtection(allowedOrigins));
app.use(requireCurrentConsents);
app.use(compression({
  filter: (req, res) => !String(res.getHeader('Content-Type') || '').startsWith('text/event-stream') && compression.filter(req, res),
}));
app.use('/api/v1', routes);
app.use(notFoundHandler);
app.use(errorHandler);
export default app;
