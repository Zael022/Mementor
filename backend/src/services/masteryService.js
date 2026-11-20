import { QueryTypes } from 'sequelize';
import { Module, Topic, TopicMastery, TopicPrerequisite, LearningRecommendation, sequelize } from '../models/index.js';
import { forbidden } from '../utils/AppError.js';
import { MASTERY, computeMastery, evidenceLabel, recommendationType } from '../utils/mastery.js';
import { getCourseAccess } from './accessService.js';

// Obtiene los temas del curso en el orden en que se estudian.
export async function orderedTopics(courseId, transaction) {
  return Topic.findAll({
    where: { courseId },
    include: [{ model: Module, as: 'module', attributes: ['position'] }],
    order: [[{ model: Module, as: 'module' }, 'position', 'ASC'], ['position', 'ASC'], ['id', 'ASC']],
    transaction,
  });
}

// Busca el siguiente tema cuyos prerrequisitos ya están dominados.
async function findNextTopic({ studentId, courseId, topicId, transaction }) {
  const topics = await orderedTopics(courseId, transaction);
  const index = topics.findIndex((topic) => topic.id === topicId);
  const next = index >= 0 ? topics[index + 1] : null;
  if (!next) return null;

  const prerequisites = await TopicPrerequisite.findAll({ where: { topicId: next.id }, transaction });
  const pending = prerequisites.map((row) => row.prerequisiteTopicId).filter((id) => id !== topicId);
  if (pending.length > 0) {
    const mastered = await TopicMastery.findAll({ where: { studentId, topicId: pending }, transaction });
    const ready = pending.every((id) => mastered.some((row) => row.topicId === id && Number(row.masteryScore) >= MASTERY.advanceAtOrAbove));
    if (!ready) return null;
  }
  return next;
}

// Redacta el motivo de la recomendación con la evidencia usada.
function buildReason(type, { correctCount, evidenceCount, score }, nextTopic) {
  const evidence = `Acertaste ${correctCount} de tus últimas ${evidenceCount} respuestas de este tema (dominio estimado ${Math.round(score * 100)} %).`;
  if (type === 'reinforce') return `${evidence} Conviene repasar las lecciones y volver a practicar.`;
  if (type === 'practice') return `${evidence} Vas bien; más práctica ayudará a consolidarlo.`;
  return nextTopic
    ? `${evidence} Puedes avanzar al tema "${nextTopic.title}".`
    : `${evidence} Dominas este tema; no hay un tema siguiente disponible por ahora.`;
}

// Recalcula el dominio de los temas afectados por un intento recién enviado.
export async function refreshMastery({ studentId, courseId, topicIds, transaction }) {
  const results = [];
  for (const topicId of [...new Set(topicIds)]) {
    const rows = await sequelize.query(
      `SELECT aa.is_correct AS isCorrect
         FROM attempt_answers aa
         JOIN assessment_attempts att ON att.id = aa.attempt_id
         JOIN questions q ON q.id = aa.question_id
        WHERE att.student_id = :studentId AND att.status = 'submitted' AND q.topic_id = :topicId
        ORDER BY att.submitted_at DESC, aa.id DESC
        LIMIT :limit`,
      { replacements: { studentId, topicId, limit: MASTERY.recentAnswersMax }, type: QueryTypes.SELECT, transaction },
    );
    const mastery = computeMastery(rows.map((row) => Boolean(row.isCorrect)));

    const [record] = await TopicMastery.findOrCreate({
      where: { studentId, topicId },
      defaults: { masteryScore: mastery.score, evidenceCount: mastery.evidenceCount, algorithmVersion: MASTERY.version },
      transaction,
    });
    await record.update({ masteryScore: mastery.score, evidenceCount: mastery.evidenceCount, algorithmVersion: MASTERY.version }, { transaction });

    const type = recommendationType(mastery.score, mastery.evidenceCount);
    const nextTopic = type === 'advance' ? await findNextTopic({ studentId, courseId, topicId, transaction }) : null;
    await LearningRecommendation.update({ status: 'replaced' }, { where: { studentId, topicId, status: 'active' }, transaction });
    await LearningRecommendation.create({
      studentId, courseId, topicId, nextTopicId: nextTopic?.id ?? null, type, reason: buildReason(type, mastery, nextTopic),
    }, { transaction });

    results.push({ topicId, masteryScore: mastery.score, evidenceCount: mastery.evidenceCount, label: evidenceLabel(mastery.evidenceCount), recommendation: type });
  }
  return results;
}

// Devuelve el dominio del estudiante en cada tema del curso.
export async function getMyMastery(user, courseId) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes consultan su dominio.');
  const { course } = await getCourseAccess(user, courseId);
  const topics = await orderedTopics(course.id);
  const mastery = await TopicMastery.findAll({ where: { studentId: user.id, topicId: topics.map((topic) => topic.id) } });
  const byTopic = new Map(mastery.map((row) => [row.topicId, row]));

  return topics.map((topic) => {
    const row = byTopic.get(topic.id);
    const evidenceCount = row?.evidenceCount ?? 0;
    return {
      topicId: topic.id,
      topicTitle: topic.title,
      masteryScore: row ? Number(row.masteryScore) : null,
      evidenceCount,
      label: evidenceLabel(evidenceCount),
      algorithmVersion: row?.algorithmVersion ?? MASTERY.version,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

// Devuelve las recomendaciones vigentes con su motivo.
export async function getMyRecommendations(user, courseId) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes consultan sus recomendaciones.');
  const { course } = await getCourseAccess(user, courseId);
  const rows = await LearningRecommendation.findAll({
    where: { studentId: user.id, courseId: course.id, status: 'active' },
    include: [{ model: Topic, as: 'topic', attributes: ['id', 'title'] }, { model: Topic, as: 'nextTopic', attributes: ['id', 'title'] }],
    order: [['updatedAt', 'DESC']],
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    reason: row.reason,
    topic: { id: row.topic.id, title: row.topic.title },
    nextTopic: row.nextTopic ? { id: row.nextTopic.id, title: row.nextTopic.title } : null,
    createdAt: row.createdAt,
  }));
}
