import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../utils/AppError.js';

const DEFAULT_URLS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
};

let testDoubles = null;

// Permite a las pruebas sustituir al proveedor; no se puede usar fuera de NODE_ENV=test.
export function setAiProviderForTests(doubles) {
  if (process.env.NODE_ENV !== 'test') throw new Error('El proveedor de prueba solo se usa en NODE_ENV=test.');
  testDoubles = doubles;
}

// Router de modelos: cada tarea pide un nivel y el modelo sale del entorno, nunca del código.
// AI_MODEL_RAPIDO y AI_MODEL_AVANZADO son opcionales; si faltan, se usa AI_MODEL (despliegues anteriores siguen igual).
export const MODEL_TIERS = ['rapido', 'avanzado'];
const TIER_VARIABLE = { rapido: 'AI_MODEL_RAPIDO', avanzado: 'AI_MODEL_AVANZADO' };

export function modelForTier(tier = 'avanzado') {
  const specific = (process.env[TIER_VARIABLE[tier]] || '').trim();
  return specific || (process.env.AI_MODEL || '').trim();
}

// Lee la configuración del proveedor de IA desde el entorno para un nivel de modelo.
export function readAiConfig({ tier = 'avanzado' } = {}) {
  const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY || '').trim();
  const model = modelForTier(tier);
  const missing = [];
  if (!provider) missing.push('AI_PROVIDER');
  if (!apiKey) missing.push('AI_API_KEY');
  if (!model) missing.push(`${TIER_VARIABLE[tier] ?? 'AI_MODEL'} o AI_MODEL`);
  if (missing.length > 0) return { configured: false, reason: `Falta configurar ${missing.join(', ')} en el servidor.` };
  if (!DEFAULT_URLS[provider]) return { configured: false, reason: `AI_PROVIDER "${provider}" no es compatible (usa anthropic u openai).` };
  return { configured: true, provider, apiKey, model, tier, url: (process.env.AI_BASE_URL || '').trim() || DEFAULT_URLS[provider] };
}

// Prompt caching del proveedor: solo con AI_PROMPT_CACHE=on y para bloques largos y estables.
// Cada modelo tiene un mínimo de tokens (entre 512 y 4096 según el modelo): por debajo, el proveedor no guarda nada.
export const promptCacheEnabled = () => (process.env.AI_PROMPT_CACHE || '').trim().toLowerCase() === 'on';
const promptCacheMinChars = () => Number(process.env.AI_PROMPT_CACHE_MIN_TOKENS || 1024) * 4;

// Los mensajes pueden traer bloques { text, cache: true }. Anthropic recibe cache_control en esos bloques;
// el formato compatible con OpenAI recibe texto plano (allí la caché de prefijos es automática).
export function toProviderMessages(provider, messages) {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    if (provider !== 'anthropic') return { role: message.role, content: message.content.map((block) => block.text).join('\n') };
    return {
      role: message.role,
      content: message.content.map((block) => ({
        type: 'text',
        text: block.text,
        ...(block.cache && promptCacheEnabled() && block.text.length >= promptCacheMinChars() ? { cache_control: { type: 'ephemeral' } } : {}),
      })),
    };
  });
}

// Tokens leídos o escritos en la caché del proveedor, si los informa.
const anthropicCacheUsage = (usage) => ({ cacheReadTokens: usage?.cache_read_input_tokens, cacheWriteTokens: usage?.cache_creation_input_tokens });

// Arma la solicitud según el formato de cada proveedor (también la usa la verificación de `npm run ia:verificar`).
export function buildRequest(config, { system, messages, maxTokens }) {
  if (config.provider === 'anthropic') {
    return {
      headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: { model: config.model, max_tokens: maxTokens, system, messages: toProviderMessages('anthropic', messages) },
      readText: (json) => (json.content || []).filter((block) => block.type === 'text').map((block) => block.text).join('\n'),
      readUsage: (json) => ({ inputTokens: json.usage?.input_tokens, outputTokens: json.usage?.output_tokens, ...anthropicCacheUsage(json.usage) }),
    };
  }
  // La API oficial usa max_completion_tokens; los servicios compatibles suelen usar max_tokens.
  const limitField = config.url === DEFAULT_URLS.openai ? 'max_completion_tokens' : 'max_tokens';
  return {
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: { model: config.model, [limitField]: maxTokens, messages: [{ role: 'system', content: system }, ...toProviderMessages('openai', messages)] },
    readText: (json) => json.choices?.[0]?.message?.content || '',
    readUsage: (json) => ({ inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens, cacheReadTokens: json.usage?.prompt_tokens_details?.cached_tokens }),
  };
}

