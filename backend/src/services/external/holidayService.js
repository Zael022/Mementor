import { invalid } from '../../utils/AppError.js';
import { getJson } from './httpClient.js';

// Feriados de Costa Rica desde Nager.Date (pública, sin clave); se guardan 24 horas en memoria.
const BASE = () => process.env.HOLIDAYS_URL || 'https://date.nager.at/api/v3/PublicHolidays';
const cache = new Map();
const DAY_MS = 24 * 3600000;

export function clearHolidayCache() {
  cache.clear();
}

export async function holidays(year) {
  const value = Number(year);
  if (!Number.isInteger(value) || value < 2000 || value > 2100) throw invalid('Año no válido.');
  const hit = cache.get(value);
  if (hit && Date.now() - hit.at < DAY_MS) return hit.list;
  const json = await getJson(`${BASE()}/${value}/CR`, { integration: 'api:feriados' });
  const list = (Array.isArray(json) ? json : [])
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item?.date))
    .map((item) => ({ date: item.date, name: item.localName || item.name }));
  cache.set(value, { at: Date.now(), list });
  return list;
}
