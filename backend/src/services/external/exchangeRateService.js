import { ExchangeRate } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { dayKey } from '../../utils/clock.js';
import { getJson } from './httpClient.js';

// API pública del Ministerio de Hacienda que republica el tipo de cambio de referencia del BCCR.
const HACIENDA_URL = () => process.env.EXCHANGE_RATE_URL || 'https://api.hacienda.go.cr/indicadores/tc/dolar';

// Interpreta la respuesta aceptando las dos formas conocidas ({dolar:{compra,venta}} o {compra,venta}).
export function parseHacienda(json) {
  const dolar = json?.dolar ?? json;
  const buy = Number(dolar?.compra?.valor);
  const sell = Number(dolar?.venta?.valor);
  const date = String(dolar?.venta?.fecha || dolar?.compra?.fecha || '').slice(0, 10);
  if (!(buy > 0) || !(sell > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(502, 'EXTERNAL_FORMAT', 'La respuesta del tipo de cambio cambió de formato.');
  }
  return { date, buy, sell };
}

const rateDto = (row, stale) => ({ date: row.rateDate, buy: Number(row.buy), sell: Number(row.sell), source: row.source, updatedAt: row.updatedAt, stale });

// Guarda (o actualiza) el tipo de cambio de un día.
export async function saveRate({ date, buy, sell, source }) {
  const [row, created] = await ExchangeRate.findOrCreate({ where: { rateDate: date, source }, defaults: { buy, sell } });
  if (!created) await row.update({ buy, sell });
  return row;
}

// Tipo de cambio más reciente: usa el guardado de hoy; si no hay, consulta la API; si falla, devuelve el último conocido marcado como desactualizado.
export async function latestRate() {
  const last = await ExchangeRate.findOne({ order: [['rateDate', 'DESC'], ['updatedAt', 'DESC']] });
  if (last && last.rateDate === dayKey()) return rateDto(last, false);
  try {
    const parsed = parseHacienda(await getJson(HACIENDA_URL(), { integration: 'api:hacienda' }));
    return rateDto(await saveRate({ ...parsed, source: 'hacienda-bccr' }), false);
  } catch (error) {
    if (last) return rateDto(last, true);
    throw error;
  }
}
