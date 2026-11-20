import { AppError, unauthenticated } from '../utils/AppError.js';
import { safeEqual } from '../utils/security.js';

// Autentica a n8n con una clave compartida (encabezado x-integration-key), comparada en tiempo constante.
export function requireIntegrationKey(req, res, next) {
  const key = process.env.N8N_INTEGRATION_KEY || '';
  if (key.length < 32) throw new AppError(503, 'INTEGRATION_NOT_CONFIGURED', 'La integración con n8n no está configurada (N8N_INTEGRATION_KEY).');
  if (!safeEqual(req.get('x-integration-key'), key)) throw unauthenticated('Clave de integración inválida.');
  next();
}
