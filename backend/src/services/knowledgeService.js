import { createHash } from 'node:crypto';
import { Op } from 'sequelize';
import { readRagConfig } from '../config/rag.js';
import {
  AiMessageSource, CourseDriveLink, CourseRagCorpus, Institution, KnowledgeSource, Lesson, Material, SourceVersion, sequelize,
} from '../models/index.js';
import { AppError, conflict, invalid, notFound } from '../utils/AppError.js';
import { readStored } from './fileStore.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import { ExtractionError, INDEXABLE_TYPES, extractDocument } from './extractionService.js';
import { GoogleCallError } from './googleCloud.js';
import * as vertex from './vertexRagClient.js';

// Ciclo de vida de las fuentes del tutor: versiones, indexación, activación, retiro y limpieza.

const EXTRACTION_CODES = new Set(['PDF_NO_TEXT', 'PDF_UNREADABLE', 'DOCX_UNREADABLE', 'EMPTY_TEXT', 'UNSUPPORTED_TYPE', 'FILE_MISSING']);
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ---------- Cola de trabajo en segundo plano ----------
let queue = Promise.resolve();

// Encadena tareas para no saturar Google Cloud; los errores quedan registrados en la versión.
export function enqueue(task) {
  queue = queue.then(task).catch((error) => {
    if (process.env.NODE_ENV !== 'test') console.error('Tarea de indexación falló:', error?.name, error?.message);
  });
  return queue;
}

// Espera a que terminen las tareas pendientes (útil en pruebas y al apagar).
export function waitForKnowledgeQueue() {
  return queue;
}

// ---------- Fuentes y versiones ----------

// Cuenta los documentos (materiales y Drive) activos de una institución.
async function assertDocumentQuota(institutionId, transaction) {
  const institution = await Institution.findByPk(institutionId, { transaction });
  const limit = institution?.maxDocuments ?? readRagConfig().maxDocuments;
  const used = await KnowledgeSource.count({ where: { institutionId, status: 'active', origin: ['material', 'drive'] }, transaction });
  if (used >= limit) {
    throw conflict('DOCUMENT_LIMIT', `La institución alcanzó su tope de ${limit} documentos para el tutor. Retira alguno o pide ampliar el tope.`);
  }
}

// Crea o reactiva la fuente identificada por su clave dentro del curso.
export async function ensureSource({ course, origin, key, title, lessonId = null, materialId = null, driveFileId = null, driveLinkId = null, userId = null, countsAsDocument = false }) {
  const existing = await KnowledgeSource.findOne({ where: { courseId: course.id, sourceKey: key } });
  if (existing) {
    const changes = { title: title.slice(0, 200) };
    if (existing.status === 'retired') {
      if (countsAsDocument) await assertDocumentQuota(course.institutionId);
      Object.assign(changes, { status: 'active', retiredAt: null, retireReason: null, activeVersionId: null });
    }
    if (driveLinkId) changes.driveLinkId = driveLinkId;
    await existing.update(changes);
    return existing;
  }
  if (countsAsDocument) await assertDocumentQuota(course.institutionId);
  return KnowledgeSource.create({
    institutionId: course.institutionId, courseId: course.id, origin, sourceKey: key, title: title.slice(0, 200),
    lessonId, materialId, driveFileId, driveLinkId, createdBy: userId,
  });
}

// Registra una versión nueva solo si el contenido cambió; repetir una importación no duplica versiones.
export async function publishVersion(source, { text, pages = null, mimeType = null, externalRevision = null, userId = null }) {
  const contentHash = sha256(text);
  const latest = await SourceVersion.findOne({ where: { sourceId: source.id }, order: [['versionNo', 'DESC']] });
  if (latest && latest.contentHash === contentHash && ['ready', 'pending', 'processing'].includes(latest.state)) {
    if (externalRevision && latest.externalRevision !== externalRevision) await latest.update({ externalRevision });
    if (latest.state === 'ready' && source.activeVersionId !== latest.id) await activateVersion(latest.id);
    return { version: latest, changed: false };
  }
  const version = await SourceVersion.create({
    sourceId: source.id, courseId: source.courseId, versionNo: (latest?.versionNo || 0) + 1, contentHash,
    textContent: text, charCount: text.length, pagesJson: pages, mimeType, externalRevision, createdBy: userId,
  });
  await processVersion(version);
  return { version: await version.reload(), changed: true };
}

