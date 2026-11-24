import { createHash } from 'node:crypto';
import { Op } from 'sequelize';
import { AiResponseCache } from '../../models/index.js';

// Caché de respuestas de agentes con entrada idéntica y no personal (hoy, solo el resumen de lección).
// La llave une institución, agente, versión del prompt, modelo y huella de la entrada exacta:
// si cambia la lección, el prompt o el modelo, la llave cambia y no se reutiliza nada viejo.
// Nunca se guardan conversaciones del tutor ni entradas escritas por una persona.

const sha = (text) => createHash('sha256').update(text).digest('hex');
const ttlHours = () => Number(process.env.AI_RESPONSE_CACHE_TTL_HOURS || 168);
export const responseCacheEnabled = () => (process.env.AI_RESPONSE_CACHE || 'on').trim().toLowerCase() !== 'off';

export function cacheKey({ institutionId, agent, promptVersion, model, system, messages }) {
  const inputHash = sha(JSON.stringify({ system, messages }));
  return sha(JSON.stringify([institutionId, agent, promptVersion, model, inputHash]));
}

export async function readCache(key) {
  const row = await AiResponseCache.findOne({ where: { cacheKey: key, expiresAt: { [Op.gt]: new Date() } } });
  if (!row) return null;
  await AiResponseCache.increment('hits', { where: { id: row.id } });
  return row.outputJson;
}

export async function writeCache(key, { institutionId, agent, promptVersion, model, sourceRef, output }) {
  const expiresAt = new Date(Date.now() + ttlHours() * 3600000);
  await AiResponseCache.upsert({ cacheKey: key, institutionId, agent, promptVersion, model, sourceRef, outputJson: output, hits: 0, expiresAt });
}

// Invalida lo guardado para una fuente que cambió o se retiró (por ejemplo «lesson:12»).
export async function invalidateSource(sourceRef) {
  return AiResponseCache.destroy({ where: { sourceRef } });
}

export async function purgeExpiredCache() {
  return AiResponseCache.destroy({ where: { expiresAt: { [Op.lte]: new Date() } } });
}
