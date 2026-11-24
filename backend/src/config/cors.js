import { AppError } from '../utils/AppError.js';

// Orígenes del frontend autorizados a usar la API (sin comodín «*»: con cookies de sesión no se permite).
export function readAllowedOrigins() {
  return (process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
}

// CORS estricto: solo los orígenes de la lista, los métodos y encabezados que usa la aplicación,
// y un 403 explícito para cualquier otro origen (en lugar de solo omitir los encabezados).
// Las peticiones sin Origin (servidor a servidor, como n8n o curl) no son de un navegador y siguen
// pasando por la sesión, el CSRF y los permisos de cada ruta.
export function corsOptions(allowedOrigins) {
  return {
    origin(origin, done) {
      if (!origin || allowedOrigins.includes(origin)) return done(null, true);
      return done(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origen no permitido.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-CSRF-Token'],
    exposedHeaders: ['X-Content-SHA256', 'Content-Disposition'],
    maxAge: 600,
  };
}
