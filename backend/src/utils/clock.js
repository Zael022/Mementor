import { assertCalendarDate } from './dates.js';
// Reloj de la aplicación: las pruebas pueden reemplazar «now» para simular otros días.
export const clock = {
  now: () => new Date(),
};

// Zona horaria con la que se decide qué día es para la racha (por defecto, Costa Rica).
export function appTimeZone() {
  return process.env.APP_TIMEZONE || 'America/Costa_Rica';
}

// Devuelve la fecha local como texto AAAA-MM-DD.
export function dayKey(date = clock.now(), timeZone = appTimeZone()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Suma (o resta) días a una fecha AAAA-MM-DD sin depender de la zona horaria del servidor.
export function addDays(day, amount) {
  assertCalendarDate(day);
  const [year, month, date] = day.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + amount));
  return moved.toISOString().slice(0, 10);
}
