import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { invalid } from '../utils/AppError.js';
import { MysqlRateLimitStore } from '../services/rateLimitStore.js';

// Asigna un identificador a cada solicitud.
export function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}

// Valida el cuerpo con un esquema antes de llegar al controlador.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
      throw invalid('Revisa los datos enviados.', details);
    }
    req.body = result.data;
    next();
  };
}

// Limita solicitudes repetidas a rutas sensibles.
// Con RATE_LIMIT_STORE=mysql el conteo se comparte entre instancias; por defecto vive en memoria.
export function limiter({ name, windowMinutes, max }) {
  const shared = (process.env.RATE_LIMIT_STORE || 'memory').trim().toLowerCase() === 'mysql';
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    // En pruebas el límite es alto salvo que la prueba fije otro.
    limit: process.env.NODE_ENV === 'test' ? Number(process.env.RATE_LIMIT_TEST_MAX || 10000) : max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(shared ? { store: new MysqlRateLimitStore(name) } : {}),
    handler: (req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
        requestId: req.requestId,
      });
    },
  });
}
