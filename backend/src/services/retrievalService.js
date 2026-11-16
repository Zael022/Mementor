import { readRagConfig } from '../config/rag.js';
import { CourseRagCorpus, SourceVersion } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { headingAt, locatePassageRange, pageAt, requiredMatches, splitSections, terms } from '../utils/textChunks.js';
import { listAuthorizedVersions } from './knowledgeService.js';
import * as vertex from './vertexRagClient.js';

const MAX_PASSAGES = 6;
const PASSAGE_MAX_CHARS = 1800;
const MAX_CACHE_CHARS = 4_000_000;
const MAX_CACHE_DOCUMENTS = 128;
// Las versiones no cambian: la caché se guarda por id de versión con su texto, páginas y fragmentos preparados.
const versionCache = new Map();
let cachedChars = 0;
let textReads = 0;

// Cuántas versiones se leyeron completas de MySQL (útil en pruebas y diagnóstico).
export function localTextReads() {
  return textReads;
}

// Vacía la caché (pruebas o cambios de configuración).
export function clearRetrievalCache() {
  versionCache.clear();
  cachedChars = 0;
}

const prepare = (text) => splitSections(text).map(({ text: content, ...range }) => ({ ...range, words: new Set(terms(content)) }));

// Devuelve la versión preparada desde la caché y la marca como usada recientemente.
function cachedVersion(versionId) {
  const cached = versionCache.get(versionId);
  if (!cached) return null;
  versionCache.delete(versionId);
  versionCache.set(versionId, cached);
  return cached;
}

// Prepara una versión leída de MySQL y la guarda si cabe en la caché.
function storeVersion(row) {
  const prepared = { text: row.textContent, pages: row.pagesJson, sections: prepare(row.textContent) };
  if (row.textContent.length > MAX_CACHE_CHARS) return prepared;
  while (versionCache.size >= MAX_CACHE_DOCUMENTS || cachedChars + row.textContent.length > MAX_CACHE_CHARS) {
    const [oldestId, oldest] = versionCache.entries().next().value;
    cachedChars -= oldest.text.length;
    versionCache.delete(oldestId);
  }
  versionCache.set(row.id, prepared);
  cachedChars += row.textContent.length;
  return prepared;
}

// Elige los fragmentos con evidencia suficiente; nunca rellena con fragmentos sin coincidencias.
// Cada documento trae su texto y, si ya se prepararon, sus fragmentos.
export function rankLocal(documents, query) {
  const queryTerms = new Set(terms(query));
  const minimum = requiredMatches(queryTerms);
  if (!Number.isFinite(minimum)) return [];
  const candidates = [];
  for (const document of documents) {
    const titleMatch = terms(document.title).some((word) => queryTerms.has(word));
    for (const part of document.sections || prepare(document.text)) {
      let matches = 0;
      for (const word of queryTerms) if (part.words.has(word)) matches += 1;
      if (matches < minimum) continue;
      candidates.push({ document, start: part.start, end: part.end, section: part.section, heading: part.heading, score: matches + (titleMatch ? 0.5 : 0) });
    }
  }
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PASSAGES)
    .map((candidate) => ({ ...candidate, text: candidate.document.text.slice(candidate.start, candidate.end) }));
}

// Arma el pasaje que recibe el generador a partir del texto guardado en MySQL.
function passageFrom({ source, version }, start, rangeEnd, section, heading = headingAt(version.textContent, start)) {
  const end = Math.min(version.textContent.length, rangeEnd, start + PASSAGE_MAX_CHARS);
  return {
    sourceRef: source.id,
    versionId: version.id,
    versionNo: version.versionNo,
    origin: source.origin,
    title: source.title,
    lessonId: source.lessonId,
    materialId: source.materialId,
    text: version.textContent.slice(start, end),
    start,
    end,
    page: pageAt(version.pagesJson, start),
    heading,
    section,
  };
}

// Documentos para la búsqueda por palabras (modo local).
// Los permisos llegan de MySQL en cada pregunta; el texto solo se lee para versiones que no están en caché.
async function localDocuments(authorized) {
  const missing = authorized.map((entry) => entry.version.id).filter((id) => !versionCache.has(id));
  const rows = missing.length
    ? await SourceVersion.findAll({ where: { id: missing }, attributes: ['id', 'textContent', 'pagesJson'], raw: true })
    : [];
  textReads += rows.length;
  const loaded = new Map(rows.map((row) => [row.id, storeVersion(row)]));
  return authorized.flatMap((entry) => {
    const prepared = cachedVersion(entry.version.id) || loaded.get(entry.version.id);
    if (!prepared) return [];
    const version = { ...entry.version, textContent: prepared.text, pagesJson: prepared.pages };
    return [{ title: entry.source.title, text: prepared.text, sections: prepared.sections, entry: { source: entry.source, version } }];
  });
}

