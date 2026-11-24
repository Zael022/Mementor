import { Op } from 'sequelize';
import { AgentRun, Institution, User, sequelize } from '../../models/index.js';
import { clock } from '../../utils/clock.js';
import { AppError, forbidden, invalid, notFound } from '../../utils/AppError.js';
import { AGENT_COMMON_PROMPT, agentPromptVersion } from '../../prompts/index.js';
import { GUARD_MESSAGES, guardCode } from '../../utils/outputGuard.js';
import { MODEL_TIERS, assertAiConfigured, completeWithProvider } from '../aiProvider.js';
import { AGENTS } from './agentRegistry.js';
import { cacheKey, readCache, responseCacheEnabled, writeCache } from './responseCache.js';

const DAY_MS = 24 * 3600000;
const dailyLimit = () => Number(process.env.AGENT_DAILY_LIMIT_PER_USER || 30);

// Reglas comunes (versionadas en src/prompts/comun.js); se conserva el nombre para quien ya lo importa.
export const COMMON_RULES = AGENT_COMMON_PROMPT.text.system;

// Nivel de modelo de un agente: el del catálogo, o el que fije AI_TIER_<AGENTE> (rapido | avanzado).
export function tierFor(agent) {
  const override = (process.env[`AI_TIER_${agent.key.toUpperCase()}`] || '').trim().toLowerCase();
  return MODEL_TIERS.includes(override) ? override : (agent.tier ?? 'avanzado');
}

// Catálogo visible para un rol (sin detalles internos).
export function catalogFor(user) {
  return Object.values(AGENTS)
    .filter((agent) => agent.roles.includes(user.role))
    .map(({ key, name, purpose, roles, inputs, provider, privacy, link }) => ({ key, name, purpose, roles, inputs, provider, privacy, link: link ?? null }));
}

// Extrae y valida el JSON de la respuesta del modelo.
export function parseJson(text, schema) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Reserva un turno respetando el límite diario por persona (bloqueo para que dos pedidos no lo superen).
async function reserve(user, agent, courseId, inputChars, trace) {
  return sequelize.transaction(async (transaction) => {
    if (user.institutionId) await Institution.findByPk(user.institutionId, { lock: transaction.LOCK.UPDATE, transaction });
    await User.findByPk(user.id, { lock: transaction.LOCK.UPDATE, transaction });
    const since = new Date(clock.now() - DAY_MS);
    const used = await AgentRun.count({
      // Cuentan las ejecuciones que llamaron al modelo, aunque su resultado se descartara.
      // Las respuestas servidas desde la caché no cuentan: no llamaron al modelo. El tutor tiene su propia cuota.
      where: {
        userId: user.id, agent: { [Op.ne]: 'tutor' }, cacheHit: false, createdAt: { [Op.gte]: since },
        [Op.or]: [{ status: { [Op.ne]: 'no_evidence' } }, { model: { [Op.ne]: null } }],
      },
      transaction,
    });
    if (used >= dailyLimit()) throw new AppError(429, 'RATE_LIMITED', 'Alcanzaste el límite diario de uso de los asistentes de IA.');
    const shared = await AgentRun.count({
      where: {
        institutionId: user.institutionId, agent: { [Op.ne]: 'tutor' }, cacheHit: false, createdAt: { [Op.gte]: since },
        [Op.or]: [{ status: { [Op.ne]: 'no_evidence' } }, { model: { [Op.ne]: null } }],
      },
      transaction,
    });
    if (shared >= Number(process.env.AGENT_DAILY_LIMIT_PER_INSTITUTION || 500)) throw new AppError(429, 'INSTITUTION_QUOTA', 'La institución alcanzó su límite diario de asistentes de IA.');
    return AgentRun.create({ institutionId: user.institutionId, userId: user.id, courseId, agent, inputChars, ...trace }, { transaction });
  });
}

// Texto del mensaje: las plantillas pueden devolver bloques (para marcar lo que conviene guardar en la caché del proveedor).
const asContent = (built) => (Array.isArray(built) ? built : String(built));

const usageFields = (response) => ({
  inputTokens: response.usage?.inputTokens ?? null,
  outputTokens: response.usage?.outputTokens ?? null,
  cacheReadTokens: Number.isFinite(response.usage?.cacheReadTokens) ? response.usage.cacheReadTokens : null,
  cacheWriteTokens: Number.isFinite(response.usage?.cacheWriteTokens) ? response.usage.cacheWriteTokens : null,
});

