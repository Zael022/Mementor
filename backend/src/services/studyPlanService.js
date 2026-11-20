import { StudyPlan, StudyPlanItem, Topic, TopicMastery, TopicPrerequisite, sequelize } from '../models/index.js';
import { forbidden, invalid, notFound } from '../utils/AppError.js';
import { addDays, dayKey } from '../utils/clock.js';
import { PLANNER, buildStudyPlan } from '../utils/studyPlanner.js';
import { getCourseAccess } from './accessService.js';
import { orderedTopics } from './masteryService.js';
import { getPreferences, isValidTimeZone } from './preferenceService.js';
import { reviewDueDates } from './reviewService.js';

function assertStudent(user) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes tienen planes de estudio.');
}

function planDto(plan, items) {
  const done = items.filter((item) => item.status === 'done');
  return {
    id: plan.id,
    courseId: plan.courseId,
    title: plan.title,
    startDate: plan.startDate,
    targetDate: plan.targetDate,
    minutesPerSession: plan.minutesPerSession,
    studyDays: plan.studyDays.split(',').map(Number),
    timeZone: plan.timeZone,
    today: dayKey(undefined, plan.timeZone),
    unscheduledMinutes: plan.unscheduledMinutes,
    algorithmVersion: plan.algorithmVersion,
    totalMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
    doneMinutes: done.reduce((sum, item) => sum + item.minutes, 0),
    items: items.map((item) => ({
      id: item.id,
      topicId: item.topicId,
      topicTitle: item.topic?.title ?? null,
      kind: item.kind,
      description: item.description,
      minutes: item.minutes,
      scheduledDate: item.scheduledDate,
      status: item.status,
    })),
  };
}

async function loadItems(planId, transaction) {
  return StudyPlanItem.findAll({
    where: { studyPlanId: planId },
    include: [{ model: Topic, as: 'topic', attributes: ['id', 'title'] }],
    order: [['scheduledDate', 'ASC'], ['position', 'ASC'], ['id', 'ASC']],
    transaction,
  });
}

// Devuelve el plan vigente del curso o null si no hay ninguno.
export async function getActivePlan(user, courseId) {
  assertStudent(user);
  const { course } = await getCourseAccess(user, courseId);
  const plan = await StudyPlan.findOne({ where: { studentId: user.id, courseId: course.id, status: 'active' }, order: [['id', 'DESC']] });
  return plan ? planDto(plan, await loadItems(plan.id)) : null;
}

// Reúne dominio, prerrequisitos y repasos de cada tema para el planificador.
async function planningInput(studentId, courseId, timeZone) {
  const topics = await orderedTopics(courseId);
  const topicIds = topics.map((topic) => topic.id);
  const [mastery, prerequisites, dueDates] = await Promise.all([
    TopicMastery.findAll({ where: { studentId, topicId: topicIds } }),
    TopicPrerequisite.findAll({ where: { topicId: topicIds } }),
    reviewDueDates(studentId, courseId),
  ]);
  return topics.map((topic, order) => {
    const row = mastery.find((item) => item.topicId === topic.id);
    const due = dueDates.get(topic.id);
    return {
      id: topic.id,
      title: topic.title,
      order,
      prerequisiteIds: prerequisites.filter((item) => item.topicId === topic.id).map((item) => item.prerequisiteTopicId),
      masteryScore: row ? Number(row.masteryScore) : null,
      evidenceCount: row?.evidenceCount ?? 0,
      reviewDueDay: due ? dayKey(new Date(due), timeZone) : null,
    };
  });
}

// Crea un plan nuevo y archiva el anterior; la zona horaria la elige el estudiante, nunca se supone.
export async function createPlan(user, courseId, { targetDate, minutesPerSession, studyDays, timeZone }) {
  assertStudent(user);
  const { course } = await getCourseAccess(user, courseId);
  const zone = timeZone || (await getPreferences(user)).timeZone;
  if (!zone) throw invalid('Elige tu zona horaria para calcular las fechas del plan.');
  if (!isValidTimeZone(zone)) throw invalid('Zona horaria no reconocida.');

  const startDate = dayKey(undefined, zone);
  if (targetDate < startDate) throw invalid('La fecha objetivo no puede estar en el pasado.');
  if (targetDate > addDays(startDate, PLANNER.maxDays)) throw invalid(`La fecha objetivo debe estar dentro de los próximos ${PLANNER.maxDays} días.`);

  const days = [...new Set(studyDays)].sort();
  const topics = await planningInput(user.id, course.id, zone);
  if (topics.length === 0) throw invalid('Este curso todavía no tiene temas para planificar.');
  const result = buildStudyPlan({ topics, startDate, targetDate, studyDays: days, minutesPerSession });
  if (result.studyDayCount === 0) throw invalid('No hay días de estudio entre hoy y la fecha objetivo. Elige más días o una fecha posterior.');

  const plan = await sequelize.transaction(async (transaction) => {
    await StudyPlan.update({ status: 'archived' }, { where: { studentId: user.id, courseId: course.id, status: 'active' }, transaction });
    const created = await StudyPlan.create({
      studentId: user.id,
      courseId: course.id,
      title: `Plan hasta el ${targetDate}`,
      startDate,
      targetDate,
      minutesPerSession,
      studyDays: days.join(','),
      timeZone: zone,
      unscheduledMinutes: result.unscheduledMinutes,
      algorithmVersion: PLANNER.version,
    }, { transaction });
    if (result.items.length) {
      await StudyPlanItem.bulkCreate(result.items.map((item) => ({ ...item, studyPlanId: created.id })), { transaction });
    }
    return created;
  });
  return planDto(plan, await loadItems(plan.id));
}

// Edición manual de una sesión del plan propio: estado, fecha o minutos.
export async function updatePlanItem(user, itemId, changes) {
  assertStudent(user);
  const item = itemId ? await StudyPlanItem.findByPk(itemId, { include: [{ model: StudyPlan, as: 'plan' }] }) : null;
  // Un plan ajeno se trata como inexistente.
  if (!item || item.plan.studentId !== user.id) throw notFound('Sesión de estudio no encontrada.');
  await getCourseAccess(user, item.plan.courseId);
  if (item.plan.status !== 'active') throw invalid('El plan está archivado.');
  if (changes.scheduledDate) {
    const today = dayKey(undefined, item.plan.timeZone);
    if (changes.scheduledDate < today || changes.scheduledDate > item.plan.targetDate) {
      throw invalid(`La fecha debe estar entre hoy (${today}) y la fecha objetivo (${item.plan.targetDate}).`);
    }
  }
  await item.update(changes);
  return planDto(item.plan, await loadItems(item.plan.id));
}

// Archiva el plan propio.
export async function archivePlan(user, planId) {
  assertStudent(user);
  const plan = planId ? await StudyPlan.findByPk(planId) : null;
  if (!plan || plan.studentId !== user.id) throw notFound('Plan no encontrado.');
  await plan.update({ status: 'archived' });
}
