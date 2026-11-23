// Fechas de calendario AAAA-MM-DD estrictas: el formato no basta, porque «2026-02-30» tiene la forma
// correcta y JavaScript la convertiría en silencio en otra fecha (2 de marzo).
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value) {
  const match = FORMATO.exec(String(value ?? ''));
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Si JavaScript tuvo que «acomodar» la fecha, no existía.
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Lanza un error claro cuando una fecha interna no es válida (en lugar de normalizarla).
export function assertCalendarDate(value) {
  if (!isCalendarDate(value)) throw new RangeError(`Fecha de calendario no válida: ${value}`);
  return value;
}
