import { open, readFile } from 'node:fs/promises';
import { inspectOoxml } from './ooxml.js';

// Firmas de los formatos permitidos: el contenido debe coincidir con la extensión declarada.
// DOCX, PPTX y XLSX no se juzgan por la firma: se revisa su estructura completa (utils/ooxml.js).
const SIGNATURES = {
  '.pdf': [Buffer.from('%PDF-')],
  '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
};
const TEXT_SAMPLE_BYTES = 64 * 1024;

// Lee el comienzo del archivo sin cargarlo completo en memoria.
async function readStart(filePath, length) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

// Un TXT válido es UTF-8 sin bytes nulos (los binarios casi siempre los tienen).
function looksLikeText(sample) {
  if (sample.includes(0)) return false;
  // Si la muestra corta un carácter de varios bytes al final, se ignoran esos últimos bytes.
  for (let trim = 0; trim < 4 && trim <= sample.length; trim += 1) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(sample.subarray(0, sample.length - trim));
      return true;
    } catch { /* prueba recortando un byte más */ }
  }
  return false;
}

// Indica si el contenido real del archivo corresponde a su extensión.
export async function matchesSignature(filePath, extension) {
  const ext = String(extension || '').toLowerCase();
  if (['.docx', '.pptx', '.xlsx'].includes(ext)) return inspectOoxml(await readFile(filePath), ext.slice(1)).ok;
  if (ext === '.txt') return looksLikeText(await readStart(filePath, TEXT_SAMPLE_BYTES));
  // WebP: «RIFF», 4 bytes de tamaño y luego «WEBP».
  if (ext === '.webp') {
    const start = await readStart(filePath, 12);
    return start.subarray(0, 4).toString('latin1') === 'RIFF' && start.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  const expected = SIGNATURES[ext];
  if (!expected) return false;
  const start = await readStart(filePath, 16);
  return expected.some((signature) => start.subarray(0, signature.length).equals(signature));
}
