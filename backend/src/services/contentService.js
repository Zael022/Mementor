import { Module, Topic, TopicPrerequisite, Lesson, LessonProgress, Material, sequelize } from '../models/index.js';
import { forbidden, invalid, notFound } from '../utils/AppError.js';
import { toEmbedUrl } from '../utils/links.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import { removeStoredFiles } from './fileCleanup.js';
import { retireLessonSources, syncLessonSource } from './knowledgeService.js';
import { invalidateSource } from './agents/responseCache.js';
import { getModuleProgress, getStudentCourseRank, rankWentUp } from './progressRankService.js';

// Calcula la siguiente posición dentro de un grupo.
async function nextPosition(model, where) {
  const max = await model.max('position', { where });
  return (max || 0) + 1;
}

// Carga un registro y verifica el acceso a su curso.
async function loadWithAccess(model, id, user, { write = false, label }) {
  const record = id ? await model.findByPk(id) : null;
  if (!record) throw notFound(`${label} no encontrado.`);
  const access = await getCourseAccess(user, record.courseId, { write });
  return { record, ...access };
}

const moduleDto = (module) => ({ id: module.id, courseId: module.courseId, title: module.title, position: module.position });
const topicDto = (topic) => ({
  id: topic.id, courseId: topic.courseId, moduleId: topic.moduleId, title: topic.title, learningObjective: topic.learningObjective, position: topic.position,
});
const lessonDto = (lesson) => ({
  id: lesson.id, courseId: lesson.courseId, topicId: lesson.topicId, title: lesson.title, bodyMd: lesson.bodyMd, status: lesson.status, position: lesson.position, updatedAt: lesson.updatedAt,
  videoUrl: lesson.videoUrl, videoEmbedUrl: lesson.videoUrl ? toEmbedUrl(lesson.videoUrl) : null,
});

// Acepta solo videos de YouTube o Vimeo; un texto vacío quita el video.
function cleanVideoUrl(videoUrl) {
  if (videoUrl === undefined) return undefined;
  if (!videoUrl) return null;
  if (!toEmbedUrl(videoUrl)) throw invalid('El video debe ser un enlace https de YouTube o Vimeo.');
  return videoUrl;
}

// Busca la lección anterior y la siguiente en el orden del curso.
async function findNeighbors(lesson, canEdit) {
  const lessons = await Lesson.findAll({
    where: { courseId: lesson.courseId, ...(canEdit ? {} : { status: 'published' }) },
    attributes: ['id', 'title', 'position'],
    include: [{ model: Topic, as: 'topic', attributes: ['position'], include: [{ model: Module, as: 'module', attributes: ['position'] }] }],
  });
  const key = (item) => [item.topic.module.position, item.topic.position, item.position, item.id];
  lessons.sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });
  const index = lessons.findIndex((item) => item.id === lesson.id);
  const brief = (item) => (item ? { id: item.id, title: item.title } : null);
  return { previous: brief(lessons[index - 1]), next: brief(lessons[index + 1]) };
}

// --- Módulos ---
export async function createModule(user, courseId, { title }) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const module = await Module.create({ courseId: course.id, title, position: await nextPosition(Module, { courseId: course.id }) });
  return moduleDto(module);
}

export async function updateModule(user, moduleId, changes) {
  const { record } = await loadWithAccess(Module, moduleId, user, { write: true, label: 'Módulo' });
  await record.update(changes);
  return moduleDto(record);
}

export async function deleteModule(user, moduleId) {
  const { record } = await loadWithAccess(Module, moduleId, user, { write: true, label: 'Módulo' });
  await record.destroy();
}

// --- Temas ---
export async function createTopic(user, moduleId, { title, learningObjective }) {
  const { record: module } = await loadWithAccess(Module, moduleId, user, { write: true, label: 'Módulo' });
  const topic = await Topic.create({
    courseId: module.courseId,
    moduleId: module.id,
    title,
    learningObjective: learningObjective || null,
    position: await nextPosition(Topic, { moduleId: module.id }),
  });
  return topicDto(topic);
}

export async function updateTopic(user, topicId, changes) {
  const { record } = await loadWithAccess(Topic, topicId, user, { write: true, label: 'Tema' });
  await record.update(changes);
  return topicDto(record);
}

export async function deleteTopic(user, topicId) {
  const { record } = await loadWithAccess(Topic, topicId, user, { write: true, label: 'Tema' });
  await record.destroy();
}

