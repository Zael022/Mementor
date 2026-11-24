import { inflateRawSync } from 'node:zlib';

// Revisión estructural de documentos de Office (DOCX, PPTX, XLSX), que son archivos ZIP.
// La firma «PK» no basta: se lee el directorio central, se exigen las partes obligatorias del formato
// y se ponen límites antes de que cualquier biblioteca descomprima el contenido (bombas ZIP).

export const OOXML_LIMITS = {
  maxEntries: 2000,
  maxUncompressedBytes: 100 * 1024 * 1024, // 100 MB descomprimidos en total
  maxEntryRatio: 100, // una entrada no puede crecer más de 100 veces al descomprimirse
  ratioFloorBytes: 1024 * 1024, // la razón solo se exige a partir de 1 MB descomprimido
  maxNameLength: 512,
};

// Partes que cada formato debe tener para ser un documento de verdad.
const REQUIRED = {
  docx: ['[Content_Types].xml', 'word/document.xml'],
  pptx: ['[Content_Types].xml', 'ppt/presentation.xml'],
  xlsx: ['[Content_Types].xml', 'xl/workbook.xml'],
};
// Archivos comprimidos dentro del documento: no forman parte de ningún formato de Office.
const NESTED_ARCHIVE = /\.(zip|rar|7z|gz|tgz|tar|jar|cab)$/i;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const fail = (reason) => ({ ok: false, reason });

// Busca el registro de fin de directorio central (puede tener un comentario de hasta 64 KB detrás).
function findEndOfCentralDirectory(buffer) {
  const stop = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= stop; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function safeName(name) {
  if (!name || name.length > OOXML_LIMITS.maxNameLength) return false;
  if (name.includes('\\') || name.includes('\0') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false;
  return !name.split('/').some((part) => part === '..');
}

// Descomprime una entrada con un tope de salida: si el contenido no cuadra con lo declarado, es inválido.
function readEntry(buffer, entry) {
  if (entry.localOffset + 30 > buffer.length || buffer.readUInt32LE(entry.localOffset) !== LOCAL_SIGNATURE) throw new Error('local');
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (data.length !== entry.compressedSize) throw new Error('truncado');
  if (entry.method === 0) {
    if (data.length !== entry.uncompressedSize) throw new Error('tamaño');
    return data;
  }
  if (entry.method !== 8) throw new Error('método');
  const output = inflateRawSync(data, { maxOutputLength: entry.uncompressedSize + 1 });
  if (output.length !== entry.uncompressedSize) throw new Error('tamaño');
  return output;
}

// Devuelve { ok: true } o { ok: false, reason } con un motivo técnico para el registro.
export function inspectOoxml(buffer, kind) {
  const required = REQUIRED[kind];
  if (!required) return fail('formato no soportado');
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.readUInt32LE(0) !== LOCAL_SIGNATURE) return fail('no es un ZIP');

  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) return fail('sin directorio central (ZIP truncado o falso)');
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  // ZIP64 o multivolumen: un documento de este tamaño nunca los necesita.
  if (totalEntries === 0xffff || centralOffset === 0xffffffff || buffer.readUInt16LE(eocd + 4) !== 0) return fail('ZIP64 o multivolumen');
  if (totalEntries === 0 || totalEntries > OOXML_LIMITS.maxEntries) return fail(`cantidad de entradas fuera de rango (${totalEntries})`);
  if (centralOffset + centralSize > eocd) return fail('directorio central fuera del archivo');

  const entries = new Map();
  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) return fail('directorio central dañado');
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) return fail('contenido cifrado');
    if (![0, 8].includes(method)) return fail(`método de compresión no permitido (${method})`);
    if (!safeName(name)) return fail('ruta interna no permitida');
    if (NESTED_ARCHIVE.test(name)) return fail('archivo comprimido anidado');
    if (entries.has(name)) return fail('entrada duplicada');
    if (localOffset + 30 > centralOffset) return fail('entrada fuera de rango');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > OOXML_LIMITS.maxUncompressedBytes) return fail('demasiado grande al descomprimir');
    if (uncompressedSize > OOXML_LIMITS.ratioFloorBytes && uncompressedSize > Math.max(compressedSize, 1) * OOXML_LIMITS.maxEntryRatio) {
      return fail('razón de compresión sospechosa (posible bomba ZIP)');
    }
    entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
  }

  for (const part of required) {
    const entry = entries.get(part);
    if (!entry) return fail(`falta la parte obligatoria ${part}`);
    // Se descomprimen las partes obligatorias para confirmar que no están dañadas.
    try {
      const content = readEntry(buffer, entry).toString('utf8', 0, 4096);
      if (!content.includes('<')) return fail(`la parte ${part} no es XML`);
    } catch {
      return fail(`la parte ${part} está dañada`);
    }
  }
  return { ok: true, entries: entries.size, uncompressedBytes: totalUncompressed };
}
