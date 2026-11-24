// Error de la API con su código para mostrar mensajes útiles.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let csrfToken = null;

const SIN_SERVICIO = 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.';

// Una sola forma de tratar los errores HTTP, igual para peticiones normales y para el streaming del tutor.
function errorDeRespuesta(response, payload, path) {
  const error = payload?.error || {};
  // Si el JWT venció o se cerró la sesión en otro lado, la aplicación vuelve al inicio de sesión.
  if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('mentor:sesion-vencida'));
  // Términos o privacidad renovados: la aplicación vuelve a mostrar el diálogo de aceptación.
  if (response.status === 403 && error.code === 'CONSENT_REQUIRED') {
    window.dispatchEvent(new CustomEvent('mentor:consentimiento-pendiente', { detail: error.details || [] }));
  }
  if (!error.code && response.status >= 500) return new ApiError(response.status, 'SERVICE_UNAVAILABLE', SIN_SERVICIO);
  const detail = Array.isArray(error.details) && error.details.length && error.code !== 'CONSENT_REQUIRED'
    ? ` ${error.details.map((item) => item.message).filter(Boolean).join(' ')}` : '';
  return new ApiError(response.status, error.code || 'ERROR', `${error.message || 'No se pudo completar la solicitud.'}${detail}`.trim(), error.details);
}

// Guarda el token CSRF que entrega el backend al iniciar sesión.
export function setCsrfToken(token) {
  csrfToken = token;
}

// Consulta la API y comunica posibles errores.
async function request(method, path, body, { signal } = {}) {
  const headers = {};
  const esArchivo = body instanceof FormData;
  if (body !== undefined && !esArchivo) headers['content-type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['x-csrf-token'] = csrfToken;

  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined || esArchivo ? body : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.');
  }
  if (response.status === 204) return { data: null };

  let payload;
  try {
    payload = await response.json();
  } catch {
    // Una página de error del proxy (HTML) o un cuerpo vacío: la API no está respondiendo.
    if (!response.ok) throw errorDeRespuesta(response, null, path);
    throw new ApiError(response.status, 'SERVICE_UNAVAILABLE', SIN_SERVICIO);
  }
  if (!response.ok) throw errorDeRespuesta(response, payload, path);
  return payload;
}

// Abre una respuesta en streaming (SSE sobre POST) y entrega cada evento a onEvento.
async function stream(path, body, { signal, onEvento }) {
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
      credentials: 'include',
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.');
  }
  // Antes de abrir el flujo, los errores llegan como JSON (por ejemplo 429 o 503).
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const payload = await response.json().catch(() => null);
    if (response.ok) throw new ApiError(response.status, 'SERVICE_UNAVAILABLE', SIN_SERVICIO);
    throw errorDeRespuesta(response, payload, path);
  }
  const lector = response.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  // Al cancelar se cierra el lector de forma explícita; así ningún navegador sigue entregando trozos.
  const cancelar = () => lector.cancel().catch(() => {});
  signal?.addEventListener('abort', cancelar, { once: true });
  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (signal?.aborted) throw new DOMException('La respuesta se canceló.', 'AbortError');
      if (done) break;
      pendiente = (pendiente + decodificador.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      const bloques = pendiente.split('\n\n');
      pendiente = bloques.pop();
      for (const bloque of bloques) {
        const evento = bloque.match(/^event: ?(.+)$/m)?.[1];
        const datos = [...bloque.matchAll(/^data: ?(.*)$/gm)].map((linea) => linea[1]).join('\n');
        if (evento && datos) onEvento(evento, JSON.parse(datos));
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancelar);
    await lector.cancel().catch(() => {});
    lector.releaseLock();
  }
}

export const api = {
  stream,
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body = {}, options) => request('POST', path, body, options),
  patch: (path, body = {}) => request('PATCH', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData),
};
