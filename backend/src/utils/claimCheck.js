import { normalize, terms } from './textChunks.js';

// Verificación determinista de afirmaciones del tutor contra los pasajes que cita.
// Una cita válida no basta: cada oración con contenido debe estar respaldada por el pasaje.
// No es una prueba de verdad: detecta números que no están en la fuente y oraciones sin relación con ella.

const NUMBER_WORDS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, quinientos: 500, mil: 1000,
  medio: 0.5, media: 0.5, mitad: 0.5, doble: 2, triple: 3,
};
// «un», «una» y «uno» casi siempre son artículos: solo cuentan como número si van con cifras o unidades.
const ARTICLES = new Set(['un', 'una', 'uno']);
// Mínimo de términos propios de la oración que deben aparecer en el pasaje citado.
export const MIN_COVERAGE = 0.34;

// Números de un texto: cifras (3, 4,5, 1.000) y números escritos con letras.
export function numbersIn(text) {
  const plain = normalize(text);
  const found = new Set();
  for (const match of plain.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const raw = match[0];
    // 1.000 o 1,000 de miles; 4,5 o 4.5 decimal.
    const thousands = /^\d{1,3}([.,]\d{3})+$/.test(raw);
    const value = thousands ? Number(raw.replace(/[.,]/g, '')) : Number(raw.replace(',', '.'));
    if (Number.isFinite(value)) found.add(value);
  }
  for (const word of plain.match(/[a-z]+/g) || []) {
    if (word in NUMBER_WORDS && !ARTICLES.has(word)) found.add(NUMBER_WORDS[word]);
  }
  return found;
}

// Divide una respuesta en oraciones conservando las marcas [S1] de cada una.
export function splitClaims(answer) {
  return String(answer || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map((sentence) => sentence.replace(/^[\s>*#\-\d.)]+/, '').trim())
    .filter(Boolean);
}

const markersOf = (sentence) => [...sentence.matchAll(/\[(S\d{1,2})\]/g)].map((match) => match[1]);

// Una oración necesita respaldo si afirma algo: tiene números o al menos tres términos de contenido.
function needsSupport(sentence) {
  return numbersIn(sentence.replace(/\[S\d{1,2}\]/g, '')).size > 0 || terms(sentence.replace(/\[S\d{1,2}\]/g, '')).length >= 3;
}

// Revisa una oración contra el texto que la respalda.
export function checkClaim(sentence, supportText) {
  const clean = sentence.replace(/\[S\d{1,2}\]/g, '');
  const supportNumbers = numbersIn(supportText);
  const missingNumbers = [...numbersIn(clean)].filter((value) => !supportNumbers.has(value));
  if (missingNumbers.length) return { ok: false, reason: 'number_not_in_source', missingNumbers };
  const claimTerms = [...new Set(terms(clean))];
  if (claimTerms.length < 3) return { ok: true };
  const supportTerms = new Set(terms(supportText));
  const covered = claimTerms.filter((term) => supportTerms.has(term) || [...supportTerms].some((other) => other.length > 4 && term.length > 4 && (other.startsWith(term.slice(0, 5)) || term.startsWith(other.slice(0, 5)))));
  const coverage = covered.length / claimTerms.length;
  return coverage >= MIN_COVERAGE ? { ok: true, coverage } : { ok: false, reason: 'low_overlap', coverage };
}

// Verifica toda la respuesta. Las oraciones con marca se comparan con sus fuentes;
// las que no tienen marca, con el conjunto de fuentes citadas.
export function verifyAnswer(answer, citedSources) {
  if (!citedSources.length) return { ok: false, failures: [{ sentence: null, reason: 'no_sources' }] };
  const byId = new Map(citedSources.map((source) => [source.sourceId, source.text || '']));
  const allText = citedSources.map((source) => source.text || '').join('\n');
  const failures = [];
  let checked = 0;
  for (const sentence of splitClaims(answer)) {
    if (!needsSupport(sentence)) continue;
    const ids = markersOf(sentence).filter((id) => byId.has(id));
    const support = ids.length ? ids.map((id) => byId.get(id)).join('\n') : allText;
    const result = checkClaim(sentence, support);
    checked += 1;
    if (!result.ok) failures.push({ sentence, ...result });
  }
  // Una respuesta sin afirmaciones verificables (por ejemplo, una pregunta de vuelta) no tiene nada que contradecir.
  return { ok: failures.length === 0, checked, failures };
}
