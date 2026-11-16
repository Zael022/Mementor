import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { CourseDriveLink, InstitutionDriveFolder, KnowledgeSource, SourceVersion } from '../models/index.js';
import { AppError, conflict, invalid, notFound } from '../utils/AppError.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import * as drive from './driveClient.js';
import { ExtractionError, INDEXABLE_TYPES, extractDocument } from './extractionService.js';
import { GoogleCallError } from './googleCloud.js';
import { ensureSource, publishVersion, recordFailedVersion, retireSource, sourceCourse } from './knowledgeService.js';

// Sincronización de carpetas de Drive habilitadas por la institución con las fuentes del curso.

const maxBytes = () => Number(process.env.DRIVE_MAX_FILE_MB || 10) * 1024 * 1024;
const STALE_RUN_MS = 15 * 60000;
const running = new Map();

const folderDto = (row) => ({ id: row.id, folderId: row.folderId, label: row.label, status: row.status, createdAt: row.createdAt });
const linkDto = (link) => (link ? {
  id: link.id,
  driveFolderId: link.driveFolderId,
  folder: link.folder ? folderDto(link.folder) : null,
  syncState: link.syncState,
  resumable: Boolean(link.syncRunId),
  filesListed: link.filesListed,
  lastSyncStartedAt: link.lastSyncStartedAt,
  lastSyncCompletedAt: link.lastSyncCompletedAt,
  lastError: link.lastError,
} : null);

// ---------- Carpetas habilitadas (administración de la institución) ----------
export async function listFolders(user) {
  const rows = await InstitutionDriveFolder.findAll({ where: { institutionId: user.institutionId }, order: [['label', 'ASC']] });
  return rows.map(folderDto);
}

// Habilita una carpeta después de confirmar que la identidad del servidor puede leerla.
export async function addFolder(user, { folderId, label }) {
  if (await InstitutionDriveFolder.findOne({ where: { institutionId: user.institutionId, folderId } })) {
    throw conflict('FOLDER_EXISTS', 'Esa carpeta ya está habilitada.');
  }
  let meta;
  try {
    meta = await drive.getFolder(folderId);
  } catch (error) {
    if (error instanceof GoogleCallError && [403, 404].includes(error.status)) {
      throw invalid('La cuenta de servicio de MENTOR no puede leer esa carpeta. Compártela con permiso de lector y vuelve a intentarlo.');
    }
    throw new AppError(503, 'DRIVE_UNAVAILABLE', 'No se pudo consultar Google Drive. Revisa la configuración del servidor.');
  }
  if (meta.mimeType !== drive.FOLDER_MIME || meta.trashed) throw invalid('El identificador no corresponde a una carpeta activa.');
  const row = await InstitutionDriveFolder.create({ institutionId: user.institutionId, folderId, label, createdBy: user.id });
  await recordAudit({ actor: user, action: 'drive.folder.enabled', resourceType: 'drive_folder', resourceId: row.id });
  return folderDto(row);
}

// Deshabilita una carpeta y retira las fuentes de los cursos que la usaban.
export async function disableFolder(user, id) {
  const row = await InstitutionDriveFolder.findOne({ where: { id, institutionId: user.institutionId } });
  if (!row) throw notFound('Carpeta no encontrada.');
  await row.update({ status: 'disabled' });
  const links = await CourseDriveLink.findAll({ where: { driveFolderId: row.id, status: 'active' } });
  for (const link of links) await removeLink(link, 'drive_folder_disabled', user);
  await recordAudit({ actor: user, action: 'drive.folder.disabled', resourceType: 'drive_folder', resourceId: row.id });
  return folderDto(row);
}

// ---------- Vínculo de un curso ----------
async function activeLink(courseId) {
  return CourseDriveLink.findOne({ where: { courseId, status: 'active' }, include: [{ model: InstitutionDriveFolder, as: 'folder' }] });
}

export async function getCourseDrive(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const folders = await InstitutionDriveFolder.findAll({ where: { institutionId: course.institutionId, status: 'enabled' }, order: [['label', 'ASC']] });
  return { link: linkDto(await activeLink(course.id)), folders: folders.map(folderDto) };
}

