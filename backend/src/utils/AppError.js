// Error controlado que la API convierte en una respuesta JSON.
export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthenticated = (message = 'Debes iniciar sesión.') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'No tienes permiso para realizar esta acción.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'No se encontró el recurso solicitado.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code, message) => new AppError(409, code, message);
export const invalid = (message, details) => new AppError(422, 'VALIDATION_ERROR', message, details);
