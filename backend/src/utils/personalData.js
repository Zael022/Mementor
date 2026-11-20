// Detección acotada: no garantiza identificar todos los datos sensibles.
export const PERSONAL_PATTERNS = [
  { type: 'correo', regex: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  { type: 'cédula', regex: /(?<![\d-])[1-9]-?\d{4}-?\d{4}(?![\d-])/g },
  { type: 'teléfono', regex: /(?<![\d-])(?:\+?506[\s-]?)?[2-8]\d{3}[\s-]?\d{4}(?![\d-])/g },
];
export function redactPersonalData(text) {
  return PERSONAL_PATTERNS.reduce((value, { type, regex }) => value.replace(regex, `[${type} omitido]`), String(text));
}
