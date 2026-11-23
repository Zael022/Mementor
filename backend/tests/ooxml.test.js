import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { inspectOoxml } from '../src/utils/ooxml.js';
import { matchesSignature } from '../src/utils/fileSignature.js';
import { extractDocument } from '../src/services/extractionService.js';
import { makeDocx } from './fakes/googleFake.js';

// P1 de la revisión independiente: la firma «PK» ya no basta para aceptar un documento de Office.
const TIPOS = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';
const XML = '<?xml version="1.0"?><raiz/>';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function zip(files, options = { compression: 'DEFLATE' }) {
  const archivo = new JSZip();
  for (const [name, content] of Object.entries(files)) archivo.file(name, content);
  return archivo.generateAsync({ type: 'nodebuffer', ...options });
}

test('acepta DOCX, PPTX y XLSX con sus partes obligatorias', async () => {
  assert.equal(inspectOoxml(await makeDocx(['Un párrafo con texto suficiente.']), 'docx').ok, true);
  assert.equal(inspectOoxml(await zip({ '[Content_Types].xml': TIPOS, 'ppt/presentation.xml': XML }), 'pptx').ok, true);
  assert.equal(inspectOoxml(await zip({ '[Content_Types].xml': TIPOS, 'xl/workbook.xml': XML }, { compression: 'STORE' }), 'xlsx').ok, true);
});

test('rechaza seis bytes con prefijo ZIP, un ZIP renombrado y un ZIP truncado', async () => {
  assert.equal(inspectOoxml(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), 'docx').ok, false);
  const renombrado = await zip({ 'fotos/playa.txt': 'no es Word' });
  assert.match(inspectOoxml(renombrado, 'docx').reason, /parte obligatoria/);
  const valido = await makeDocx(['Texto del documento completo.']);
  assert.match(inspectOoxml(valido.subarray(0, valido.length - 30), 'docx').reason, /directorio central|dañad/);
  // Partes de otro formato: un PPTX renombrado a .docx.
  const pptx = await zip({ '[Content_Types].xml': TIPOS, 'ppt/presentation.xml': XML });
  assert.equal(inspectOoxml(pptx, 'docx').ok, false);
});

test('rechaza bombas ZIP, archivos anidados y rutas peligrosas', async () => {
  const bomba = await zip({ '[Content_Types].xml': TIPOS, 'word/document.xml': XML, 'word/media/relleno.bin': Buffer.alloc(30 * 1024 * 1024) });
  assert.ok(bomba.length < 200 * 1024, 'el relleno se comprime a muy poco');
  assert.match(inspectOoxml(bomba, 'docx').reason, /bomba ZIP/);
  const anidado = await zip({ '[Content_Types].xml': TIPOS, 'word/document.xml': XML, 'word/adjuntos/otra.zip': 'PK' });
  assert.match(inspectOoxml(anidado, 'docx').reason, /anidado/);
  const ruta = await zip({ '[Content_Types].xml': TIPOS, 'word/document.xml': XML, '../../etc/cron.d/x': 'x' }, { compression: 'STORE' });
  assert.match(inspectOoxml(ruta, 'docx').reason, /ruta interna/);
});

test('rechaza una parte obligatoria cuyo tamaño declarado no coincide con su contenido', async () => {
  const buffer = Buffer.from(await zip({ '[Content_Types].xml': TIPOS, 'word/document.xml': XML }, { compression: 'STORE' }));
  // Se altera el tamaño descomprimido declarado de la última entrada en el directorio central.
  const central = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  buffer.writeUInt32LE(buffer.readUInt32LE(central + 24) + 50, central + 24);
  assert.match(inspectOoxml(buffer, 'docx').reason, /dañada/);
});

test('la carga y la extracción usan la misma revisión', async () => {
  const carpeta = mkdtempSync(path.join(tmpdir(), 'ooxml-'));
  try {
    const falso = path.join(carpeta, 'falso.docx');
    writeFileSync(falso, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]));
    assert.equal(await matchesSignature(falso, '.docx'), false);
    const real = path.join(carpeta, 'real.docx');
    writeFileSync(real, await makeDocx(['Texto suficiente para indexar el documento.']));
    assert.equal(await matchesSignature(real, '.docx'), true);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
  // Un DOCX dañado que llega desde Drive se rechaza antes de pasar a mammoth.
  await assert.rejects(() => extractDocument(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), DOCX_MIME), { code: 'DOCX_UNREADABLE' });
});
