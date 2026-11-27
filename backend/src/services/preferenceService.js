import { UserPreference } from '../models/index.js';
import { invalid } from '../utils/AppError.js';
import { appTimeZone, dayKey } from '../utils/clock.js';

// Valores por defecto: siguen al sistema operativo y no imponen metas.
export const DEFAULT_PREFERENCES = {
  theme: 'system',
  textScale: 100,
  highContrast: false,
  reducedMotion: false,
  readingSpacing: false,
  underlineLinks: false,
  timeZone: null,
  dailyGoalMinutes: null,
  practiceSize: 5,
  emailReminders: true,
  // Mascotas (Orbi y Pausa) y celebraciones grandes: visibles salvo que la persona las oculte.
  showMascots: true,
  showBigCelebrations: true,
  // Pausa paseante (Parte A): pasea por defecto; «pausaHiddenToday» la esconde hasta que cambie el día.
  pausaWalks: true,
  pausaHiddenToday: false,
};
const FIELDS = Object.keys(DEFAULT_PREFERENCES).filter((field) => field !== 'pausaHiddenToday');

// Comprueba que la zona horaria exista en la base IANA del entorno.
export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// «Hoy» se decide con la zona horaria de la persona (o la de la aplicación).
const todayFor = (row) => dayKey(undefined, row?.timeZone || appTimeZone());

const toDto = (row) => ({
  ...Object.fromEntries(FIELDS.map((field) => [field, row ? row[field] : DEFAULT_PREFERENCES[field]])),
  pausaHiddenToday: Boolean(row?.pausaHiddenOn) && row.pausaHiddenOn === todayFor(row),
});

// Devuelve las preferencias propias (o las de por defecto si nunca se guardaron).
export async function getPreferences(user, { transaction } = {}) {
  return toDto(await UserPreference.findByPk(user.id, { transaction }));
}

// Guarda solo los campos enviados; crea la fila la primera vez.
export async function updatePreferences(user, changes) {
  if (changes.timeZone && !isValidTimeZone(changes.timeZone)) throw invalid('Zona horaria no reconocida.');
  const [row] = await UserPreference.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id } });
  const { pausaHiddenToday, ...rest } = changes;
  if (pausaHiddenToday !== undefined) {
    // Se guarda el día local; al día siguiente Pausa vuelve sola.
    rest.pausaHiddenOn = pausaHiddenToday ? dayKey(undefined, rest.timeZone || row.timeZone || appTimeZone()) : null;
  }
  await row.update(rest);
  return toDto(row);
}