// Guarda una versión fallida para que la interfaz muestre el motivo y permita reintentar.
export async function recordFailedVersion(source, error, { mimeType = null, externalRevision = null, userId = null } = {}) {
  const latest = await SourceVersion.findOne({ where: { sourceId: source.id }, order: [['versionNo', 'DESC']] });
  if (latest && latest.state === 'error' && latest.errorCode === error.code && latest.externalRevision === externalRevision) return latest;
  return SourceVersion.create({
    sourceId: source.id, courseId: source.courseId, versionNo: (latest?.versionNo || 0) + 1, contentHash: sha256(`error:${error.code}:${Date.now()}`),
    textContent: '', charCount: 0, mimeType, externalRevision, state: 'error', errorCode: error.code, errorMessage: error.message.slice(0, 500), createdBy: userId,
  });
}

// En modo local la versión queda lista al instante; en Vertex se importa en segundo plano.
async function processVersion(version) {
  if (readRagConfig().mode !== 'vertex') {
    await version.update({ state: 'ready', readyAt: new Date() });
    await activateVersion(version.id);
    return;
  }
  enqueue(() => startRemoteImport(version.id));
}

// Deja una sola versión activa por fuente; la anterior pasa a limpieza remota.
async function activateVersion(versionId) {
  await sequelize.transaction(async (transaction) => {
    const version = await SourceVersion.findByPk(versionId, { transaction, lock: transaction.LOCK.UPDATE });
    const source = await KnowledgeSource.findByPk(version.sourceId, { transaction, lock: transaction.LOCK.UPDATE });
    const needsCleanup = (row) => (row.gcsUri || row.ragFileName ? 'pending' : 'none');
    if (source.status === 'retired') {
      await version.update({ state: 'retired', remoteCleanup: needsCleanup(version) }, { transaction });
      return;
    }
    const current = source.activeVersionId && source.activeVersionId !== version.id
      ? await SourceVersion.findByPk(source.activeVersionId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    // Una versión antigua que termina tarde no reemplaza a una más nueva.
    if (current && current.versionNo > version.versionNo) {
      await version.update({ state: 'superseded', remoteCleanup: needsCleanup(version) }, { transaction });
      return;
    }
    if (current) await current.update({ state: 'superseded', remoteCleanup: needsCleanup(current) }, { transaction });
    await version.update({ state: 'ready', readyAt: version.readyAt || new Date() }, { transaction });
    await source.update({ activeVersionId: version.id }, { transaction });
  });
}

// Marca la fuente como retirada: deja de usarse de inmediato aunque la limpieza remota siga pendiente.
export async function retireSource(source, reason, { actor = null } = {}) {
  if (source.status === 'retired') return source;
  await sequelize.transaction(async (transaction) => {
    await source.update({ status: 'retired', retiredAt: new Date(), retireReason: reason, activeVersionId: null, cleanupStatus: 'pending' }, { transaction });
    const versions = await SourceVersion.findAll({ where: { sourceId: source.id }, transaction });
    for (const version of versions) {
      const remote = version.gcsUri || version.ragFileName || version.importOperation;
      const state = ['superseded', 'error'].includes(version.state) ? version.state : 'retired';
      await version.update({ state, remoteCleanup: remote && version.remoteCleanup !== 'done' ? 'pending' : version.remoteCleanup }, { transaction });
    }
    if (actor) {
      await recordAudit({ actor, action: 'knowledge.source.retired', resourceType: 'knowledge_source', resourceId: source.id, metadata: { reason }, transaction });
    }
  });
  enqueue(() => runRemoteCleanup({ sourceId: source.id }));
  return source;
}

// ---------- Google Cloud: corpus, carga e importación ----------

// Obtiene o crea el corpus del curso; espera brevemente la operación de creación.
async function ensureCorpus(courseId, institutionId) {
  const [row] = await CourseRagCorpus.findOrCreate({ where: { courseId }, defaults: { courseId, institutionId } });
  if (row.status === 'ready' && row.corpusName) return row;
  if (row.status !== 'creating' || !row.operationName) {
    const operation = await vertex.createCorpus(`mentor-i${institutionId}-c${courseId}`, `Material del curso ${courseId} de MENTOR AI`);
    if (operation.done && operation.response?.name) {
      await row.update({ status: 'ready', corpusName: operation.response.name, operationName: operation.name, lastError: null });
      return row;
    }
    await row.update({ status: 'creating', operationName: operation.name, lastError: null });
  }
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const operation = await vertex.getOperation(row.operationName);
    if (operation.done) {
      if (operation.error) {
        await row.update({ status: 'error', lastError: String(operation.error.message || 'Error al crear el corpus').slice(0, 500) });
        throw new GoogleCallError(500, 'RAG Engine no pudo crear el corpus del curso.');
      }
      await row.update({ status: 'ready', corpusName: operation.response.name, lastError: null });
      return row;
    }
    await sleep(2000);
  }
  return row;
}

