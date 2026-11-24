import { checkClaim, numbersIn, splitClaims } from './claimCheck.js';
import { findPersonalData } from './personalData.js';
import { normalize, terms } from './textChunks.js';

// Guardrails de salida: revisan lo que devuelve el modelo antes de mostrarlo.
// Un bloqueo reemplaza la respuesta por un mensaje claro; una alerta solo queda en la bitácora.

export const GUARD_MESSAGES = {
  personal_data: 'La respuesta incluía datos personales (cédula, teléfono o correo) que no vienen del material autorizado, así que no se muestra. Intenta de nuevo.',
  unsupported_claim: 'La respuesta incluía cifras o afirmaciones que no están en el material, así que no se muestra. Intenta de nuevo.',
  unsupported_number: 'El texto incluía fechas o cifras que no están en tu indicación, así que no se muestra. Escribe en la indicación los datos que quieres incluir.',
  off_topic: 'El texto generado se alejaba del curso y de tu indicación, así que no se muestra. Prueba con una indicación más concreta.',
  external_link: 'La respuesta recomendaba enlaces que no están en el material ni en tu indicación, así que no se muestra.',
  assessment_answer: 'Esta pregunta es de una evaluación abierta. El tutor puede darte pistas, pero no la respuesta: inténtalo con las pistas o consulta a tu docente.',
};

// Frases típicas de inyección en material, entregas o preguntas. Solo generan una alerta: la defensa real es asData + el prompt.
const INJECTION = /\b(ignora|olvida|omite|desobedece)\b[^.\n]{0,40}\b(instrucciones|reglas|indicaciones)\b|\bignore\b[^.\n]{0,30}\binstructions\b|\bsystem prompt\b|\b(prompt|mensaje) (del|de) sistema\b|\bact[uú]a como\b|\beres ahora\b|\bda(me)? la (respuesta|nota) (correcta|m[aá]xima)\b|\bnota m[aá]xima\b/i;
export const looksLikeInjection = (text) => INJECTION.test(String(text ?? ''));

// Junta todo el texto de una salida (objetos y listas anidados).
export function textsOf(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textsOf);
  return [];
}

const digitsOnly = (value) => value.replace(/\D/g, '');
const sameValue = (type, a, b) => (type === 'correo' ? a.toLowerCase() === b.toLowerCase() : digitsOnly(a) === digitsOnly(b));

// Datos personales en la salida que no estaban en el material autorizado (lo que el docente publicó sí puede citarse).
export function personalDataLeaks(output, allowedText = '') {
  const allowed = findPersonalData(allowedText);
  return textsOf(output).flatMap((text) => findPersonalData(text))
    .filter((found) => !allowed.some((known) => known.type === found.type && sameValue(found.type, known.value, found.value)));
}

// Enlaces en la salida que no aparecen en la entrada: el modelo no debe recomendar sitios externos.
export function externalLinks(output, allowedText = '') {
  const allowed = new Set(findPersonalData(allowedText, { links: true }).filter((item) => item.type === 'enlace').map((item) => item.value.toLowerCase()));
  return textsOf(output).flatMap((text) => findPersonalData(text, { links: true }))
    .filter((item) => item.type === 'enlace' && !allowed.has(item.value.toLowerCase()));
}

// Cifras de la salida que no están en la entrada.
export function numbersOutside(output, allowedText) {
  const allowed = numbersIn(allowedText);
  return [...new Set(textsOf(output).flatMap((text) => [...numbersIn(text)]))].filter((value) => !allowed.has(value));
}

// Revisión de hechos frente a un texto: números ausentes o mal asociados y negaciones contrarias.
// La poca coincidencia de palabras no cuenta aquí (un resumen o una explicación pueden parafrasear).
const FACT_REASONS = new Set(['number_not_in_source', 'number_context_mismatch', 'negation_mismatch']);
export function unsupportedFacts(texts, supportText) {
  return texts.flatMap((text) => splitClaims(text))
    .map((sentence) => ({ sentence, check: checkClaim(sentence, supportText) }))
    .filter(({ check }) => !check.ok && FACT_REASONS.has(check.reason))
    .map(({ check }) => check.reason);
}

// Qué parte de las palabras de la salida aparece en la entrada: muy poca indica un tema ajeno.
export function topicCoverage(output, allowedText) {
  const outputTerms = [...new Set(textsOf(output).flatMap((text) => terms(text)))];
  if (outputTerms.length < 4) return 1;
  const allowed = new Set(terms(allowedText));
  const prefix = (term) => term.slice(0, 5);
  const allowedPrefixes = new Set([...allowed].map(prefix));
  return outputTerms.filter((term) => allowed.has(term) || (term.length > 4 && allowedPrefixes.has(prefix(term)))).length / outputTerms.length;
}

// Clave de una evaluación abierta en la respuesta: la opción correcta escrita o «la respuesta es la b».
export function revealsAnswerKey(answer, matchedItems) {
  const plain = normalize(answer);
  if (/\b(respuesta|opcion)\s+(correcta\s+)?es\s+(la\s+)?\(?[a-d]\)?(?![a-z])/.test(plain)) return true;
  return matchedItems.some((item) => item.correct.some((option) => {
    const key = normalize(option).trim();
    if (!key) return false;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Opciones con palabras: basta con que aparezcan; opciones cortas o numéricas: solo si se presentan como resultado.
    if (/[a-z]/.test(key) && key.length >= 4) return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(plain);
    return new RegExp(`(=|\\bes\\b|\\bson\\b|\\bresultado\\b[^.]{0,20}|\\brespuesta\\b[^.]{0,20})\\s*${escaped}([^0-9]|$)`).test(plain);
  }));
}

// Une el resultado de las revisiones en un código para la bitácora: «pass», «alert_<motivo>» o «blocked_<motivo>».
export function guardCode({ block, alert }) {
  if (block) return `blocked_${block}`;
  if (alert) return `alert_${alert}`;
  return 'pass';
}