// Búsqueda por significado en RAG Engine; cada resultado se contrasta con la versión publicada en MySQL.
async function retrieveVertex(authorized, query, courseId) {
  const withFile = authorized.filter((entry) => entry.version.ragFileName && entry.version.gcsUri);
  if (!withFile.length) return { passages: [], called: false };
  const corpus = await CourseRagCorpus.findOne({ where: { courseId }, attributes: ['corpusName', 'status'], raw: true });
  if (!corpus?.corpusName || corpus.status !== 'ready') return { passages: [], called: false };

  const byUri = new Map(withFile.map((entry) => [entry.version.gcsUri, entry]));
  const fileIds = withFile.map((entry) => entry.version.ragFileName.split('/').pop());
  let contexts;
  try {
    contexts = await vertex.retrieveContexts(corpus.corpusName, fileIds, query);
  } catch (error) {
    // Una falla de Google Cloud no es lo mismo que una búsqueda sin coincidencias.
    throw new AppError(503, 'RAG_UNAVAILABLE', 'No se pudo consultar el buscador de Google Cloud. No significa que falte material: intenta más tarde.', { status: error.status ?? null });
  }
  const { maxDistance } = readRagConfig();
  const matchedIds = [...new Set(contexts
    .filter((context) => byUri.has(context.sourceUri))
    .map((context) => byUri.get(context.sourceUri).version.id))];
  if (!matchedIds.length) return { passages: [], called: true };
  // El texto completo se lee solo para las versiones que devolvió el buscador.
  const versions = await SourceVersion.findAll({
    where: { id: matchedIds, state: 'ready' }, attributes: ['id', 'textContent', 'pagesJson'], raw: true,
  });
  const byId = new Map(versions.map((version) => [version.id, version]));
  const passages = [];
  for (const context of contexts) {
    // Se descartan resultados de origen desconocido, retirado o de otro curso.
    const entry = byUri.get(context.sourceUri);
    if (!entry) continue;
    const stored = byId.get(entry.version.id);
    if (!stored) continue;
    if (maxDistance !== null && typeof context.score === 'number' && context.score > maxDistance) continue;
    const chunkText = context.chunk?.text || context.text || '';
    const range = locatePassageRange(stored.textContent, chunkText);
    if (!range) continue;
    const passage = passageFrom({ source: entry.source, version: { ...entry.version, ...stored } }, range.start, range.end, null);
    if (context.chunk?.pageSpan?.firstPage && !passage.page) passage.page = context.chunk.pageSpan.firstPage;
    passages.push(passage);
    if (passages.length >= MAX_PASSAGES) break;
  }
  return { passages, called: true };
}

// Recupera pasajes autorizados del curso. status: ok | no_evidence (sin material o sin coincidencias).
export async function retrievePassages(courseId, query) {
  const config = readRagConfig();
  // Solo metadatos: el texto se lee después, y únicamente lo que haga falta.
  const authorized = await listAuthorizedVersions(courseId);
  // Sin fuentes autorizadas se responde sin consultar Google Cloud.
  if (!authorized.length) return { status: 'no_evidence', reason: 'no_sources', passages: [], mode: config.mode, called: false };

  if (config.mode === 'vertex') {
    if (!config.configured) throw new AppError(503, 'RAG_NOT_CONFIGURED', `La búsqueda en Google Cloud no está configurada. ${config.reason}`);
    const { passages, called } = await retrieveVertex(authorized, query, courseId);
    return { status: passages.length ? 'ok' : 'no_evidence', reason: passages.length ? null : 'no_match', passages, mode: 'vertex', called };
  }
  const documents = await localDocuments(authorized);
  const passages = rankLocal(documents, query).map((item) => passageFrom(item.document.entry, item.start, item.end, item.section, item.heading));
  return { status: passages.length ? 'ok' : 'no_evidence', reason: passages.length ? null : 'no_match', passages, mode: 'local', called: false };
}