// Nombre estable del objeto: identifica institución, curso, fuente y versión.
function objectNameFor(version, source) {
  const { prefix } = readRagConfig();
  return `${prefix}/i${source.institutionId}/c${source.courseId}/s${source.id}/v${version.id}.txt`;
}

// Sube el texto de la versión a Cloud Storage e inicia su importación al corpus.
export async function startRemoteImport(versionId) {
  const [claimed] = await SourceVersion.update({ state: 'processing' }, { where: { id: versionId, state: 'pending' } });
  if (!claimed) return;
  const version = await SourceVersion.findByPk(versionId);
  const source = await KnowledgeSource.findByPk(version.sourceId);
  try {
    if (source.status === 'retired') {
      await version.update({ state: 'retired' });
      return;
    }
    const corpus = await ensureCorpus(source.courseId, source.institutionId);
    if (corpus.status !== 'ready') {
      // El corpus aún se está creando: la versión vuelve a la cola del revisor periódico.
      await version.update({ state: 'pending' });
      return;
    }
    const gcsUri = await vertex.uploadObject(objectNameFor(version, source), version.textContent);
    const operation = await vertex.importFiles(corpus.corpusName, [gcsUri]);
    await version.update({ gcsUri, importOperation: operation.name, importAttempts: version.importAttempts + 1, errorCode: null, errorMessage: null });
    await checkImport(version.id);
  } catch (error) {
    await version.update({
      state: 'error',
      errorCode: error instanceof GoogleCallError ? 'GCP_ERROR' : 'IMPORT_FAILED',
      errorMessage: String(error.message || 'No se pudo importar la versión.').slice(0, 500),
      importAttempts: version.importAttempts + 1,
    });
  }
}

// Revisa la operación de importación y confirma el archivo en el corpus antes de marcarlo listo.
// Búsqueda de archivos del corpus para una ronda: cada curso se lista una sola vez para todas sus URI.
function batchLookup(uris) {
  const byCourse = new Map();
  for (const { courseId, uri } of uris) {
    if (!byCourse.has(courseId)) byCourse.set(courseId, new Set());
    byCourse.get(courseId).add(uri);
  }
  const results = new Map();
  return async (courseId, corpusName, uri) => {
    if (!results.has(courseId)) results.set(courseId, vertex.findRagFilesByUris(corpusName, [...(byCourse.get(courseId) || [uri])]));
    const map = await results.get(courseId);
    // Una URI que no estaba en el lote se busca sola.
    return map.has(uri) || byCourse.get(courseId)?.has(uri) ? map.get(uri) || null : vertex.findRagFileByUri(corpusName, uri);
  };
}
const singleLookup = (courseId, corpusName, uri) => vertex.findRagFileByUri(corpusName, uri);

export async function checkImport(versionId, { lookup = singleLookup, operation: knownOperation = null } = {}) {
  const version = await SourceVersion.findByPk(versionId);
  if (!version || version.state !== 'processing' || !version.importOperation) return version?.state;
  const operation = knownOperation || await vertex.getOperation(version.importOperation);
  if (!operation.done) return 'processing';
  const fail = (code, message) => version.update({ state: 'error', errorCode: code, errorMessage: message.slice(0, 500) });
  if (operation.error) {
    await fail('IMPORT_FAILED', `RAG Engine no importó el archivo: ${operation.error.message || 'error sin detalle'}`);
    return 'error';
  }
  const corpus = await CourseRagCorpus.findOne({ where: { courseId: version.courseId } });
  const ragFile = await lookup(version.courseId, corpus.corpusName, version.gcsUri);
  const counts = operation.response || {};
  if (!ragFile) {
    await fail('IMPORT_NO_FILE', `El corpus no registró el archivo (importados ${counts.importedRagFilesCount || 0}, fallidos ${counts.failedRagFilesCount || 0}, omitidos ${counts.skippedRagFilesCount || 0}).`);
    return 'error';
  }
  const state = ragFile.fileStatus?.state;
  if (state === 'ERROR') {
    await fail('IMPORT_FILE_ERROR', `RAG Engine marcó el archivo con error: ${ragFile.fileStatus?.errorStatus || 'sin detalle'}`);
    return 'error';
  }
  if (state && state !== 'ACTIVE') return 'processing';
  await version.update({ ragFileName: ragFile.name });
  await activateVersion(version.id);
  return 'ready';
}

