import { Op } from 'sequelize';
import { AgentRun, AiUsageEvent, Institution, User, sequelize } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta } from '../utils/http.js';
import { readAiConfig } from './aiProvider.js';

// Cuota de consultas al tutor y registro técnico de consumo (sin contenido).

const DAY_MS = 24 * 3600000;
// Resultados que consumen cuota: los avisos sin llamada al modelo y las fallas del proveedor no cuentan.
const COUNTED = ['reserved', 'completed', 'no_citations', 'invalid_format', 'cancelled'];
const userLimit = () => Number(process.env.AI_DAILY_LIMIT_PER_USER || 40);
const institutionDefault = () => Number(process.env.AI_DAILY_LIMIT_PER_INSTITUTION || 2000);

// Reserva una consulta dentro de una transacción con bloqueo: dos pedidos simultáneos no superan el límite.
export async function reserveQuestion(user, courseId, { streamed = false } = {}) {
  return sequelize.transaction(async (transaction) => {
    // Orden fijo de bloqueo (institución y luego usuario) para evitar bloqueos cruzados.
    const institution = await Institution.findByPk(user.institutionId, { lock: transaction.LOCK.UPDATE, transaction });
    await User.findByPk(user.id, { lock: transaction.LOCK.UPDATE, transaction });
    const since = new Date(Date.now() - DAY_MS);
    const mine = await AiUsageEvent.count({ where: { userId: user.id, outcome: COUNTED, createdAt: { [Op.gte]: since } }, transaction });
    if (mine >= userLimit()) {
      throw new AppError(429, 'RATE_LIMITED', 'Alcanzaste el límite diario de consultas al tutor.');
    }
    const institutionLimit = institution?.aiDailyQuestionLimit ?? institutionDefault();
    const shared = await AiUsageEvent.count({ where: { institutionId: user.institutionId, outcome: COUNTED, createdAt: { [Op.gte]: since } }, transaction });
    if (shared >= institutionLimit) {
      throw new AppError(429, 'INSTITUTION_QUOTA', 'Tu institución alcanzó su tope diario de consultas al tutor. Intenta mañana o avisa a la administración.');
    }
    return AiUsageEvent.create({ institutionId: user.institutionId, userId: user.id, courseId, streamed }, { transaction });
  });
}

// Cierra la reserva con el resultado, el modelo, la latencia y los tokens que informó el proveedor.
export async function finishQuestion(event, { outcome, provider = null, model = null, retrievalMode = null, startedAt = null, usage = null }) {
  if (!event) return;
  await event.update({
    outcome,
    provider,
    model,
    retrievalMode,
    latencyMs: startedAt ? Date.now() - startedAt : null,
    inputTokens: Number.isFinite(usage?.inputTokens) ? usage.inputTokens : null,
    outputTokens: Number.isFinite(usage?.outputTokens) ? usage.outputTokens : null,
  });
  // El tutor también queda en la bitácora común de agentes (sin contenido).
  await AgentRun.create({
    institutionId: event.institutionId, userId: event.userId, courseId: event.courseId, agent: 'tutor',
    status: { completed: 'completed', no_evidence: 'no_evidence' }[outcome] ?? 'failed',
    provider, model, latencyMs: event.latencyMs, inputTokens: event.inputTokens, outputTokens: event.outputTokens, errorCode: outcome === 'completed' ? null : outcome,
  });
  if (process.env.NODE_ENV !== 'test') {
    // Registro técnico sin credenciales, preguntas, respuestas ni contenido de documentos.
    console.info(JSON.stringify({ evento: 'tutor.consulta', id: event.id, outcome, model, latencyMs: event.latencyMs, inputTokens: event.inputTokens, outputTokens: event.outputTokens }));
  }
}

