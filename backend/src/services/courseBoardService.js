import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Announcement, Institution, KnowledgeSource, Material, Lesson, LessonComment, User } from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { readRagConfig } from '../config/rag.js';
import { uploadDir } from '../middlewares/upload.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import { removeStoredFiles } from './fileCleanup.js';
import { matchesSignature } from '../utils/fileSignature.js';
import { isIndexableMaterial, materialKnowledgeStates, retireMaterialSource, syncMaterialSource } from './knowledgeService.js';

// ---------- Anuncios ----------
const announcementDto = (row) => ({
  id: row.id,
  courseId: row.courseId,
  title: row.title,
  body: row.body,
  author: row.author?.id ? { id: row.author.id, displayName: row.author.displayName } : null,
  createdAt: row.createdAt,
});

export async function listAnnouncements(user, courseId) {
  const { course } = await getCourseAccess(user, courseId);
  const rows = await Announcement.findAll({
    where: { courseId: course.id },
    attributes: ['id', 'courseId', 'title', 'body', 'createdAt'],
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName'] }],
    order: [['id', 'DESC']],
    limit: 50,
    raw: true,
    nest: true,
  });
  return rows.map(announcementDto);
}

export async function createAnnouncement(user, courseId, { title, body }) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const row = await Announcement.create({ courseId: course.id, authorId: user.id, title, body });
  row.author = user;
  await recordAudit({ actor: user, action: 'announcement.created', resourceType: 'announcement', resourceId: row.id });
  return announcementDto(row);
}

export async function deleteAnnouncement(user, announcementId) {
  const row = announcementId ? await Announcement.findByPk(announcementId) : null;
  if (!row) throw notFound('Anuncio no encontrado.');
  await getCourseAccess(user, row.courseId, { write: true });
  await row.destroy();
}

// ---------- Materiales ----------
const materialDto = (row, knowledge) => ({
  ...(knowledge !== undefined ? { knowledge } : {}),
  id: row.id,
  courseId: row.courseId,
  lessonId: row.lessonId,
  title: row.title,
  kind: row.kind,
  url: row.kind === 'link' ? row.url : null,
  fileName: row.fileName,
  sizeBytes: row.sizeBytes,
  createdAt: row.createdAt,
});

// Verifica que la lección sea del curso y devuelve su id (o null si es material general).
async function resolveLesson(lessonId, courseId) {
  if (!lessonId) return null;
  const lesson = await Lesson.findOne({ where: { id: lessonId, courseId } });
  if (!lesson) throw invalid('La lección indicada no pertenece a este curso.');
  return lesson.id;
}

// Lista materiales del curso; el estudiante no ve los de lecciones en borrador.
export async function listMaterials(user, courseId, { lessonId } = {}) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const where = { courseId: course.id };
  if (lessonId) where.lessonId = lessonId;
  const rows = await Material.findAll({
    where,
    attributes: ['id', 'courseId', 'lessonId', 'title', 'kind', 'url', 'fileName', 'sizeBytes', 'mimeType', 'createdAt'],
    include: [{ model: Lesson, as: 'lesson', attributes: ['id', 'title', 'status'] }],
    order: [['id', 'ASC']],
    raw: true,
    nest: true,
  });
  const visible = rows.filter((row) => canEdit || !row.lessonId || row.lesson?.status === 'published');
  // El estado de indexación solo lo ve quien gestiona el curso.
  const states = canEdit ? await materialKnowledgeStates(visible.filter(isIndexableMaterial).map((row) => row.id)) : null;
  return visible.map((row) => ({
    ...materialDto(row, canEdit ? (isIndexableMaterial(row) ? states.get(row.id) || { state: 'not_indexed' } : { state: 'not_indexable' }) : undefined),
    lessonTitle: row.lesson?.title ?? null,
  }));
}

export async function createLinkMaterial(user, courseId, { title, url, lessonId }) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const row = await Material.create({
    courseId: course.id, lessonId: await resolveLesson(lessonId, course.id), title, kind: 'link', url, uploadedBy: user.id,
  });
  return materialDto(row);
}

