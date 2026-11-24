import { Op } from 'sequelize';
import { AgentRun, sequelize } from '../models/index.js';
import { latestRate } from './external/exchangeRateService.js';

const DAY_MS = 24 * 3600000;

// Precio por millón de tokens en USD; solo se usa si la institución lo configura (no se inventan tarifas).
function prices(provider, model) {
  try {
    const configured = JSON.parse(process.env.AI_MODEL_PRICES_JSON || '[]');
    const match = configured.find((p) => p.provider === provider && p.model === model && p.input >= 0 && p.output >= 0);
    if (match) return { input: match.input, output: match.output };
  } catch { /* Una configuración inválida no se convierte en un precio cero. */ }
  if (!provider || !model || provider !== process.env.AI_PROVIDER || model !== process.env.AI_MODEL) return null;
  const input = Number(process.env.AI_PRICE_INPUT_USD_PER_MTOK);
  const output = Number(process.env.AI_PRICE_OUTPUT_USD_PER_MTOK);
  return input > 0 && output > 0 ? { input, output } : null;
}

// Tokens de los últimos días (tutor y agentes) y costo estimado en dólares y colones con el tipo de cambio de venta.
export async function estimateCost(user, { days = 30 } = {}) {
  const span = Math.min(Math.max(Number(days) || 30, 1), 90);
  const rows = await AgentRun.findAll({
    where: { institutionId: user.institutionId, createdAt: { [Op.gte]: new Date(Date.now() - span * DAY_MS) } },
    attributes: [
      'provider', 'model',
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('input_tokens')), 0), 'inputTokens'],
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('output_tokens')), 0), 'outputTokens'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'runs'],
      [sequelize.literal('COUNT(*) - COUNT(input_tokens) + COUNT(*) - COUNT(output_tokens)'), 'missingUsage'],
    ],
    group: ['provider', 'model'],
    raw: true,
  });
  const byModel = rows.map((row) => {
    const price = prices(row.provider, row.model);
    return { provider: row.provider, model: row.model, inputTokens: Number(row.inputTokens), outputTokens: Number(row.outputTokens), runs: Number(row.runs), price, missingUsage: Number(row.missingUsage), usd: price && !Number(row.missingUsage) ? (Number(row.inputTokens) * price.input + Number(row.outputTokens) * price.output) / 1e6 : null };
  });
  const tokens = byModel.reduce((a, r) => ({ input: a.input + r.inputTokens, output: a.output + r.outputTokens, runs: a.runs + r.runs }), { input: 0, output: 0, runs: 0 });
  let rate = null;
  let rateError = null;
  try {
    rate = await latestRate();
  } catch (error) {
    rateError = error.message;
  }
  const known = byModel.length > 0 && byModel.every((r) => r.usd !== null);
  const usd = known ? byModel.reduce((sum, row) => sum + row.usd, 0) : null;
  return {
    days: span,
    tokens,
    priceConfigured: known,
    byModel,
    estimateAssumption: 'Estimación con tarifas configuradas por modelo al consultar; no es facturación ni una tarifa histórica verificada. El tutor se cuenta una vez desde agent_runs.',
    usd: usd === null ? null : Math.round(usd * 10000) / 10000,
    crc: usd !== null && rate ? Math.round(usd * rate.sell * 100) / 100 : null,
    rate,
    rateError,
  };
}