// Avisa con un error claro cuando falta la configuración de IA.
export function assertAiConfigured({ tier = 'avanzado' } = {}) {
  if (testDoubles) return { configured: true, provider: 'prueba', model: testDoubles.models?.[tier] ?? 'modelo-de-prueba', tier };
  const config = readAiConfig({ tier });
  if (!config.configured) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', `La generación con IA no está configurada. ${config.reason}`);
  }
  return config;
}

// Envía la consulta al proveedor real y espera la respuesta completa (ruta JSON).
export async function completeWithProvider({ system, messages, maxTokens = 800, timeoutMs = 20000, signal, tier = 'avanzado' }) {
  if (testDoubles?.complete) return testDoubles.complete({ system, messages, maxTokens, signal, tier });
  const config = assertAiConfigured({ tier });
  const request = buildRequest(config, { system, messages, maxTokens });
  let response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AppError(503, 'AI_UNAVAILABLE', 'No se pudo contactar al proveedor de IA. Intenta más tarde.');
  }
  if (!response.ok) {
    console.error('Proveedor de IA respondió con estado', response.status);
    throw new AppError(503, 'AI_UNAVAILABLE', 'El proveedor de IA no pudo responder. Intenta más tarde.');
  }
  const json = await response.json().catch(() => ({}));
  const text = request.readText(json);
  if (!text) throw new AppError(503, 'AI_UNAVAILABLE', 'El proveedor de IA devolvió una respuesta vacía.');
  return { text, model: config.model, provider: config.provider, usage: request.readUsage(json) };
}

// Base del SDK a partir de AI_BASE_URL (que apunta al endpoint completo de mensajes).
function anthropicBaseUrl(config) {
  return config.url === DEFAULT_URLS.anthropic ? undefined : config.url.replace(/\/v1\/messages\/?$/, '');
}

// Respuesta en streaming: entrega cada trozo de texto con onText y devuelve el mensaje final.
// Con OpenAI se conserva la ruta existente sin streaming y el texto llega en un solo trozo.
export async function streamWithProvider({ system, messages, maxTokens = 900, signal, onText, timeoutMs = 60000, tier = 'avanzado' }) {
  if (testDoubles?.stream) return testDoubles.stream({ system, messages, maxTokens, signal, onText, tier });
  const config = assertAiConfigured({ tier });
  if (config.provider !== 'anthropic') {
    const result = await completeWithProvider({ system, messages, maxTokens, signal, timeoutMs, tier });
    onText(result.text);
    return result;
  }
  const client = new Anthropic({ apiKey: config.apiKey, baseURL: anthropicBaseUrl(config), maxRetries: 2, timeout: timeoutMs });
  const stream = client.messages.stream({ model: config.model, max_tokens: maxTokens, system, messages: toProviderMessages('anthropic', messages) }, { signal });
  stream.on('text', (delta) => onText(delta));
  try {
    const final = await stream.finalMessage();
    const text = final.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
    return {
      text, model: final.model || config.model, provider: 'anthropic', stopReason: final.stop_reason,
      usage: { inputTokens: final.usage?.input_tokens, outputTokens: final.usage?.output_tokens, ...anthropicCacheUsage(final.usage) },
    };
  } catch (error) {
    if (signal?.aborted || error instanceof Anthropic.APIUserAbortError) throw new AppError(499, 'CANCELLED', 'La consulta se canceló.');
    // Se informa el estado sin reenviar detalles del proveedor al cliente.
    console.error('Streaming del proveedor falló', error?.status ?? error?.name);
    throw new AppError(503, 'AI_UNAVAILABLE', 'El proveedor de IA interrumpió la respuesta. Intenta de nuevo.');
  }
}
