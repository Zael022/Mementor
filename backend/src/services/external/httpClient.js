import { IntegrationRun } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';

// Registra cada llamada externa o entrada desde n8n en la bitácora de integraciones.
export async function logIntegration({ integration, direction, status, detail = null, latencyMs = null }) {
  await IntegrationRun.create({ integration, direction, status, detail: detail ? String(detail).slice(0, 255) : null, latencyMs });
}

let fetchForTests = null;
// Permite simular respuestas externas en las pruebas; no se usa fuera de NODE_ENV=test.
export function setExternalFetchForTests(fake) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Solo para pruebas.');
  fetchForTests = fake;
}

// GET a una API externa con tiempo límite, manejo de errores y registro; nunca expone credenciales al frontend.
export async function getJson(url, { integration, timeoutMs = 8000, headers = {} }) {
  const startedAt = Date.now();
  try {
    const response = await (fetchForTests || fetch)(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    await logIntegration({ integration, direction: 'outbound', status: 'ok', latencyMs: Date.now() - startedAt });
    return json;
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    await logIntegration({ integration, direction: 'outbound', status: 'error', detail: timedOut ? 'Tiempo de espera agotado' : error.message, latencyMs: Date.now() - startedAt });
    throw new AppError(503, 'EXTERNAL_UNAVAILABLE', timedOut ? 'El servicio externo tardó demasiado en responder.' : 'El servicio externo no respondió correctamente.');
  }
}
