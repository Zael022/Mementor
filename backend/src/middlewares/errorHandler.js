import { AppError } from '../utils/AppError.js';

// Responde cuando la ruta no existe.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' }, requestId: req.requestId });
}

// Controla errores sin revelar información interna.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
      requestId: req.requestId,
    });
  }
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'El cuerpo de la solicitud no es válido.' }, requestId: req.requestId });
  }
  if (error?.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido.' : 'No se pudo recibir el archivo.';
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message }, requestId: req.requestId });
  }
  if (error?.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ error: { code: 'IN_USE', message: 'No se puede eliminar porque tiene registros relacionados.' }, requestId: req.requestId });
  }
  const dbDown = String(error?.name || '').startsWith('SequelizeConnection');
  if (process.env.NODE_ENV !== 'test') console.error(`[${req.requestId}]`, error?.name, error?.message);
  return res.status(dbDown ? 503 : 500).json({
    error: { code: dbDown ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.' },
    requestId: req.requestId,
  });
}