// Borra en Google Cloud solo lo que MENTOR creó y registró; es seguro repetirlo.
export async function runRemoteCleanup({ sourceId = null } = {}) {
  const where = { remoteCleanup: ['pending', 'error'] };
  if (sourceId) where.sourceId = sourceId;
  const versions = await SourceVersion.findAll({ where, limit: 50, order: [['id', 'ASC']] });
  const touched = new Set();
  // Las versiones sin nombre de archivo registrado se buscan en un solo recorrido por curso.
  const lookup = batchLookup(versions.filter((version) => !version.ragFileName && version.gcsUri).map((version) => ({ courseId: version.courseId, uri: version.gcsUri })));
  const corpora = new Map();
  for (const version of versions) {
    touched.add(version.sourceId);
    try {
      let ragFileName = version.ragFileName;
      if (!ragFileName && version.gcsUri) {
        if (!corpora.has(version.courseId)) corpora.set(version.courseId, await CourseRagCorpus.findOne({ where: { courseId: version.courseId } }));
        const corpus = corpora.get(version.courseId);
        if (corpus?.corpusName) ragFileName = (await lookup(version.courseId, corpus.corpusName, version.gcsUri))?.name || null;
      }
      if (ragFileName) await vertex.deleteRagFile(ragFileName);
      if (version.gcsUri) await vertex.deleteObject(version.gcsUri);
      await version.update({ remoteCleanup: 'done' });
    } catch (error) {
      await version.update({ remoteCleanup: 'error', errorMessage: `Limpieza pendiente: ${String(error.message).slice(0, 400)}` });
    }
  }
  for (const id of touched) await refreshCleanupStatus(id);
}

async function refreshCleanupStatus(sourceId) {
  const source = await KnowledgeSource.findByPk(sourceId);
  if (!source || source.status !== 'retired') return;
  const pending = await SourceVersion.count({ where: { sourceId, remoteCleanup: ['pending', 'error'] } });
  const failed = await SourceVersion.count({ where: { sourceId, remoteCleanup: 'error' } });
  await source.update({
    cleanupStatus: pending === 0 ? 'done' : failed ? 'error' : 'pending',
    cleanupAttempts: source.cleanupAttempts + 1,
    cleanupError: failed ? 'Algún archivo remoto no se pudo borrar; se reintentará.' : null,
  });
}

// Revisión periódica: importaciones en curso, versiones a la espera del corpus y limpieza.
export async function runMaintenance() {
  if (readRagConfig().mode === 'vertex' && readRagConfig().configured) {
    const processing = await SourceVersion.findAll({ where: { state: 'processing', importOperation: { [Op.ne]: null } }, limit: 50 });
    // Primero se revisan las operaciones; luego cada corpus se lista una sola vez para las que terminaron.
    const finished = [];
    for (const version of processing) {
      const operation = await vertex.getOperation(version.importOperation).catch(() => null);
      if (operation?.done) finished.push({ version, operation });
    }
    const lookup = batchLookup(finished.filter(({ operation }) => !operation.error).map(({ version }) => ({ courseId: version.courseId, uri: version.gcsUri })));
    for (const { version, operation } of finished) await checkImport(version.id, { lookup, operation }).catch(() => {});
    const waiting = await SourceVersion.findAll({ where: { state: 'pending', updatedAt: { [Op.lt]: new Date(Date.now() - 30000) } }, limit: 20 });
    for (const version of waiting) await startRemoteImport(version.id);
  }
  await runRemoteCleanup();
}

// ---------- Sincronización con lecciones y materiales ----------

const lessonText = (lesson) => `# ${lesson.title}\n\n${lesson.bodyMd}`;