// Guarda el registro de un archivo ya recibido; si algo falla, borra el archivo.
export async function createFileMaterial(user, courseId, { title, lessonId, file }) {
  try {
    if (!file) throw invalid('Selecciona un archivo permitido (PDF, Word, PowerPoint, Excel, imagen o texto).');
    const { course } = await getCourseAccess(user, courseId, { write: true });
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[\\/]/g, '_').slice(0, 200);
    // La extensión y el tipo los declara el navegador; los primeros bytes confirman el formato real.
    if (!(await matchesSignature(file.path, path.extname(file.filename)))) {
      throw invalid('El contenido del archivo no corresponde a su formato. Sube el archivo original sin renombrarlo.');
    }
    await assertRoomForDocument(course, file.mimetype);
    const row = await Material.create({
      courseId: course.id,
      lessonId: await resolveLesson(lessonId, course.id),
      title: (title || originalName).slice(0, 180),
      kind: 'file',
      fileName: originalName,
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: user.id,
    });
    await recordAudit({ actor: user, action: 'material.uploaded', resourceType: 'material', resourceId: row.id });
    // PDF, DOCX y TXT pasan a ser fuentes del tutor; el estado de indexación viaja en la respuesta.
    let knowledge = { state: 'not_indexable' };
    if (isIndexableMaterial(row)) {
      const result = await syncMaterialSource(row, { actor: user });
      knowledge = (await materialKnowledgeStates([row.id])).get(row.id) || { state: result?.version?.state || 'pending' };
    }
    return materialDto(row, knowledge);
  } catch (error) {
    if (file?.path) await unlink(file.path).catch(() => {});
    throw error;
  }
}

async function loadMaterial(user, materialId, { write = false } = {}) {
  const row = materialId ? await Material.findByPk(materialId, { include: [{ model: Lesson, as: 'lesson', attributes: ['id', 'status'] }] }) : null;
  if (!row) throw notFound('Material no encontrado.');
  const { canEdit } = await getCourseAccess(user, row.courseId, { write });
  if (!canEdit && row.lesson && row.lesson.status !== 'published') throw notFound('Material no encontrado.');
  return row;
}

// Entrega la ruta del archivo solo a quien tiene acceso al curso.
export async function getMaterialFile(user, materialId) {
  const row = await loadMaterial(user, materialId);
  if (row.kind !== 'file') throw invalid('Este material es un enlace, no un archivo.');
  return { filePath: path.join(uploadDir(), path.basename(row.storedName)), fileName: row.fileName };
}

export async function deleteMaterial(user, materialId) {
  const row = await loadMaterial(user, materialId, { write: true });
  await retireMaterialSource(row, 'material_deleted', { actor: user });
  await row.destroy();
  if (row.kind === 'file') await removeStoredFiles([row.storedName]);
}

// Revisa el tope de documentos antes de guardar un archivo que el tutor indexará.
async function assertRoomForDocument(course, mimeType) {
  if (!isIndexableMaterial({ kind: 'file', mimeType })) return;
  const institution = await Institution.findByPk(course.institutionId);
  const limit = institution?.maxDocuments ?? readRagConfig().maxDocuments;
  const used = await KnowledgeSource.count({ where: { institutionId: course.institutionId, status: 'active', origin: ['material', 'drive'] } });
  if (used >= limit) throw conflict('DOCUMENT_LIMIT', `La institución alcanzó su tope de ${limit} documentos para el tutor. Retira alguno o pide ampliar el tope.`);
}

// ---------- Preguntas y respuestas de una lección ----------
async function loadLesson(user, lessonId) {
  const lesson = lessonId ? await Lesson.findByPk(lessonId) : null;
  if (!lesson) throw notFound('Lección no encontrada.');
  const access = await getCourseAccess(user, lesson.courseId);
  if (!access.canEdit && lesson.status !== 'published') throw notFound('Lección no encontrada.');
  return { lesson, ...access };
}

const commentDto = (row, user, canEdit) => ({
  id: row.id,
  parentId: row.parentId,
  body: row.body,
  author: { id: row.author.id, displayName: row.author.displayName, isStaff: row.author.role !== 'student' },
  canDelete: canEdit || row.authorId === user.id,
  createdAt: row.createdAt,
});

export async function listComments(user, lessonId) {
  const { lesson, canEdit } = await loadLesson(user, lessonId);
  const rows = await LessonComment.findAll({
    where: { lessonId: lesson.id },
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'role'] }],
    order: [['id', 'ASC']],
    limit: 300,
  });
  return rows.map((row) => commentDto(row, user, canEdit));
}

export async function createComment(user, lessonId, { body, parentId }) {
  const { lesson, canEdit } = await loadLesson(user, lessonId);
  let parent = null;
  if (parentId) {
    parent = await LessonComment.findOne({ where: { id: parentId, lessonId: lesson.id } });
    if (!parent) throw invalid('El comentario al que respondes no existe en esta lección.');
  }
  // Las respuestas se agrupan en un solo nivel bajo la pregunta original.
  const row = await LessonComment.create({
    courseId: lesson.courseId, lessonId: lesson.id, authorId: user.id, parentId: parent ? (parent.parentId || parent.id) : null, body,
  });
  row.author = user;
  return commentDto(row, user, canEdit);
}

export async function deleteComment(user, commentId) {
  const row = commentId ? await LessonComment.findByPk(commentId) : null;
  if (!row) throw notFound('Comentario no encontrado.');
  const { canEdit } = await getCourseAccess(user, row.courseId);
  if (!canEdit && row.authorId !== user.id) throw forbidden('Solo puedes borrar tus propios comentarios.');
  await row.destroy();
}
