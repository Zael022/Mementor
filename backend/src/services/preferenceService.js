import { UserPreference } from '../models/index.js';
import { invalid } from '../utils/AppError.js';

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
};
const FIELDS = Object.keys(DEFAULT_PREFERENCES);

// Comprueba que la zona horaria exista en la base IANA del entorno.
export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const toDto = (row) => Object.fromEntries(FIELDS.map((field) => [field, row ? row[field] : DEFAULT_PREFERENCES[field]]));

// Devuelve las preferencias propias (o las de por defecto si nunca se guardaron).
export async function getPreferences(user, { transaction } = {}) {
  return toDto(await UserPreference.findByPk(user.id, { transaction }));
}

// Guarda solo los campos enviados; crea la fila la primera vez.
export async function updatePreferences(user, changes) {
  if (changes.timeZone && !isValidTimeZone(changes.timeZone)) throw invalid('Zona horaria no reconocida.');
  const [row] = await UserPreference.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id } });
  await row.update(changes);
  return toDto(row);
}
