import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

// Extrae el texto de los formatos que el tutor puede consultar.

export const INDEXABLE_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

// Error de extracción con un código que la interfaz puede explicar.
export class ExtractionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const MIN_TEXT_CHARS = 20;

// Devuelve { text, pages } donde pages indica el rango de cada página en el texto.
export async function extractDocument(buffer, mimeType) {
  const kind = INDEXABLE_TYPES[mimeType];
  if (!kind) throw new ExtractionError('UNSUPPORTED_TYPE', 'Este formato no se puede indexar (usa PDF con texto, DOCX o TXT).');

  if (kind === 'pdf') {
    let pages;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      ({ text: pages } = await extractText(pdf, { mergePages: false }));
    } catch {
      throw new ExtractionError('PDF_UNREADABLE', 'No se pudo leer el PDF. Puede estar dañado o protegido con contraseña.');
    }
    let text = '';
    const ranges = [];
    pages.forEach((pageText, index) => {
      const clean = String(pageText || '').replace(/[ \t]+\n/g, '\n').trim();
      const start = text.length;
      text += `${clean}\n\n`;
      ranges.push({ page: index + 1, start, end: text.length });
    });
    if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
      throw new ExtractionError('PDF_NO_TEXT', 'El PDF no tiene texto extraíble (parece escaneado). Sube una versión con texto o un DOCX.');
    }
    return { text: text.trim(), pages: ranges };
  }

  let text;
  if (kind === 'docx') {
    try {
      ({ value: text } = await mammoth.extractRawText({ buffer }));
    } catch {
      throw new ExtractionError('DOCX_UNREADABLE', 'No se pudo leer el documento de Word.');
    }
  } else {
    text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  }
  if (String(text).replace(/\s/g, '').length < MIN_TEXT_CHARS) {
    throw new ExtractionError('EMPTY_TEXT', 'El documento no tiene texto suficiente para consultarlo.');
  }
  return { text: String(text).trim(), pages: null };
}