// Ejecuta un agente: permisos, cuota, contexto autorizado, router, caché, llamada al modelo, guardrails y bitácora.
export async function runAgent(user, key, rawInput, { workflow = false } = {}) {
  const agent = Object.hasOwn(AGENTS, key) ? AGENTS[key] : null;
  if (!agent || agent.external || !Array.isArray(agent.roles) || !agent.inputSchema || typeof agent.buildContext !== 'function') throw notFound('Asistente no encontrado.');
  if (agent.workflowOnly && !workflow) throw invalid('Abre una solicitud de admisiones para generar y guardar un borrador revisable.');
  if (!agent.roles.includes(user.role)) throw forbidden('Tu rol no puede usar este asistente.');
  const parsed = agent.inputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw invalid('Revisa los datos del asistente.', parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })));
  }
  const input = parsed.data;
  const promptVersion = agentPromptVersion(key);
  const modelTier = tierFor(agent);

  // El contexto se arma antes de llamar al modelo y aplica los permisos del curso o del recurso.
  // El modelo nunca elige qué datos lee: solo recibe lo que el servidor ya autorizó.
  const context = await agent.buildContext(user, input);
  const inputChars = JSON.stringify(context.data ?? {}).length;
  if (inputChars > 50000) throw invalid('El contexto supera el tamaño permitido para este asistente.');
  if (context.noEvidence) {
    const run = await AgentRun.create({
      institutionId: user.institutionId, userId: user.id, courseId: context.courseId ?? null, agent: key, inputChars, status: 'no_evidence', promptVersion, modelTier,
    });
    return { runId: run.id, status: 'no_evidence', message: context.noEvidence, result: null };
  }

  const config = assertAiConfigured({ tier: modelTier });
  const system = `${COMMON_RULES}\n\n${agent.system}`;
  const messages = [{ role: 'user', content: asContent(agent.prompt(context)) }];
  const startedAt = Date.now();

  // Caché: solo agentes cuya entrada no es personal (el contexto lo declara) y solo dentro de la institución.
  const cacheable = Boolean(context.cache) && responseCacheEnabled();
  const key64 = cacheable ? cacheKey({ institutionId: user.institutionId, agent: key, promptVersion, model: config.model, system, messages }) : null;
  if (cacheable) {
    const cached = await readCache(key64);
    if (cached) {
      const run = await AgentRun.create({
        institutionId: user.institutionId, userId: user.id, courseId: context.courseId ?? null, agent: key, inputChars,
        status: 'completed', provider: config.provider, model: config.model, outputChars: JSON.stringify(cached).length,
        latencyMs: Date.now() - startedAt, inputTokens: 0, outputTokens: 0, promptVersion, modelTier, cacheHit: true, guardOutcome: 'pass',
      });
      return { runId: run.id, status: 'completed', result: cached, sources: context.sources ?? [] };
    }
  }

  const run = await reserve(user, key, context.courseId ?? null, inputChars, { promptVersion, modelTier });
  try {
    // Respuestas JSON largas (varias preguntas, un informe) pueden tardar más que el tutor: hasta 45 s.
    const response = await completeWithProvider({ system, messages, maxTokens: agent.maxTokens ?? 1200, tier: modelTier, timeoutMs: agent.timeoutMs ?? 45000 });
    const output = parseJson(response.text, agent.outputSchema);
    if (!output) throw new AppError(502, 'AGENT_INVALID_OUTPUT', 'El asistente devolvió una respuesta con formato inesperado. Intenta de nuevo.');
    const base = { provider: response.provider ?? config.provider, model: response.model ?? config.model, latencyMs: Date.now() - startedAt, ...usageFields(response) };

    // Guardrails de salida: un bloqueo reemplaza el resultado por un mensaje claro; una alerta solo se registra.
    const verdict = agent.guard ? (agent.guard(output, context) ?? {}) : {};
    const guardOutcome = guardCode(verdict);
    if (verdict.block) {
      await run.update({ status: 'failed', errorCode: 'AI_OUTPUT_BLOCKED', guardOutcome, ...base });
      throw new AppError(422, 'AI_OUTPUT_BLOCKED', GUARD_MESSAGES[verdict.block]);
    }

    const result = agent.finalize ? agent.finalize(output, context) : output;
    // Si la validación descartó todo, se informa como falta de respaldo y no como resultado.
    if (typeof result?.noEvidence === 'string') {
      await run.update({ status: 'no_evidence', guardOutcome, ...base });
      return { runId: run.id, status: 'no_evidence', message: result.noEvidence, result: null };
    }
    await run.update({ status: 'completed', outputChars: JSON.stringify(result).length, guardOutcome, ...base });
    if (cacheable) {
      await writeCache(key64, { institutionId: user.institutionId, agent: key, promptVersion, model: base.model, sourceRef: context.cache.sourceRef, output: result });
    }
    return { runId: run.id, status: 'completed', result, sources: context.sources ?? [] };
  } catch (error) {
    if (error.code !== 'AI_OUTPUT_BLOCKED') await run.update({ status: 'failed', latencyMs: Date.now() - startedAt, errorCode: error.code || 'AGENT_ERROR' });
    throw error;
  }
}

// Últimas ejecuciones propias o de la institución (administración y auditoría).
export async function listRuns(user, { scope }) {
  const where = scope === 'institution' ? { institutionId: user.institutionId } : { userId: user.id };
  const rows = await AgentRun.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  return rows.map((row) => ({
    id: row.id, agent: row.agent, name: AGENTS[row.agent]?.name ?? row.agent, status: row.status, courseId: row.courseId,
    model: row.model, inputTokens: row.inputTokens, outputTokens: row.outputTokens, latencyMs: row.latencyMs,
    errorCode: row.errorCode, promptVersion: row.promptVersion, modelTier: row.modelTier, cacheHit: row.cacheHit, guardOutcome: row.guardOutcome,
    createdAt: row.createdAt, ...(scope === 'institution' ? { userId: row.userId } : {}),
  }));
}
