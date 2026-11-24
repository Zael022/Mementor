import { randomUUID } from 'node:crypto';
import { recordRequest } from '../utils/requestMetrics.js';
import rateLimit from 'express-rate-limit';
import { invalid } from '../utils/AppError.js';
import { MysqlRateLimitStore } from '../services/rateLimitStore.js';

// Asigna un identificador a cada solicitud.
export function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}

// Plantilla de la ruta atendida. Express ya restauró baseUrl al terminar, así que el prefijo se toma
// de la dirección real quitando tantos tramos como tiene la ruta («/api/v1» + «/courses/:courseId»).
function routeTemplate(req) {
  if (!req.route || typeof req.route.path !== 'string') return 'sin_ruta';
  const segments = req.originalUrl.split('?')[0].split('/').filter(Boolean);
  const routeSegments = req.route.path.split('/').filter(Boolean);
  const prefix = segments.slice(0, Math.max(0, segments.length - routeSegments.length));
  return `/${[...prefix, ...routeSegments].join('/')}`;
}

// Registra cada solicitud al terminar: una línea JSON con el id, la ruta (sin ids ni parámetros), el estado y la duración.
// Se guarda la plantilla de la ruta (por ejemplo /api/v1/courses/:courseId) para no escribir datos personales ni tokens.
export function requestLog(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10;
    const route = routeTemplate(req);
    recordRequest({ route: `${req.method} ${route}`, status: res.statusCode, durationMs });
    if (process.env.NODE_ENV === 'test' && !process.env.LOG_REQUESTS) return;
    const line = { evento: 'solicitud', requestId: req.requestId, metodo: req.method, ruta: route, estado: res.statusCode, ms: durationMs };
    (res.statusCode >= 500 ? console.error : console.info)(JSON.stringify(line));
  });
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
// Por defecto cuenta por IP. Con `key` cuenta por cuenta o correo: así cambiar la IP aparente
// (por ejemplo con un X-Forwarded-For falso) no sirve para saltarse el límite de una cuenta.
export function limiter({ name, windowMinutes, max, key }) {
  const shared = (process.env.RATE_LIMIT_STORE || 'memory').trim().toLowerCase() === 'mysql';
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    // En pruebas el límite es alto salvo que la prueba fije otro.
    limit: process.env.NODE_ENV === 'test' ? Number(process.env.RATE_LIMIT_TEST_MAX || 10000) : max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(key ? { keyGenerator: (req) => `${name}:${key(req)}` } : {}),
    ...(shared ? { store: new MysqlRateLimitStore(name) } : {}),
    handler: (req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
        requestId: req.requestId,
      });
    },
  });
}