// Una lección publicada es una fuente; al pasar a borrador deja de serlo.
export async function syncLessonSource(lesson, { actor = null } = {}) {
  const key = `lesson:${lesson.id}`;
  if (lesson.status !== 'published') {
    const source = await KnowledgeSource.findOne({ where: { courseId: lesson.courseId, sourceKey: key } });
    if (source) await retireSource(source, 'lesson_unpublished', { actor });
    return null;
  }
  const course = await sourceCourse(lesson.courseId);
  const source = await ensureSource({ course, origin: 'lesson', key, title: lesson.title, lessonId: lesson.id, userId: actor?.id });
  return publishVersion(source, { text: lessonText(lesson), mimeType: 'text/markdown', userId: actor?.id });
}

export async function sourceCourse(courseId) {
  const { Course } = sequelize.models;
  return Course.findByPk(courseId, { attributes: ['id', 'institutionId'] });
}

// Indica si un material puede consultarlo el tutor.
export const isIndexableMaterial = (material) => material.kind === 'file' && Boolean(INDEXABLE_TYPES[material.mimeType]);

// Crea la fuente de un material de archivo y su versión a partir del texto extraído.
export async function syncMaterialSource(material, { actor = null } = {}) {
  if (!isIndexableMaterial(material)) return null;
  const course = await sourceCourse(material.courseId);
  const source = await ensureSource({
    course, origin: 'material', key: `material:${material.id}`, title: material.title, materialId: material.id, userId: actor?.id, countsAsDocument: true,
  });
  let buffer;
  try {
    buffer = await readStored('materials', material.storedName);
  } catch {
    return { version: await recordFailedVersion(source, new ExtractionError('FILE_MISSING', 'El archivo original no está en el servidor.'), { userId: actor?.id }), changed: true };
  }
  try {
    const { text, pages } = await extractDocument(buffer, material.mimeType);
    return publishVersion(source, { text, pages, mimeType: material.mimeType, userId: actor?.id });
  } catch (error) {
    if (!(error instanceof ExtractionError)) throw error;
    return { version: await recordFailedVersion(source, error, { mimeType: material.mimeType, userId: actor?.id }), changed: true };
  }
}

// Retira las fuentes ligadas a una lección y a sus materiales (antes de borrarla o despublicarla).
export async function retireLessonSources(lesson, reason, { actor = null } = {}) {
  const materials = await Material.findAll({ where: { lessonId: lesson.id }, attributes: ['id'] });
  const sources = await KnowledgeSource.findAll({
    where: { courseId: lesson.courseId, status: 'active', [Op.or]: [{ lessonId: lesson.id }, { materialId: materials.map((item) => item.id) }] },
  });
  for (const source of sources) await retireSource(source, reason, { actor });
}

export async function retireMaterialSource(material, reason, { actor = null } = {}) {
  const source = await KnowledgeSource.findOne({ where: { courseId: material.courseId, sourceKey: `material:${material.id}` } });
  if (source) await retireSource(source, reason, { actor });
}

// Resumen del estado de indexación de un material para el docente.
export async function materialKnowledgeStates(materialIds) {
  if (!materialIds.length) return new Map();
  const sources = await KnowledgeSource.findAll({
    where: { materialId: materialIds },
    include: [{ model: SourceVersion, as: 'versions', attributes: ['id', 'versionNo', 'state', 'errorCode', 'errorMessage'] }],
  });
  // Una fuente retirada se informa como tal; si el material se volvió a indexar, manda la activa.
  const states = new Map();
  for (const source of sources) {
    if (source.status === 'retired') {
      if (!states.has(source.materialId)) states.set(source.materialId, { sourceId: source.id, state: 'retired' });
    } else {
      states.set(source.materialId, summarizeSource(source));
    }
  }
  return states;
}

// Estado visible de una fuente: el de su versión más reciente, o «listo» si la activa sirve.
function summarizeSource(source) {
  const versions = [...(source.versions || [])].sort((a, b) => b.versionNo - a.versionNo);
  const latest = versions[0];
  if (!latest) return { sourceId: source.id, state: 'pending' };
  const stateMap = { pending: 'pending', processing: 'processing', ready: 'ready', error: 'error', superseded: 'ready', retired: 'retired' };
  return {
    sourceId: source.id,
    state: stateMap[latest.state],
    versionId: latest.id,
    versionNo: latest.versionNo,
    errorCode: latest.state === 'error' ? latest.errorCode : null,
    errorMessage: latest.state === 'error' ? latest.errorMessage : null,
    activeVersionNo: versions.find((version) => version.id === source.activeVersionId)?.versionNo ?? null,
  };
}

