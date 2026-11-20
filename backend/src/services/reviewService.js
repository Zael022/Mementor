import { Topic, TopicReview, TopicReviewLog, sequelize } from '../models/index.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';
import { clock } from '../utils/clock.js';
import { FSRS, gradeFromAnswers, retrievability, scheduleReview } from '../utils/spacedRepetition.js';
import { getCourseAccess } from './accessService.js';
import { orderedTopics } from './masteryService.js';

const DAY_MS = 24 * 3600 * 1000;

// Aplica una nota al tema y deja constancia en el historial.
async function applyGrade({ studentId, courseId, topicId, grade, source, now, transaction }) {
  const existing = await TopicReview.findOne({ where: { studentId, topicId }, lock: transaction.LOCK.UPDATE, transaction });
  const next = scheduleReview(existing, grade, now);
  const values = {
    stability: next.stability,
    difficulty: next.difficulty,
    dueAt: next.dueAt,
    lastReviewedAt: next.lastReviewedAt,
    reps: next.reps,
    lapses: next.lapses,
    lastGrade: grade,
    algorithmVersion: FSRS.version,
  };
  const review = existing
    ? await existing.update(values, { transaction })
    : await TopicReview.create({ studentId, courseId, topicId, ...values }, { transaction });
  await TopicReviewLog.create({
    reviewId: review.id, grade, source, elapsedDays: next.elapsedDays, scheduledDays: next.scheduledDays, reviewedAt: now,
  }, { transaction });
  return { review, scheduledDays: next.scheduledDays };
}

// Programa el repaso de cada tema evaluado con las respuestas objetivas del intento (misma transacción del envío).
export async function recordAssessmentReviews({ studentId, courseId, answers, transaction }) {
  const byTopic = new Map();
  for (const { topicId, isCorrect } of answers) {
    const counts = byTopic.get(topicId) || { correct: 0, total: 0 };
    counts.total += 1;
    if (isCorrect) counts.correct += 1;
    byTopic.set(topicId, counts);
  }
  const now = clock.now();
  for (const [topicId, { correct, total }] of byTopic) {
    const grade = gradeFromAnswers(correct, total);
    if (grade) await applyGrade({ studentId, courseId, topicId, grade, source: 'assessment', now, transaction });
  }
}

function reviewDto(topic, review, now) {
  if (!review) return { topicId: topic.id, topicTitle: topic.title, status: 'new', dueAt: null, recallPct: null, reps: 0, lapses: 0 };
  const elapsedDays = (now.getTime() - new Date(review.lastReviewedAt).getTime()) / DAY_MS;
  const due = new Date(review.dueAt).getTime() <= now.getTime();
  return {
    topicId: topic.id,
    topicTitle: topic.title,
    status: due ? 'due' : 'scheduled',
    dueAt: review.dueAt,
    lastReviewedAt: review.lastReviewedAt,
    // Estimación del modelo, no una medida del conocimiento.
    recallPct: Math.round(retrievability(elapsedDays, Number(review.stability)) * 100),
    stabilityDays: Number(review.stability),
    reps: review.reps,
    lapses: review.lapses,
    algorithmVersion: review.algorithmVersion,
  };
}

// Lista los temas del curso con su estado de repaso: primero los que tocan hoy.
export async function listMyReviews(user, courseId) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes tienen repasos.');
  const { course } = await getCourseAccess(user, courseId);
  const topics = await orderedTopics(course.id);
  const reviews = await TopicReview.findAll({ where: { studentId: user.id, courseId: course.id } });
  const byTopic = new Map(reviews.map((row) => [row.topicId, row]));
  const now = clock.now();
  const rank = { due: 0, scheduled: 1, new: 2 };
  return topics
    .map((topic, index) => ({ ...reviewDto(topic, byTopic.get(topic.id), now), order: index }))
    .sort((a, b) => rank[a.status] - rank[b.status]
      || (a.dueAt && b.dueAt ? new Date(a.dueAt) - new Date(b.dueAt) : 0)
      || a.order - b.order)
    .map((item) => {
      // El orden solo sirve para desempatar; no se envía.
      const rest = { ...item };
      delete rest.order;
      return rest;
    });
}

// Autoevaluación tras repasar: solo cuando el repaso ya toca o el tema aún no tiene historial.
export async function submitSelfReview(user, topicId, grade) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes registran repasos.');
  const topic = topicId ? await Topic.findByPk(topicId) : null;
  if (!topic) throw notFound('Tema no encontrado.');
  const { course } = await getCourseAccess(user, topic.courseId);
  return sequelize.transaction(async (transaction) => {
    const now = clock.now();
    const existing = await TopicReview.findOne({ where: { studentId: user.id, topicId: topic.id }, lock: transaction.LOCK.UPDATE, transaction });
    if (existing && new Date(existing.dueAt).getTime() > now.getTime()) {
      throw conflict('REVIEW_NOT_DUE', 'Este tema todavía no toca repasarlo.');
    }
    const { review, scheduledDays } = await applyGrade({
      studentId: user.id, courseId: course.id, topicId: topic.id, grade, source: 'self', now, transaction,
    });
    return { ...reviewDto(topic, review, now), scheduledDays };
  });
}

// Fechas de repaso de los temas de un curso (las usa el planificador).
export async function reviewDueDates(studentId, courseId) {
  const rows = await TopicReview.findAll({ where: { studentId, courseId }, attributes: ['topicId', 'dueAt'] });
  return new Map(rows.map((row) => [row.topicId, row.dueAt]));
}
