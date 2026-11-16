import { readRagConfig } from '../config/rag.js';
import { GoogleCallError, googleRequest } from './googleCloud.js';

// Operaciones de RAG Engine (API de Vertex AI, REST v1) y de Cloud Storage que usa MENTOR.

const apiBase = (config) => `https://${config.location}-aiplatform.googleapis.com/v1`;
const parent = (config) => `projects/${config.project}/locations/${config.location}`;

// Crea un corpus; devuelve la operación de larga duración.
export async function createCorpus(displayName, description) {
  const config = readRagConfig();
  const body = { displayName, description };
  if (config.embeddingModel) {
    body.vectorDbConfig = {
      ragEmbeddingModelConfig: {
        vertexPredictionEndpoint: { endpoint: `${parent(config)}/publishers/google/models/${config.embeddingModel}` },
      },
    };
  }
  return googleRequest({ method: 'POST', url: `${apiBase(config)}/${parent(config)}/ragCorpora`, body });
}

// Consulta el estado de una operación de larga duración.
export async function getOperation(name) {
  return googleRequest({ url: `${apiBase(readRagConfig())}/${name}` });
}

// Importa archivos de Cloud Storage al corpus con el fragmentado configurado.
export async function importFiles(corpusName, uris) {
  const config = readRagConfig();
  return googleRequest({
    method: 'POST',
    url: `${apiBase(config)}/${corpusName}/ragFiles:import`,
    body: {
      importRagFilesConfig: {
        gcsSource: { uris },
        ragFileTransformationConfig: {
          ragFileChunkingConfig: { fixedLengthChunking: { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap } },
        },
      },
    },
  });
}

// Busca los archivos del corpus que corresponden a varios objetos de Cloud Storage con un solo recorrido.
// Se detiene en cuanto encuentra todas las URI pedidas.
export async function findRagFilesByUris(corpusName, uris) {
  const config = readRagConfig();
  const wanted = new Set(uris);
  const found = new Map();
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '100', ...(pageToken ? { pageToken } : {}) });
    const page = await googleRequest({ url: `${apiBase(config)}/${corpusName}/ragFiles?${query}` });
    for (const file of page.ragFiles || []) {
      for (const uri of file.gcsSource?.uris || []) if (wanted.has(uri) && !found.has(uri)) found.set(uri, file);
    }
    pageToken = found.size === wanted.size ? '' : page.nextPageToken || '';
  } while (pageToken);
  return found;
}

// Busca el archivo del corpus que corresponde a un objeto de Cloud Storage.
export async function findRagFileByUri(corpusName, uri) {
  return (await findRagFilesByUris(corpusName, [uri])).get(uri) || null;
}

// Borra un archivo del corpus; si ya no existe, se considera borrado.
export async function deleteRagFile(name) {
  try {
    await googleRequest({ method: 'DELETE', url: `${apiBase(readRagConfig())}/${name}` });
  } catch (error) {
    if (!(error instanceof GoogleCallError && error.status === 404)) throw error;
  }
}

// Recupera fragmentos por significado, limitado a los archivos autorizados del curso.
export async function retrieveContexts(corpusName, ragFileIds, text) {
  const config = readRagConfig();
  const ragRetrievalConfig = { topK: config.topK };
  if (config.maxDistance !== null) ragRetrievalConfig.filter = { vectorDistanceThreshold: config.maxDistance };
  const response = await googleRequest({
    method: 'POST',
    url: `${apiBase(config)}/${parent(config)}:retrieveContexts`,
    body: {
      vertexRagStore: { ragResources: [{ ragCorpus: corpusName, ragFileIds }] },
      query: { text, ragRetrievalConfig },
    },
  });
  return response?.contexts?.contexts || [];
}

// Escribe un objeto privado; si ya existe con ese nombre estable, se reutiliza.
export async function uploadObject(objectName, text) {
  const config = readRagConfig();
  const query = new URLSearchParams({ uploadType: 'media', name: objectName, ifGenerationMatch: '0' });
  try {
    await googleRequest({
      method: 'POST',
      url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(config.bucket)}/o?${query}`,
      body: Buffer.from(text, 'utf8'),
      contentType: 'text/plain; charset=utf-8',
    });
  } catch (error) {
    if (!(error instanceof GoogleCallError && error.status === 412)) throw error;
  }
  return `gs://${config.bucket}/${objectName}`;
}

// Borra un objeto creado por MENTOR; solo actúa dentro del prefijo administrado.
export async function deleteObject(uri) {
  const config = readRagConfig();
  const expected = `gs://${config.bucket}/${config.prefix}/`;
  if (!uri || !uri.startsWith(expected)) throw new Error('El objeto no pertenece al espacio administrado por MENTOR.');
  const objectName = uri.slice(`gs://${config.bucket}/`.length);
  try {
    await googleRequest({ method: 'DELETE', url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}/o/${encodeURIComponent(objectName)}` });
  } catch (error) {
    if (!(error instanceof GoogleCallError && error.status === 404)) throw error;
  }
}