// Define los prerrequisitos de un tema dentro del mismo curso.
export async function setPrerequisites(user, topicId, prerequisiteTopicIds) {
  const { record: topic } = await loadWithAccess(Topic, topicId, user, { write: true, label: 'Tema' });
  const ids = [...new Set(prerequisiteTopicIds)];
  if (ids.includes(topic.id)) throw invalid('Un tema no puede ser prerrequisito de sí mismo.');
  const valid = await Topic.count({ where: { id: ids, courseId: topic.courseId } });
  if (valid !== ids.length) throw invalid('Todos los prerrequisitos deben pertenecer al mismo curso.');

  // Evita ciclos directos entre dos temas.
  const reverse = await TopicPrerequisite.count({ where: { topicId: ids, prerequisiteTopicId: topic.id } });
  if (reverse > 0) throw invalid('Uno de los temas elegidos ya depende de este tema.');

  await sequelize.transaction(async (transaction) => {
    await TopicPrerequisite.destroy({ where: { topicId: topic.id }, transaction });
    await TopicPrerequisite.bulkCreate(ids.map((prerequisiteTopicId) => ({ topicId: topic.id, prerequisiteTopicId })), { transaction });
  });
  return { topicId: topic.id, prerequisiteIds: ids };
}

// --- Lecciones ---
export async function createLesson(user, topicId, { title, bodyMd, videoUrl }) {
  const { record: topic } = await loadWithAccess(Topic, topicId, user, { write: true, label: 'Tema' });
  const lesson = await Lesson.create({
    courseId: topic.courseId,
    topicId: topic.id,
    title,
    bodyMd,
    videoUrl: cleanVideoUrl(videoUrl) ?? null,
    position: await nextPosition(Lesson, { topicId: topic.id }),
  });
  return lessonDto(lesson);
}

export async function listLessons(user, topicId) {
  const { record: topic, canEdit } = await loadWithAccess(Topic, topicId, user, { label: 'Tema' });
  const where = { topicId: topic.id, ...(canEdit ? {} : { status: 'published' }) };
  const lessons = await Lesson.findAll({ where, order: [['position', 'ASC'], ['id', 'ASC']] });
  return lessons.map(lessonDto);
}

export async function getLesson(user, lessonId) {
  const { record: lesson, canEdit, course } = await loadWithAccess(Lesson, lessonId, user, { label: 'Lección' });
  if (!canEdit && lesson.status !== 'published') throw notFound('Lección no encontrada.');
  const topic = await Topic.findByPk(lesson.topicId, { attributes: ['id', 'title'] });
  const completed = user.role === 'student'
    ? Boolean(await LessonProgress.findOne({ where: { studentId: user.id, lessonId: lesson.id } }))
    : undefined;
  const neighbors = await findNeighbors(lesson, canEdit);
  return { ...lessonDto(lesson), course: { id: course.id, title: course.title }, topic: { id: topic.id, title: topic.title }, completed, canEdit, ...neighbors };
}

export async function updateLesson(user, lessonId, changes) {
  const { record } = await loadWithAccess(Lesson, lessonId, user, { write: true, label: 'Lección' });
  const wasStatus = record.status;
  if ('videoUrl' in changes) changes.videoUrl = cleanVideoUrl(changes.videoUrl);
  await record.update(changes);
  // Un resumen guardado de esta lección deja de valer si cambió su contenido o su estado.
  await invalidateSource(`lesson:${record.id}`);
  if (changes.status && changes.status !== wasStatus) {
    await recordAudit({ actor: user, action: `lesson.${changes.status}`, resourceType: 'lesson', resourceId: record.id });
  }
  // La lección publicada es fuente del tutor: cada cambio de contenido crea una versión; al despublicarla se retira.
  // Sus materiales quedan fuera de las respuestas mientras la lección esté en borrador (se filtra al consultar).
  if (record.status === 'published' || wasStatus === 'published') await syncLessonSource(record, { actor: user });
  return lessonDto(record);
}

// Borra la lección: retira sus fuentes, borra registros y reconcilia los archivos de sus materiales.
export async function deleteLesson(user, lessonId) {
  const { record } = await loadWithAccess(Lesson, lessonId, user, { write: true, label: 'Lección' });
  await retireLessonSources(record, 'lesson_deleted', { actor: user });
  await invalidateSource(`lesson:${record.id}`);
  const files = await Material.findAll({ where: { lessonId: record.id, kind: 'file' }, attributes: ['storedName'] });
  await record.destroy();
  await removeStoredFiles(files.map((file) => file.storedName));
}

// Marca una lección publicada como completada por el estudiante.
export async function completeLesson(user, lessonId) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes registran avance.');
  const { record: lesson } = await loadWithAccess(Lesson, lessonId, user, { label: 'Lección' });
  if (lesson.status !== 'published') throw notFound('Lección no encontrada.');
  // El rango de antes y el de después permiten celebrar una subida sin guardar el último rango visto.
  const before = await getStudentCourseRank(user.id, lesson.courseId);
  const [, created] = await LessonProgress.findOrCreate({
    where: { studentId: user.id, lessonId: lesson.id },
    defaults: { status: 'completed', completedAt: new Date() },
  });
  const after = await getStudentCourseRank(user.id, lesson.courseId);
  const topic = await Topic.findByPk(lesson.topicId, { attributes: ['moduleId'] });
  const module = await getModuleProgress(user.id, topic.moduleId);
  return {
    lessonId: lesson.id,
    completed: true,
    rank: { before, after, rankedUp: rankWentUp(before, after) },
    module: { ...module, justCompleted: created && module.completed },
  };
}
