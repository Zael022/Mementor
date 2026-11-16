import { GoogleAuth } from 'google-auth-library';

// Cliente REST de Google Cloud con Application Default Credentials (ADC).
// Las credenciales nunca se guardan en el repositorio: ADC las busca en el entorno del servidor.
const SCOPES = ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/drive.readonly'];

let auth = null;
let testTransport = null;

// Error de una llamada a Google con su estado HTTP, sin datos sensibles.
export class GoogleCallError extends Error {
  constructor(status, message, reason = null) {
    super(message);
    this.name = 'GoogleCallError';
    this.status = status;
    this.reason = reason;
  }
}

// Permite a las pruebas sustituir la red por un doble; no se puede usar fuera de NODE_ENV=test.
export function setGoogleTransportForTests(transport) {
  if (process.env.NODE_ENV !== 'test') throw new Error('El transporte de prueba solo se usa en NODE_ENV=test.');
  testTransport = transport;
}

// Llama a una API de Google y devuelve JSON, texto o bytes según se pida.
export async function googleRequest({ method = 'GET', url, body, contentType, responseType = 'json', timeoutMs = 30000 }) {
  if (testTransport) return testTransport({ method, url, body, contentType, responseType });

  auth ??= new GoogleAuth({ scopes: SCOPES });
  let headers;
  try {
    headers = await auth.getRequestHeaders(url);
  } catch {
    throw new GoogleCallError(401, 'No se encontraron credenciales de Google Cloud (Application Default Credentials).', 'NO_ADC');
  }
  if (contentType) headers.set('content-type', contentType);
  else if (body !== undefined && !(body instanceof Buffer) && typeof body !== 'string') headers.set('content-type', 'application/json');

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : (Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new GoogleCallError(0, `No se pudo contactar a Google Cloud (${error.name}).`, 'NETWORK');
  }
  if (!response.ok) {
    let reason = null;
    let message = `Google Cloud respondió ${response.status}.`;
    try {
      const payload = await response.json();
      reason = payload?.error?.status || payload?.error?.errors?.[0]?.reason || null;
      if (payload?.error?.message) message = `Google Cloud respondió ${response.status}: ${String(payload.error.message).slice(0, 200)}`;
    } catch { /* cuerpo sin JSON */ }
    throw new GoogleCallError(response.status, message, reason);
  }
  if (response.status === 204) return null;
  if (responseType === 'text') return response.text();
  if (responseType === 'buffer') return Buffer.from(await response.arrayBuffer());
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
