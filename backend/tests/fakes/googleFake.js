import JSZip from 'jszip';

// Doble en memoria de Cloud Storage, RAG Engine y Drive para pruebas sin red ni costos.
// La búsqueda imita una recuperación por significado con grupos de sinónimos.
const CONCEPTS = [
  ['falta', 'ausencia', 'inasistencia', 'justific', 'faltar', 'ausent'],
  ['plazo', 'dias', 'días', 'tiempo', 'cuanto', 'cuánto', 'hábiles'],
  ['fraccion', 'fracción', 'denominador', 'numerador'],
  ['celula', 'célula', 'membrana'],
];
const conceptsOf = (text) => {
  const lower = String(text).toLowerCase();
  return new Set(CONCEPTS.map((group, index) => (group.some((word) => lower.includes(word)) ? index : -1)).filter((index) => index >= 0));
};

export function createGoogleFake() {
  const state = {
    objects: new Map(),
    corpora: new Map(),
    operations: new Map(),
    calls: [],
    retrieveCalls: 0,
    failRetrieve: false,
    failDeleteRagFile: false,
    leakOtherCorpora: true,
    // Con deferImports las operaciones de importación quedan sin terminar hasta completeOperations().
    deferImports: false,
    drive: { folders: new Map(), files: new Map(), failListOnPage: null, pageSize: 2, deniedFolders: new Set() },
    seq: 0,
  };
  const next = () => { state.seq += 1; return state.seq; };
  const op = (response, error) => {
    const name = `projects/p/locations/l/operations/${next()}`;
    const operation = { name, done: true, ...(error ? { error } : { response }) };
    state.operations.set(name, operation);
    return operation;
  };
  const error = (status, message) => Object.assign(new Error(message), { name: 'GoogleCallError', status });

  async function transport({ method, url, body }) {
    const { pathname, searchParams } = new URL(url);
    state.calls.push(`${method} ${pathname}`);
    const { GoogleCallError } = await import('../../src/services/googleCloud.js');
    const fail = (status, message) => { throw new GoogleCallError(status, message); };

    // Cloud Storage
    if (pathname.startsWith('/upload/storage/v1/b/')) {
      const bucket = decodeURIComponent(pathname.split('/')[5]);
      const uri = `gs://${bucket}/${searchParams.get('name')}`;
      if (state.objects.has(uri)) fail(412, 'precondition');
      state.objects.set(uri, Buffer.from(body).toString('utf8'));
      return { name: searchParams.get('name') };
    }
    if (pathname.startsWith('/storage/v1/b/') && method === 'DELETE') {
      const parts = pathname.split('/');
      const uri = `gs://${decodeURIComponent(parts[4])}/${decodeURIComponent(parts.slice(6).join('/'))}`;
      if (!state.objects.delete(uri)) fail(404, 'not found');
      return null;
    }

    // RAG Engine
    if (pathname.endsWith('/ragCorpora') && method === 'POST') {
      const name = `projects/p/locations/l/ragCorpora/${next()}`;
      state.corpora.set(name, { displayName: body.displayName, files: new Map() });
      return op({ name });
    }
    if (pathname.includes('/operations/')) return state.operations.get(pathname.replace('/v1/', '')) || fail(404, 'no op');
    if (pathname.endsWith('/ragFiles:import')) {
      const corpus = state.corpora.get(pathname.replace('/v1/', '').replace('/ragFiles:import', ''));
      let imported = 0;
      for (const uri of body.importRagFilesConfig.gcsSource.uris) {
        if (!state.objects.has(uri)) continue;
        if ([...corpus.files.values()].some((file) => file.uri === uri)) continue;
        const name = `${pathname.replace('/v1/', '').replace('/ragFiles:import', '')}/ragFiles/${next()}`;
        corpus.files.set(name, { uri, state: 'ACTIVE' });
        imported += 1;
      }
      const result = op({ importedRagFilesCount: String(imported) });
      if (state.deferImports) result.done = false;
      return result;
    }
    if (pathname.endsWith('/ragFiles') && method === 'GET') {
      const corpus = state.corpora.get(pathname.replace('/v1/', '').replace('/ragFiles', ''));
      return { ragFiles: [...corpus.files.entries()].map(([name, file]) => ({ name, gcsSource: { uris: [file.uri] }, fileStatus: { state: file.state } })) };
    }
    if (pathname.includes('/ragFiles/') && method === 'DELETE') {
      if (state.failDeleteRagFile) fail(503, 'temporalmente no disponible');
      const name = pathname.replace('/v1/', '');
      const corpusName = name.split('/ragFiles/')[0];
      if (!state.corpora.get(corpusName)?.files.delete(name)) fail(404, 'not found');
      return null;
    }
    if (pathname.endsWith(':retrieveContexts')) {
      state.retrieveCalls += 1;
      if (state.failRetrieve) fail(503, 'servicio no disponible');
      const resource = body.vertexRagStore.ragResources[0];
      const wanted = conceptsOf(body.query.text);
      const contexts = [];
      for (const [corpusName, corpus] of state.corpora) {
        // El doble devuelve también resultados de otros corpus para comprobar que MENTOR los descarta.
        if (corpusName !== resource.ragCorpus && !state.leakOtherCorpora) continue;
        for (const [name, file] of corpus.files) {
          const ownFile = corpusName === resource.ragCorpus && resource.ragFileIds.includes(name.split('/').pop());
          if (!ownFile && !state.leakOtherCorpora) continue;
          const text = state.objects.get(file.uri) || '';
          const shared = [...conceptsOf(text)].filter((concept) => wanted.has(concept));
          if (!shared.length) continue;
          const chunk = text.slice(0, 600);
          contexts.push({ sourceUri: file.uri, sourceDisplayName: file.uri.split('/').pop(), text: chunk, score: 0.2, chunk: { text: chunk } });
        }
      }
      return { contexts: { contexts } };
    }

    // Google Drive
    if (pathname.startsWith('/drive/v3/files')) {
      const id = decodeURIComponent(pathname.split('/')[4] || '');
      if (pathname === '/drive/v3/files') {
        const folderId = searchParams.get('q').match(/'([^']+)'/)[1];
        if (state.drive.deniedFolders.has(folderId)) fail(404, 'not found');
        const children = [...state.drive.files.values()].filter((file) => file.parent === folderId && !file.trashed);
        const offset = Number(searchParams.get('pageToken') || 0);
        const pageIndex = offset / state.drive.pageSize;
        if (state.drive.failListOnPage === pageIndex) { state.drive.failListOnPage = null; fail(500, 'falla temporal'); }
        const files = children.slice(offset, offset + state.drive.pageSize);
        const nextOffset = offset + state.drive.pageSize;
        return { files: files.map(({ id: fileId, name, mimeType, modifiedTime, md5Checksum, size }) => ({ id: fileId, name, mimeType, modifiedTime, md5Checksum, size })), ...(nextOffset < children.length ? { nextPageToken: String(nextOffset) } : {}) };
      }
      if (pathname.endsWith('/export')) return state.drive.files.get(decodeURIComponent(pathname.split('/')[4])).content;
      if (searchParams.get('alt') === 'media') return Buffer.from(state.drive.files.get(id).content);
      if (state.drive.deniedFolders.has(id)) fail(404, 'not found');
      const folder = state.drive.folders.get(id);
      if (!folder) fail(404, 'not found');
      return { id, name: folder.name, mimeType: 'application/vnd.google-apps.folder', trashed: false };
    }
    fail(400, `ruta no simulada: ${method} ${pathname}`);
    return error(400, 'no');
  }
  // Termina las operaciones diferidas, como haría RAG Engine al acabar de indexar.
  state.completeOperations = () => { for (const operation of state.operations.values()) operation.done = true; };
  return { state, transport };
}

// Crea un PDF mínimo con una línea de texto por página (o sin texto).
export function makePdf(pages) {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  const pagesId = objects.length + 1 + pages.length * 2;
  for (const text of pages) {
    const stream = text ? `BT /F1 12 Tf 40 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET` : '';
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

// Crea un DOCX mínimo con párrafos de texto.
export async function makeDocx(paragraphs) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}