async function removeLink(link, reason, actor) {
  await link.update({ status: 'removed', syncState: 'idle', syncRunId: null, pageToken: null });
  const sources = await KnowledgeSource.findAll({ where: { driveLinkId: link.id, status: 'active' } });
  for (const source of sources) await retireSource(source, reason, { actor });
}

// Vincula el curso con una carpeta habilitada por su institución (una por curso).
export async function linkFolder(user, courseId, { driveFolderId }) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const folder = await InstitutionDriveFolder.findOne({ where: { id: driveFolderId, institutionId: course.institutionId, status: 'enabled' } });
  if (!folder) throw invalid('La carpeta no está habilitada por tu institución.');
  const current = await activeLink(course.id);
  if (current?.driveFolderId === folder.id) return linkDto(current);
  if (current) await removeLink(current, 'drive_folder_changed', user);
  const link = await CourseDriveLink.create({ institutionId: course.institutionId, courseId: course.id, driveFolderId: folder.id, createdBy: user.id });
  link.folder = folder;
  await recordAudit({ actor: user, action: 'drive.course.linked', resourceType: 'course', resourceId: course.id, metadata: { driveFolderId: folder.id } });
  return linkDto(link);
}

export async function unlinkFolder(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const link = await activeLink(course.id);
  if (!link) throw notFound('El curso no tiene una carpeta vinculada.');
  await removeLink(link, 'drive_unlinked', user);
  return { unlinked: true };
}

// ---------- Sincronización ----------