// ---------- Acceso para el tutor ----------

// Fuentes que el tutor puede usar ahora: activas, con versión lista y con su origen todavía publicado.
// Devuelve solo metadatos; quien necesite el texto lo lee aparte (y solo de las versiones que use).
export async function listAuthorizedVersions(courseId) {
  const sources = await KnowledgeSource.findAll({
    where: { courseId, status: 'active', activeVersionId: { [Op.ne]: null } },
    attributes: ['id', 'title', 'origin', 'activeVersionId', 'lessonId', 'materialId'],
    include: [
      { model: Lesson, as: 'lesson', attributes: ['id', 'status', 'topicId'] },
      { model: Material, as: 'material', attributes: ['id', 'lessonId'], include: [{ model: Lesson, as: 'lesson', attributes: ['id', 'status'] }] },
      { model: CourseDriveLink, as: 'driveLink', attributes: ['id', 'status'] },
    ],
    raw: true,
    nest: true,
  });
  const allowed = sources.filter((source) => {
    if (source.origin === 'lesson') return source.lesson?.status === 'published';
    if (source.origin === 'material') return Boolean(source.material?.id) && (!source.material.lessonId || source.material.lesson?.status === 'published');
    return source.driveLink?.status === 'active';
  });
  if (!allowed.length) return [];
  const attributes = ['id', 'versionNo', 'ragFileName', 'gcsUri'];
  const versions = await SourceVersion.findAll({ where: { id: allowed.map((source) => source.activeVersionId), state: 'ready' }, attributes, raw: true });
  const byId = new Map(versions.map((version) => [version.id, version]));
  return allowed.filter((source) => byId.has(source.activeVersionId)).map((source) => ({ source, version: byId.get(source.activeVersionId) }));
}

// ---------- Panel del docente ----------

async function loadSource(user, sourceId, { write = true } = {}) {
  const source = sourceId ? await KnowledgeSource.findByPk(sourceId) : null;
  if (!source) throw notFound('Fuente no encontrada.');
  await getCourseAccess(user, source.courseId, { write });
  return source;
}

// Lista las fuentes del curso con versiones, estado y uso en respuestas.
export async function listCourseSources(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const config = readRagConfig();
  const sources = await KnowledgeSource.findAll({
    where: { courseId: course.id },
    include: [{
      model: SourceVersion, as: 'versions',
      attributes: ['id', 'versionNo', 'state', 'errorCode', 'errorMessage', 'charCount', 'mimeType', 'readyAt', 'createdAt', 'remoteCleanup', 'externalRevision'],
    }],
    order: [['status', 'ASC'], ['id', 'ASC']],
  });
  const versionIds = sources.flatMap((source) => source.versions.map((version) => version.id));
  const usage = versionIds.length
    ? await AiMessageSource.findAll({
      where: { sourceVersionId: versionIds }, attributes: ['sourceVersionId', [sequelize.fn('COUNT', sequelize.col('id')), 'uses']], group: ['sourceVersionId'], raw: true,
    })
    : [];
  const uses = new Map(usage.map((row) => [row.sourceVersionId, Number(row.uses)]));

  const lessons = await Lesson.findAll({ where: { courseId: course.id, status: 'published' }, attributes: ['id', 'title'] });
  const materials = await Material.findAll({ where: { courseId: course.id, kind: 'file' }, attributes: ['id', 'title', 'mimeType'] });
  const keys = new Set(sources.filter((source) => source.status === 'active').map((source) => source.sourceKey));
  const corpus = await CourseRagCorpus.findOne({ where: { courseId: course.id } });

  return {
    mode: config.mode,
    configured: config.configured,
    reason: config.configured ? null : config.reason,
    corpus: corpus ? { status: corpus.status, lastError: corpus.lastError } : null,
    notIndexed: [
      ...lessons.filter((lesson) => !keys.has(`lesson:${lesson.id}`)).map((lesson) => ({ origin: 'lesson', id: lesson.id, title: lesson.title })),
      ...materials.filter((material) => isIndexableMaterial(material) && !keys.has(`material:${material.id}`)).map((material) => ({ origin: 'material', id: material.id, title: material.title })),
    ],
    sources: sources.map((source) => ({
      id: source.id,
      origin: source.origin,
      title: source.title,
      status: source.status,
      retireReason: source.retireReason,
      cleanupStatus: source.cleanupStatus,
      lessonId: source.lessonId,
      materialId: source.materialId,
      ...summarizeSource(source),
      versions: [...source.versions].sort((a, b) => b.versionNo - a.versionNo).map((version) => ({
        id: version.id,
        versionNo: version.versionNo,
        state: version.state,
        active: version.id === source.activeVersionId,
        errorCode: version.errorCode,
        errorMessage: version.errorMessage,
        charCount: version.charCount,
        readyAt: version.readyAt,
        createdAt: version.createdAt,
        remoteCleanup: version.remoteCleanup,
        usedInAnswers: uses.get(version.id) || 0,
      })),
    })),
  };
}

