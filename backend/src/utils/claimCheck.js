import { normalize, terms } from './textChunks.js';

// Verificación determinista de afirmaciones del tutor contra los pasajes que cita.
// Una cita válida no basta: cada oración con contenido debe estar respaldada por el pasaje.
// No es una prueba de verdad. Detecta:
// - números que no están en la fuente;
// - números que la fuente asocia a otra cosa (por ejemplo, nota y asistencia intercambiadas);
// - afirmaciones que niegan lo que la fuente afirma, o al revés;
// - oraciones sin relación con el pasaje.

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
// «por ciento» indica porcentaje, no el número cien.
const percent = (text) => text.replace(/\bpor\s+ciento\b/g, ' porciento ');

export function numbersIn(text) {
  const plain = percent(normalize(text));
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

// Palabras que invierten el sentido de lo que viene después. «sin» queda fuera: suele ser parte del tema («sin costo»).
const NEGATIONS = new Set(['no', 'ni', 'nunca', 'jamas', 'tampoco', 'ningun', 'ninguna', 'ninguno', 'nadie', 'nada']);
// Términos que se miran a cada lado de un número para saber a qué se refiere.
const NUMBER_CONTEXT = 3;
// Términos que alcanza una negación y distancia a la que una negación afecta a un término.
const NEGATION_SCOPE = 3;
const NEGATION_REACH = 4;
// Diferencia mínima para decir que un número está asociado a otra cosa: evita rechazar paráfrasis dudosas.
const CONTEXT_MARGIN = 2;

function numberValue(token) {
  if (/^\d/.test(token)) {
    const thousands = /^\d{1,3}([.,]\d{3})+$/.test(token);
    const value = thousands ? Number(token.replace(/[.,]/g, '')) : Number(token.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }
  return token in NUMBER_WORDS && !ARTICLES.has(token) ? NUMBER_WORDS[token] : null;
}

// Convierte un texto en una secuencia de piezas: número, negación o término de contenido, por oración.
function tokenize(text) {
  return percent(normalize(text))
    .replace(/\[s\d{1,2}\]/g, ' ')
    .split(/[.!?;:\n]+/)
    .map((sentence) => (sentence.match(/\d+(?:[.,]\d+)*|[a-z0-9]+/g) || []).flatMap((word) => {
      if (NEGATIONS.has(word)) return [{ kind: 'neg' }];
      const value = numberValue(word);
      if (value !== null) return [{ kind: 'num', value }];
      const [term] = terms(word);
      return term ? [{ kind: 'term', term }] : [];
    }))
    .filter((tokens) => tokens.length);
}

// Para cada número, los términos más cercanos antes y después dentro de su oración, sin pasar de otro número.
function numberContexts(sentences) {
  const contexts = [];
  for (const tokens of sentences) {
    tokens.forEach((token, index) => {
      if (token.kind !== 'num') return;
      const near = new Set();
      for (const step of [-1, 1]) {
        let taken = 0;
        for (let at = index + step; at >= 0 && at < tokens.length && taken < NUMBER_CONTEXT; at += step) {
          if (tokens[at].kind === 'num') break;
          if (tokens[at].kind === 'term') { near.add(tokens[at].term); taken += 1; }
        }
      }
      contexts.push({ value: token.value, near });
    });
  }
  return contexts;
}

const overlap = (a, b) => [...a].filter((term) => b.has(term)).length;

// Un número de la oración está mal asociado si su contexto se parece claramente más al de otro número de la fuente.
function misplacedNumbers(claimSentences, supportSentences) {
  const bySource = new Map();
  for (const { value, near } of numberContexts(supportSentences)) {
    const known = bySource.get(value) || new Set();
    near.forEach((term) => known.add(term));
    bySource.set(value, known);
  }
  if (bySource.size < 2) return [];
  const misplaced = [];
  for (const { value, near } of numberContexts(claimSentences)) {
    const own = overlap(near, bySource.get(value) || new Set());
    const best = Math.max(...[...bySource].filter(([other]) => other !== value).map(([, context]) => overlap(near, context)));
    if (best >= own + CONTEXT_MARGIN) misplaced.push(value);
  }
  return misplaced;
}

// Términos alcanzados por una negación y términos que aparecen sin ninguna negación cerca.
function polarity(sentences) {
  const negated = [];
  const affirmed = new Set();
  const seenNegated = new Set();
  for (const tokens of sentences) {
    tokens.forEach((token, index) => {
      if (token.kind === 'neg') {
        const scope = [];
        for (let at = index + 1; at < tokens.length && scope.length < NEGATION_SCOPE; at += 1) {
          if (tokens[at].kind === 'term') scope.push(tokens[at].term);
        }
        if (scope.length) negated.push(scope);
      }
      if (token.kind !== 'term') return;
      const before = tokens.slice(Math.max(0, index - NEGATION_REACH), index);
      if (before.some((item) => item.kind === 'neg')) seenNegated.add(token.term);
      else affirmed.add(token.term);
    });
  }
  // Un término que alguna vez aparece negado no cuenta como afirmado: ante la duda, no se rechaza.
  seenNegated.forEach((term) => affirmed.delete(term));
  return { negated, affirmed };
}

// Una negación contradice al otro texto si lo que niega aparece allí afirmado.
function contradicts(from, to) {
  return polarity(from).negated.some((scope) => {
    const { affirmed } = polarity(to);
    const found = scope.filter((term) => affirmed.has(term)).length;
    return found >= Math.min(2, scope.length);
  });
}

// Revisa una oración contra el texto que la respalda.
export function checkClaim(sentence, supportText) {
  const clean = sentence.replace(/\[S\d{1,2}\]/g, '');
  const supportNumbers = numbersIn(supportText);
  const missingNumbers = [...numbersIn(clean)].filter((value) => !supportNumbers.has(value));
  if (missingNumbers.length) return { ok: false, reason: 'number_not_in_source', missingNumbers };
  const claimTokens = tokenize(clean);
  const supportTokens = tokenize(supportText);
  const misplaced = misplacedNumbers(claimTokens, supportTokens);
  if (misplaced.length) return { ok: false, reason: 'number_context_mismatch', misplacedNumbers: misplaced };
  const claimTerms = [...new Set(terms(clean))];
  if (claimTerms.length < 3) return { ok: true };
  const supportTerms = new Set(terms(supportText));
  const covered = claimTerms.filter((term) => supportTerms.has(term) || [...supportTerms].some((other) => other.length > 4 && term.length > 4 && (other.startsWith(term.slice(0, 5)) || term.startsWith(other.slice(0, 5)))));
  const coverage = covered.length / claimTerms.length;
  if (coverage < MIN_COVERAGE) return { ok: false, reason: 'low_overlap', coverage };
  // Se compara contra la oración del pasaje que más se parece, para no mezclar el sentido de oraciones distintas.
  const claimSet = new Set(claimTerms);
  const closest = supportTokens
    .map((tokens) => ({ tokens, shared: overlap(new Set(tokens.filter((t) => t.kind === 'term').map((t) => t.term)), claimSet) }))
    .sort((a, b) => b.shared - a.shared);
  const top = closest.filter((item) => item.shared > 0 && item.shared >= closest[0].shared - 1).map((item) => item.tokens);
  if (top.length && (contradicts(claimTokens, top) || contradicts(top, claimTokens))) return { ok: false, reason: 'negation_mismatch', coverage };
  return { ok: true, coverage };
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