// Procesa un archivo listado: solo descarga cuando cambió su revisión.
async function processFile(link, file, runId, course, stats) {
  const supported = file.mimeType === drive.GOOGLE_DOC_MIME || INDEXABLE_TYPES[file.mimeType];
  if (!supported) {
    stats.skipped += 1;
    return;
  }
  let source;
  try {
    source = await ensureSource({
      course, origin: 'drive', key: `drive:${file.id}`, title: file.name, driveFileId: file.id, driveLinkId: link.id, countsAsDocument: true,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'DOCUMENT_LIMIT') {
      stats.overLimit += 1;
      return;
    }
    throw error;
  }
  await source.update({ lastSeenRun: runId, title: file.name.slice(0, 200) });
  const revision = `${file.modifiedTime || ''}|${file.md5Checksum || ''}`.slice(0, 120);
  const latest = await SourceVersion.findOne({ where: { sourceId: source.id }, order: [['versionNo', 'DESC']] });
  if (latest && latest.externalRevision === revision && latest.state !== 'error') {
    stats.unchanged += 1;
    return;
  }
  if (Number(file.size || 0) > maxBytes()) {
    await recordFailedVersion(source, new ExtractionError('FILE_TOO_LARGE', 'El archivo supera el tamaño máximo que MENTOR descarga de Drive.'), { externalRevision: revision });
    stats.failed += 1;
    return;
  }
  try {
    let text;
    let pages = null;
    let mimeType = file.mimeType;
    if (file.mimeType === drive.GOOGLE_DOC_MIME) {
      text = String(await drive.exportDocText(file.id)).replace(/^\uFEFF/, '').trim();
      mimeType = 'text/plain';
      if (text.replace(/\s/g, '').length < 20) throw new ExtractionError('EMPTY_TEXT', 'El documento no tiene texto suficiente para consultarlo.');
    } else {
      ({ text, pages } = await extractDocument(await drive.downloadFile(file.id), file.mimeType));
    }
    const { changed } = await publishVersion(source, { text, pages, mimeType, externalRevision: revision });
    stats[changed ? 'updated' : 'unchanged'] += 1;
  } catch (error) {
    if (!(error instanceof ExtractionError)) throw error;
    await recordFailedVersion(source, error, { mimeType: file.mimeType, externalRevision: revision });
    stats.failed += 1;
  }
}

// Recorre todas las páginas; si se interrumpe, la próxima vez continúa desde la misma página y no declara borrados.
export async function syncLink(linkId, { maxPages = Infinity } = {}) {
  const [claimed] = await CourseDriveLink.update(
    { syncState: 'running', lastError: null },
    { where: { id: linkId, status: 'active', [Op.or]: [{ syncState: { [Op.ne]: 'running' } }, { updatedAt: { [Op.lt]: new Date(Date.now() - STALE_RUN_MS) } }] } },
  );
  if (!claimed) return { started: false };
  const link = await CourseDriveLink.findByPk(linkId, { include: [{ model: InstitutionDriveFolder, as: 'folder' }] });
  const course = await sourceCourse(link.courseId);
  const stats = { pages: 0, listed: 0, updated: 0, unchanged: 0, failed: 0, skipped: 0, overLimit: 0, retired: 0, completed: false };
  if (!link.syncRunId) await link.update({ syncRunId: randomUUID(), pageToken: null, filesListed: 0, lastSyncStartedAt: new Date() });
  const runId = link.syncRunId;

  try {
    let meta;
    try {
      meta = await drive.getFolder(link.folder.folderId);
    } catch (error) {
      // 404: la carpeta ya no existe o se quitó el acceso. Es una pérdida confirmada.
      if (error instanceof GoogleCallError && error.status === 404) meta = { trashed: true };
      else throw error;
    }
    if (meta.trashed) {
      const sources = await KnowledgeSource.findAll({ where: { driveLinkId: link.id, status: 'active' } });
      for (const source of sources) await retireSource(source, 'drive_access_lost');
      await link.update({ syncState: 'error', syncRunId: null, pageToken: null, lastError: 'MENTOR perdió el acceso a la carpeta o fue eliminada. Sus fuentes se retiraron.' });
      return { ...stats, retired: sources.length, accessLost: true };
    }

    do {
      const page = await drive.listChildren(link.folder.folderId, link.pageToken);
      for (const file of page.files || []) await processFile(link, file, runId, course, stats);
      stats.pages += 1;
      stats.listed += (page.files || []).length;
      await link.update({ pageToken: page.nextPageToken || null, filesListed: link.filesListed + (page.files || []).length });
      if (page.nextPageToken && stats.pages >= maxPages) {
        await link.update({ syncState: 'interrupted' });
        return stats;
      }
    } while (link.pageToken);

    // Solo con el listado completo se retiran los archivos que ya no están en la carpeta.
    const gone = await KnowledgeSource.findAll({
      where: { driveLinkId: link.id, status: 'active', [Op.or]: [{ lastSeenRun: { [Op.ne]: runId } }, { lastSeenRun: null }] },
    });
    for (const source of gone) await retireSource(source, 'drive_removed');
    stats.retired = gone.length;
    stats.completed = true;
    await link.update({ syncState: 'idle', syncRunId: null, pageToken: null, lastSyncCompletedAt: new Date(), lastError: null });
    return stats;
  } catch (error) {
    // Se conserva la página y la corrida para reanudar sin perder lo ya visto.
    await link.update({ syncState: 'interrupted', lastError: String(error.message || 'Error de sincronización').slice(0, 500) });
    return { ...stats, error: error.message };
  }
}

// Inicia la sincronización del curso en segundo plano y responde al instante.
export async function startCourseSync(user, courseId, { wait = false } = {}) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const link = await activeLink(course.id);
  if (!link) throw notFound('El curso no tiene una carpeta vinculada.');
  await recordAudit({ actor: user, action: 'drive.sync.started', resourceType: 'course', resourceId: course.id });
  if (!running.has(link.id)) {
    const job = syncLink(link.id).finally(() => running.delete(link.id));
    running.set(link.id, job);
  }
  if (wait) return running.get(link.id) || { started: false };
  return linkDto(await activeLink(course.id));
}

// Sincronización periódica de todos los vínculos activos (si está habilitada).
export async function syncAllLinks() {
  const links = await CourseDriveLink.findAll({ where: { status: 'active' }, attributes: ['id'] });
  for (const link of links) {
    if (running.has(link.id)) continue;
    const job = syncLink(link.id).finally(() => running.delete(link.id));
    running.set(link.id, job);
    await job;
  }
}

