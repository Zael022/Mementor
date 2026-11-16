// Herramientas de texto para fragmentar documentos y medir relevancia por palabras.

export const SECTION_CHARS = 1200;
const OVERLAP_CHARS = 150;

// Palabras frecuentes que no aportan al tema de una pregunta.
const STOPWORDS = new Set([
  'para', 'como', 'cual', 'cuales', 'cuando', 'donde', 'esta', 'este', 'esto', 'estos', 'estas', 'esas', 'esos', 'aquel',
  'sobre', 'tiene', 'tienen', 'hace', 'hacer', 'puede', 'pueden', 'puedes', 'quiero', 'necesito', 'favor', 'explica',
  'explicame', 'explicalo', 'dame', 'dime', 'pista', 'solo', 'sola', 'forma', 'manera', 'diferente', 'sencilla', 'otra',
  'otro', 'mismo', 'misma', 'entre', 'desde', 'hasta', 'porque', 'pero', 'tambien', 'muy', 'mas', 'menos', 'cada',
  'todo', 'toda', 'todos', 'todas', 'algo', 'alguna', 'alguno', 'unos', 'unas', 'segun', 'tengo', 'tenemos', 'existe',
  'significa', 'quiere', 'decir', 'respuesta', 'completa', 'sirve', 'hola', 'gracias', 'entonces', 'ahora', 'despues',
  'antes', 'cuanto', 'cuantos', 'cuantas', 'curso', 'leccion', 'tema', 'what', 'that', 'this', 'with', 'from', 'have',
  'que', 'por', 'del', 'las', 'los', 'una', 'uno', 'con', 'sin', 'son', 'ser', 'hay', 'sus', 'the', 'and',
  'de', 'la', 'el', 'en', 'un', 'es', 'se', 'al', 'lo', 'si', 'su', 'ya', 'mi', 'me', 'te', 'tu', 'no', 'ni',
  'mis', 'tus', 'nos', 'vos', 'soy', 'fue', 'era', 'sea', 'esa', 'ese', 'les',
  'to', 'of', 'in', 'is', 'it', 'as', 'an', 'or', 'at', 'on', 'by', 'we', 'us', 'be', 'do', 'if', 'so',
  // Números escritos con letras: aparecen en casi cualquier texto y no indican el tema.
  'cero', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece',
  'catorce', 'quince', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'cien', 'ciento', 'cientos', 'mil', 'millon',
  'millones', 'primer', 'primero', 'primera', 'segundo', 'segunda', 'tercer', 'tercero', 'tercera', 'mitad', 'doble',
]);

// Quita tildes y pasa a minúsculas para comparar.
export function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Reduce plurales comunes para que «fracciones» coincida con «fraccion».
function stem(word) {
  if (word.length > 5 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

// Conserva términos cortos y siglas, excluyendo palabras vacías.
export function terms(text) {
  const words = normalize(text).match(/[a-z0-9]{2,}/g) || [];
  // Se revisa la palabra y su forma sin plural («primeras» → «primera»).
  return words.filter((word) => !STOPWORDS.has(word)).map(stem).filter((word) => !STOPWORDS.has(word));
}

// Cada fragmento conserva el rango exacto del original y se solapa con el siguiente.
export function splitSections(body, limit = SECTION_CHARS) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('El tamaño de fragmento debe ser un entero positivo.');
  const text = String(body || '');
  const sections = [];
  const overlap = Math.min(OVERLAP_CHARS, Math.floor(limit / 8));
  let start = 0;
  while (start < text.length) {
    const leading = text.slice(start, start + limit).match(/^\s*/)[0].length;
    start += leading;
    if (start === text.length) break;
    let end = Math.min(start + limit, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const paragraph = window.lastIndexOf('\n\n');
      const boundaries = [...window.matchAll(/[.!?](?=\s)|\s+/g)];
      const boundary = paragraph >= limit / 2 ? paragraph : boundaries.at(-1)?.index;
      if (boundary >= limit / 2) end = start + boundary + 1;
    }
    const content = text.slice(start, end).trimEnd();
    if (content) {
      sections.push({ text: content, start, end: start + content.length, heading: null, section: sections.length + 1 });
    }
    if (end === text.length) break;
    const nextStart = Math.max(start + 1, end - overlap);
    const whitespace = text.slice(nextStart, end).search(/\s/);
    start = whitespace >= 0 ? nextStart + whitespace + 1 : nextStart;
  }
  // Recorre los títulos una sola vez, incluso en documentos largos.
  const headings = [...text.matchAll(/^#{1,6}[ \t]+(.+)$/gm)];
  let headingIndex = 0;
  let heading = null;
  for (const section of sections) {
    while (headingIndex < headings.length && headings[headingIndex].index <= section.start) {
      heading = headings[headingIndex++][1].trim().slice(0, 120);
    }
    section.heading = heading;
  }
  return sections;
}

// Cuenta cuántas palabras distintas de la pregunta aparecen en el texto.
export function relevance(queryTerms, text) {
  const wanted = new Set(queryTerms);
  const found = new Set(terms(text).filter((word) => wanted.has(word)));
  return found.size;
}

// Mínimo de coincidencias para considerar que un fragmento respalda la pregunta.
export function requiredMatches(queryTerms) {
  const distinct = new Set(queryTerms).size;
  if (distinct === 0) return Infinity;
  return distinct >= 4 ? 2 : 1;
}

// Colapsa espacios y guarda la posición original de cada carácter.
function normalizedWithMap(text) {
  let output = '';
  const starts = [];
  const ends = [];
  let lastSpace = true;
  let offset = 0;
  for (const original of String(text)) {
    const normalized = /\s/.test(original) ? ' ' : normalize(original);
    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index];
      if (char === ' ' && lastSpace) continue;
      output += char;
      starts.push(offset);
      ends.push(offset + original.length);
      lastSpace = char === ' ';
    }
    if (!normalized && ends.length) ends[ends.length - 1] = offset + original.length;
    offset += original.length;
  }
  return { output, starts, ends };
}

// Comprueba el pasaje completo y conserva sus límites tras normalizar espacios y tildes.
export function locatePassageRange(fullText, passage) {
  const needle = normalize(passage).replace(/\s+/g, ' ').trim();
  if (needle.length < 20) return null;
  const exact = fullText.indexOf(passage);
  if (exact >= 0) return { start: exact, end: exact + passage.length };
  const haystack = normalizedWithMap(fullText);
  const index = haystack.output.indexOf(needle);
  return index < 0 ? null : { start: haystack.starts[index], end: haystack.ends[index + needle.length - 1] };
}

export function locatePassage(fullText, passage) {
  return locatePassageRange(fullText, passage)?.start ?? -1;
}

// Indica la página donde cae una posición, si el documento la tiene.
export function pageAt(pages, offset) {
  if (!Array.isArray(pages) || offset < 0) return null;
  const page = pages.find((item) => offset >= item.start && offset < item.end);
  return page ? page.page : null;
}

// Busca el título de sección Markdown más cercano antes de una posición.
export function headingAt(text, offset) {
  if (offset < 0) return null;
  const before = String(text).slice(0, offset + 1);
  const headings = [...before.matchAll(/^#{1,6}\s+(.+)$/gm)];
  return headings.length ? headings[headings.length - 1][1].trim().slice(0, 120) : null;
}
