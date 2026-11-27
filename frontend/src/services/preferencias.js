// Preferencias de apariencia y accesibilidad: se guardan en la cuenta y se aplican como atributos de <html>.
export const PREFERENCIAS_BASE = {
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
  showMascots: true,
  showBigCelebrations: true,
};

const CLAVE = 'mentor.preferencias';
export const EVENTO_PREFERENCIAS = 'mentor:preferencias';

// Traduce las preferencias a atributos que usa styles.css.
export function aplicarPreferencias(preferencias, raiz = document.documentElement) {
  const actual = { ...PREFERENCIAS_BASE, ...preferencias };
  const poner = (nombre, valor) => (valor ? raiz.setAttribute(nombre, valor) : raiz.removeAttribute(nombre));
  // Sin atributo de tema se sigue al sistema operativo.
  poner('data-tema', { light: 'claro', dark: 'oscuro' }[actual.theme] || null);
  poner('data-contraste', actual.highContrast ? 'alto' : null);
  poner('data-movimiento', actual.reducedMotion ? 'reducido' : null);
  poner('data-lectura', actual.readingSpacing ? 'espaciada' : null);
  poner('data-enlaces', actual.underlineLinks ? 'subrayados' : null);
  // Mascotas ocultas y celebraciones discretas (sin confeti ni stickers grandes).
  poner('data-mascotas', actual.showMascots === false ? 'ocultas' : null);
  poner('data-celebraciones', actual.showBigCelebrations === false ? 'discretas' : null);
  raiz.style.setProperty('--escala-texto', String((Number(actual.textScale) || 100) / 100));
  window.dispatchEvent(new CustomEvent(EVENTO_PREFERENCIAS, { detail: actual }));
  return actual;
}

// La copia local evita el parpadeo al abrir la página; la fuente de verdad es la cuenta.
export function leerPreferenciasLocales() {
  try {
    const guardadas = JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
    return guardadas && typeof guardadas === 'object' ? guardadas : null;
  } catch {
    return null;
  }
}

export function guardarPreferenciasLocales(preferencias) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(preferencias));
  } catch {
    // Sin almacenamiento (modo privado o bloqueado) las preferencias se aplican igual desde la cuenta.
  }
}

export function borrarPreferenciasLocales() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar si el almacenamiento no está disponible.
  }
}

// Zona horaria que informa el navegador; solo se usa como sugerencia visible y editable.
export function zonaDelNavegador() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
