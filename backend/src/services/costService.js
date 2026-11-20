import { Op } from 'sequelize';
import { AgentRun, sequelize } from '../models/index.js';
import { latestRate } from './external/exchangeRateService.js';

const DAY_MS = 24 * 3600000;

// Precio por millón de tokens en USD; solo se usa si la institución lo configura (no se inventan tarifas).
function prices() {
  const input = Number(process.env.AI_PRICE_INPUT_USD_PER_MTOK);
  const output = Number(process.env.AI_PRICE_OUTPUT_USD_PER_MTOK);
  return input > 0 && output > 0 ? { input, output } : null;
}

// Tokens de los últimos días (tutor y agentes) y costo estimado en dólares y colones con el tipo de cambio de venta.
export async function estimateCost(user, { days = 30 } = {}) {
  const span = Math.min(Math.max(Number(days) || 30, 1), 90);
  const [row] = await AgentRun.findAll({
    where: { institutionId: user.institutionId, createdAt: { [Op.gte]: new Date(Date.now() - span * DAY_MS) } },
    attributes: [
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('input_tokens')), 0), 'inputTokens'],
      [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('output_tokens')), 0), 'outputTokens'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'runs'],
    ],
    raw: true,
  });
  const tokens = { input: Number(row.inputTokens), output: Number(row.outputTokens), runs: Number(row.runs) };
  let rate = null;
  let rateError = null;
  try {
    rate = await latestRate();
  } catch (error) {
    rateError = error.message;
  }
  const price = prices();
  const usd = price ? (tokens.input / 1e6) * price.input + (tokens.output / 1e6) * price.output : null;
  return {
    days: span,
    tokens,
    priceConfigured: Boolean(price),
    usd: usd === null ? null : Math.round(usd * 10000) / 10000,
    crc: usd !== null && rate ? Math.round(usd * rate.sell * 100) / 100 : null,
    rate,
    rateError,
  };
}