// Resumen de consumo de la institución para su administración; no calcula costos.
export async function institutionUsage(user, { days = 30 } = {}) {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * DAY_MS);
  const where = { institutionId: user.institutionId, createdAt: { [Op.gte]: since } };
  const byModel = await AiUsageEvent.findAll({
    where: { ...where, outcome: 'completed' },
    attributes: [
      'provider', 'model',
      [sequelize.fn('COUNT', sequelize.col('id')), 'answers'],
      [sequelize.fn('SUM', sequelize.col('input_tokens')), 'inputTokens'],
      [sequelize.fn('SUM', sequelize.col('output_tokens')), 'outputTokens'],
      [sequelize.fn('AVG', sequelize.col('latency_ms')), 'avgLatencyMs'],
    ],
    group: ['provider', 'model'],
    raw: true,
  });
  const byOutcome = await AiUsageEvent.findAll({
    where, attributes: ['outcome', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['outcome'], raw: true,
  });
  const institution = await Institution.findByPk(user.institutionId);
  const today = await AiUsageEvent.count({ where: { institutionId: user.institutionId, outcome: COUNTED, createdAt: { [Op.gte]: new Date(Date.now() - DAY_MS) } } });
  const assistants = await AgentRun.count({ where: { institutionId: user.institutionId, agent: { [Op.ne]: 'tutor' }, status: { [Op.ne]: 'no_evidence' }, createdAt: { [Op.gte]: new Date(Date.now() - DAY_MS) } } });
  const config = readAiConfig();
  return {
    days,
    dailyLimit: institution?.aiDailyQuestionLimit ?? institutionDefault(),
    perUserDailyLimit: userLimit(),
    usedLast24h: today,
    byModel: byModel.map((row) => ({
      provider: row.provider, model: row.model, answers: Number(row.answers),
      inputTokens: Number(row.inputTokens || 0), outputTokens: Number(row.outputTokens || 0), avgLatencyMs: Math.round(Number(row.avgLatencyMs || 0)),
    })),
    byOutcome: Object.fromEntries(byOutcome.map((row) => [row.outcome, Number(row.count)])),
    costs: null,
    providerState: config.configured ? 'Configurado, conectividad sin verificar' : 'Sin configurar',
    configuredModel: config.configured ? config.model : null,
    assistants: { usedLast24h: assistants, perUserDailyLimit: Number(process.env.AGENT_DAILY_LIMIT_PER_USER || 30), institutionDailyLimit: Number(process.env.AGENT_DAILY_LIMIT_PER_INSTITUTION || 500) },
  };
}

// Lista técnica paginada para auditoría (sin contenido).
export async function listUsageEvents(user, pagination) {
  const { rows, count } = await AiUsageEvent.findAndCountAll({
    where: { institutionId: user.institutionId }, order: [['id', 'DESC']], limit: pagination.limit, offset: pagination.offset,
  });
  return {
    data: rows.map((row) => ({
      id: row.id, userId: row.userId, courseId: row.courseId, provider: row.provider, model: row.model, outcome: row.outcome,
      streamed: row.streamed, latencyMs: row.latencyMs, inputTokens: row.inputTokens, outputTokens: row.outputTokens, createdAt: row.createdAt,
    })),
    meta: pageMeta(pagination, count),
  };
}

// La plataforma ajusta los topes de una institución (vacío = valor por defecto del servidor).
export async function updateInstitutionLimits(institutionId, { maxDocuments, aiDailyQuestionLimit }) {
  const institution = await Institution.findByPk(institutionId);
  if (!institution) throw new AppError(404, 'NOT_FOUND', 'Institución no encontrada.');
  const changes = {};
  if (maxDocuments !== undefined) changes.maxDocuments = maxDocuments;
  if (aiDailyQuestionLimit !== undefined) changes.aiDailyQuestionLimit = aiDailyQuestionLimit;
  await institution.update(changes);
  return { id: institution.id, maxDocuments: institution.maxDocuments, aiDailyQuestionLimit: institution.aiDailyQuestionLimit };
}
