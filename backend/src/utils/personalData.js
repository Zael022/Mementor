// Detección y ocultamiento de datos personales comunes en Costa Rica antes de enviar texto a un proveedor de IA.
// Es una red de seguridad determinista: no reconoce nombres propios, por eso los avisos piden no escribirlos.

const PATTERNS = [
  { type: 'cédula', label: '[cédula oculta]', regex: /(?<![\d-])[1-9]-?\d{4}-?\d{4}(?![\d-])/g },
  { type: 'teléfono', label: '[teléfono oculto]', regex: /(?<![\d-])(?:\+?506[\s-]?)?[2-8]\d{3}[\s-]?\d{4}(?![\d-])/g },
  { type: 'correo', label: '[correo oculto]', regex: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  { type: 'enlace', label: '[enlace oculto]', regex: /\bhttps?:\/\/[^\s<>"']+/gi },
];

// Lista lo encontrado con una muestra enmascarada (nunca el valor completo).
export function detectPersonalData(text) {
  return PATTERNS.filter(({ type }) => type !== 'enlace').flatMap(({ type, regex }) => [...String(text).matchAll(regex)].map((match) => ({
    type,
    sample: `${match[0].slice(0, 2)}…${match[0].slice(-2)}`,
  }))).slice(0, 20);
}

// Reemplaza cédulas, teléfonos, correos y, si se pide, enlaces por una etiqueta neutra.
export function redactPersonalData(text, { links = true } = {}) {
  let result = String(text ?? '');
  for (const { type, label, regex } of PATTERNS) {
    if (type === 'enlace' && !links) continue;
    result = result.replace(regex, label);
  }
  return result;
}

// Valores completos encontrados, solo para comparaciones internas del servidor (nunca se registran ni se devuelven).
export function findPersonalData(text, { links = false } = {}) {
  return PATTERNS.filter(({ type }) => links || type !== 'enlace')
    .flatMap(({ type, regex }) => [...String(text ?? '').matchAll(regex)].map((match) => ({ type, value: match[0] })));
}
