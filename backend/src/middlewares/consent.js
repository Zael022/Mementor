import { pendingConsents } from '../services/consentService.js';
import { AppError } from '../utils/AppError.js';

// Con términos o privacidad pendientes, el servidor no procesa operaciones nuevas: el diálogo de la interfaz
// no basta como protección. Siguen disponibles leer, aceptar las políticas, cerrar sesión, descargar los datos
// propios y pedir la baja.
const ALLOWED = [
  /^\/api\/v1\/auth\//,
  /^\/api\/v1\/me\/consents$/,
  /^\/api\/v1\/me\/deletion-request$/,
];

export async function requireCurrentConsents(req, res, next) {
  if (!req.user || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (ALLOWED.some((pattern) => pattern.test(req.path))) return next();
  const pending = await pendingConsents(req.user.id);
  if (pending.length) {
    throw new AppError(403, 'CONSENT_REQUIRED', 'Antes de continuar debes aceptar la versión vigente de los términos y del aviso de privacidad.', pending);
  }
  next();
}