// Indexa lecciones publicadas y materiales que existían antes de activar el tutor con fuentes.
export async function indexExisting(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const lessons = await Lesson.findAll({ where: { courseId: course.id, status: 'published' } });
  for (const lesson of lessons) await syncLessonSource(lesson, { actor: user });
  const materials = await Material.findAll({ where: { courseId: course.id, kind: 'file' } });
  let skipped = 0;
  for (const material of materials.filter(isIndexableMaterial)) {
    try {
      await syncMaterialSource(material, { actor: user });
    } catch (error) {
      if (error instanceof AppError && error.code === 'DOCUMENT_LIMIT') skipped += 1; else throw error;
    }
  }
  if (readRagConfig().mode === 'vertex') await reindexMissingRemote(course.id);
  await recordAudit({ actor: user, action: 'knowledge.indexed_existing', resourceType: 'course', resourceId: course.id });
  return listCourseSources(user, course.id).then((data) => ({ ...data, skippedForLimit: skipped }));
}

// Versiones activas creadas en modo local que aún no están en el corpus (al pasar a Vertex).
async function reindexMissingRemote(courseId) {
  const active = await KnowledgeSource.findAll({ where: { courseId, status: 'active', activeVersionId: { [Op.ne]: null } } });
  for (const source of active) {
    const version = await SourceVersion.findByPk(source.activeVersionId);
    if (version && !version.ragFileName) {
      const copy = await SourceVersion.create({
        sourceId: source.id, courseId, versionNo: (await SourceVersion.max('versionNo', { where: { sourceId: source.id } })) + 1,
        contentHash: version.contentHash, textContent: version.textContent, charCount: version.charCount, pagesJson: version.pagesJson,
        mimeType: version.mimeType, externalRevision: version.externalRevision,
      });
      enqueue(() => startRemoteImport(copy.id));
    }
  }
}

// Reintenta una versión con error: vuelve a extraer o vuelve a importar según el motivo.
export async function retryVersion(user, versionId) {
  const version = versionId ? await SourceVersion.findByPk(versionId) : null;
  if (!version) throw notFound('Versión no encontrada.');
  const source = await loadSource(user, version.sourceId);
  if (source.status === 'retired') throw conflict('SOURCE_RETIRED', 'La fuente está retirada.');
  if (version.state === 'processing' && version.importOperation) {
    await checkImport(version.id);
  } else if (version.state === 'error' && EXTRACTION_CODES.has(version.errorCode)) {
    if (source.origin === 'material') {
      const material = await Material.findByPk(source.materialId);
      if (!material) throw conflict('SOURCE_GONE', 'El material ya no existe.');
      await syncMaterialSource(material, { actor: user });
    } else {
      throw invalid('Este error se corrige actualizando el documento en su origen y volviendo a sincronizar.');
    }
  } else if (version.state === 'error') {
    await version.update({ state: 'pending', errorCode: null, errorMessage: null });
    if (readRagConfig().mode === 'vertex') enqueue(() => startRemoteImport(version.id));
    else await processVersion(version);
  } else {
    throw conflict('NOTHING_TO_RETRY', 'Esta versión no tiene un error que reintentar.');
  }
  return (await listCourseSources(user, source.courseId)).sources.find((item) => item.id === source.id);
}

// El docente retira una fuente: sale de las respuestas nuevas en el acto.
export async function retireByTeacher(user, sourceId) {
  const source = await loadSource(user, sourceId);
  await retireSource(source, 'teacher_retired', { actor: user });
  return { id: source.id, status: 'retired' };
}
