import {
  Assessment, Question, QuestionOption, AssessmentAttempt, AttemptAnswer, Topic, Enrollment, sequelize,
} from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import { refreshMastery } from './masteryService.js';
import { recordAssessmentReviews } from './reviewService.js';

const assessmentDto = (assessment) => ({
  id: assessment.id,
  courseId: assessment.courseId,
  topicId: assessment.topicId,
  title: assessment.title,
  status: assessment.status,
  passingScore: assessment.passingScore,
  maxAttempts: assessment.maxAttempts,
});

// Arma la pregunta; la clave solo se incluye para quien puede editar.
const questionDto = (question, withKey) => ({
  id: question.id,
  topicId: question.topicId,
  stem: question.stem,
  points: question.points,
  position: question.position,
  ...(withKey ? { explanation: question.explanation } : {}),
  options: [...question.options].sort((a, b) => a.position - b.position).map((option) => ({
    id: option.id,
    body: option.body,
    ...(withKey ? { isCorrect: option.isCorrect } : {}),
  })),
});

async function loadAssessment(user, assessmentId, { write = false, transaction } = {}) {
  const assessment = assessmentId ? await Assessment.findByPk(assessmentId, { transaction }) : null;
  if (!assessment) throw notFound('Evaluación no encontrada.');
  const access = await getCourseAccess(user, assessment.courseId, { write, transaction });
  if (!access.canEdit && assessment.status === 'draft') throw notFound('Evaluación no encontrada.');
  return { assessment, ...access };
}

async function assertTopicInCourse(topicId, courseId) {
  const topic = await Topic.findOne({ where: { id: topicId, courseId } });
  if (!topic) throw invalid('El tema indicado no pertenece a este curso.');
}

// Crea una evaluación en borrador.
export async function createAssessment(user, courseId, { title, topicId, passingScore, maxAttempts }) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  await assertTopicInCourse(topicId, course.id);
  const assessment = await Assessment.create({ courseId: course.id, topicId, title, passingScore, maxAttempts });
  return assessmentDto(assessment);
}

// Lista las evaluaciones del curso con datos reales de uso.
export async function listAssessments(user, courseId) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const where = { courseId: course.id, ...(canEdit ? {} : { status: ['published', 'closed'] }) };
  const assessments = await Assessment.findAll({
    where,
    include: [{ model: Topic, as: 'topic', attributes: ['id', 'title'] }, { model: Question, as: 'questions', attributes: ['id'] }],
    order: [['id', 'ASC']],
  });

  const myAttempts = user.role === 'student'
    ? await AssessmentAttempt.findAll({ where: { studentId: user.id, assessmentId: assessments.map((a) => a.id) }, order: [['id', 'ASC']] })
    : [];

  return assessments.map((assessment) => {
    const attempts = myAttempts.filter((attempt) => attempt.assessmentId === assessment.id);
    const submitted = attempts.filter((attempt) => attempt.status === 'submitted');
    return {
      ...assessmentDto(assessment),
      topicTitle: assessment.topic.title,
      questionCount: assessment.questions.length,
      ...(user.role === 'student' ? {
        attemptsUsed: submitted.length,
        bestScorePct: submitted.length ? Math.max(...submitted.map((attempt) => Number(attempt.scorePct))) : null,
        lastAttemptId: submitted.length ? submitted[submitted.length - 1].id : null,
      } : {}),
    };
  });
}

// Devuelve la evaluación; el estudiante nunca recibe la clave de respuestas.
export async function getAssessment(user, assessmentId) {
  const { assessment, canEdit } = await loadAssessment(user, assessmentId);
  const questions = await Question.findAll({
    where: { assessmentId: assessment.id },
    include: [{ model: QuestionOption, as: 'options' }],
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  const data = { ...assessmentDto(assessment), canEdit, questions: questions.map((question) => questionDto(question, canEdit)) };

  if (user.role === 'student') {
    const attempts = await AssessmentAttempt.findAll({ where: { assessmentId: assessment.id, studentId: user.id } });
    data.attemptsUsed = attempts.filter((attempt) => attempt.status === 'submitted').length;
    data.inProgressAttemptId = attempts.find((attempt) => attempt.status === 'in_progress')?.id ?? null;
  }
  return data;
}

// Agrega una pregunta mientras la evaluación está en borrador.
export async function addQuestion(user, assessmentId, { stem, explanation, points, topicId, options }) {
  const { assessment } = await loadAssessment(user, assessmentId, { write: true });
  if (assessment.status !== 'draft') throw conflict('ASSESSMENT_LOCKED', 'Una evaluación publicada no se puede modificar.');
  const finalTopicId = topicId || assessment.topicId;
  await assertTopicInCourse(finalTopicId, assessment.courseId);

  return sequelize.transaction(async (transaction) => {
    const position = ((await Question.max('position', { where: { assessmentId: assessment.id }, transaction })) || 0) + 1;
    const question = await Question.create({
      assessmentId: assessment.id, topicId: finalTopicId, stem, explanation: explanation || null, points, position,
    }, { transaction });
    const created = await QuestionOption.bulkCreate(
      options.map((option, index) => ({ questionId: question.id, body: option.body, isCorrect: option.isCorrect, position: index + 1 })),
      { transaction },
    );
    question.options = created;
    return questionDto(question, true);
  });
}

// Elimina una pregunta de una evaluación en borrador.
export async function deleteQuestion(user, questionId) {
  const question = questionId ? await Question.findByPk(questionId) : null;
  if (!question) throw notFound('Pregunta no encontrada.');
  const { assessment } = await loadAssessment(user, question.assessmentId, { write: true });
  if (assessment.status !== 'draft') throw conflict('ASSESSMENT_LOCKED', 'Una evaluación publicada no se puede modificar.');
  await question.destroy();
}

// Publica o cierra la evaluación.
export async function changeStatus(user, assessmentId, status) {
  const { assessment } = await loadAssessment(user, assessmentId, { write: true });
  if (status === 'published') {
    if (assessment.status !== 'draft') throw conflict('INVALID_STATUS', 'Solo se publica una evaluación en borrador.');
    const count = await Question.count({ where: { assessmentId: assessment.id } });
    if (count === 0) throw invalid('Agrega al menos una pregunta antes de publicar.');
  }
  if (status === 'closed' && assessment.status !== 'published') {
    throw conflict('INVALID_STATUS', 'Solo se cierra una evaluación publicada.');
  }
  await sequelize.transaction(async (transaction) => {
    // El bloqueo espera a que termine cualquier entrega que se esté calificando.
    await Assessment.findByPk(assessment.id, { lock: transaction.LOCK.UPDATE, transaction });
    await assessment.update({ status }, { transaction });
    await recordAudit({ actor: user, action: `assessment.${status}`, resourceType: 'assessment', resourceId: assessment.id, transaction });
  });
  return assessmentDto(assessment);
}

// Inicia un intento o devuelve el que ya estaba en curso.
export async function startAttempt(user, assessmentId) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes resuelven evaluaciones.');
  return sequelize.transaction(async (transaction) => {
    const { assessment } = await loadAssessment(user, assessmentId, { transaction });
    if (assessment.status !== 'published') throw conflict('ASSESSMENT_CLOSED', 'La evaluación no está disponible.');

    // Bloquea la matrícula para que dos solicitudes simultáneas no creen dos intentos.
    await Enrollment.findOne({ where: { courseId: assessment.courseId, studentId: user.id }, lock: transaction.LOCK.UPDATE, transaction });
    const attempts = await AssessmentAttempt.findAll({ where: { assessmentId: assessment.id, studentId: user.id }, transaction });
    const inProgress = attempts.find((attempt) => attempt.status === 'in_progress');
    if (inProgress) return { attemptId: inProgress.id, status: inProgress.status, resumed: true };
    if (attempts.length >= assessment.maxAttempts) {
      throw conflict('ATTEMPTS_EXHAUSTED', 'Ya usaste todos los intentos permitidos.');
    }
    const attempt = await AssessmentAttempt.create({ assessmentId: assessment.id, studentId: user.id }, { transaction });
    return { attemptId: attempt.id, status: attempt.status, resumed: false };
  });
}

// Califica el intento de forma determinista dentro de una transacción.
export async function submitAttempt(user, attemptId, answers) {
  return sequelize.transaction(async (transaction) => {
    const attempt = attemptId
      ? await AssessmentAttempt.findOne({ where: { id: attemptId, studentId: user.id }, lock: transaction.LOCK.UPDATE, transaction })
      : null;
    if (!attempt) throw notFound('Intento no encontrado.');
    if (attempt.status === 'submitted') throw conflict('ALREADY_SUBMITTED', 'Este intento ya fue enviado.');
    // Bloquea la evaluación para que el cierre y la entrega no se crucen.
    const { assessment } = await loadAssessment(user, attempt.assessmentId, { transaction });
    await Assessment.findByPk(assessment.id, { lock: transaction.LOCK.UPDATE, transaction });
    await assessment.reload({ transaction });
    // La regla de cierre también aplica a un intento que quedó pendiente.
    if (assessment.status !== 'published') {
      throw conflict('ASSESSMENT_CLOSED', 'La evaluación ya está cerrada; este intento no se puede entregar.');
    }

    const questions = await Question.findAll({
      where: { assessmentId: assessment.id },
      include: [{ model: QuestionOption, as: 'options' }],
      transaction,
    });
    const byQuestion = new Map();
    for (const answer of answers) {
      const question = questions.find((item) => item.id === answer.questionId);
      if (!question) throw invalid('Una respuesta no corresponde a esta evaluación.');
      if (byQuestion.has(question.id)) throw invalid('Hay más de una respuesta para la misma pregunta.');
      const option = question.options.find((item) => item.id === answer.selectedOptionId);
      if (!option) throw invalid('Una opción elegida no pertenece a su pregunta.');
      byQuestion.set(question.id, option);
    }

    let earnedPoints = 0;
    let totalPoints = 0;
    const rows = questions.map((question) => {
      const option = byQuestion.get(question.id) || null;
      const isCorrect = Boolean(option?.isCorrect);
      totalPoints += question.points;
      if (isCorrect) earnedPoints += question.points;
      return { attemptId: attempt.id, questionId: question.id, selectedOptionId: option?.id ?? null, isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    });
    await AttemptAnswer.bulkCreate(rows, { transaction });

    const scorePct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0;
    await attempt.update({ status: 'submitted', scorePct, earnedPoints, totalPoints, submittedAt: new Date() }, { transaction });

    const mastery = await refreshMastery({
      studentId: user.id, courseId: assessment.courseId, topicIds: questions.map((question) => question.topicId), transaction,
    });
    // Las mismas respuestas objetivas programan el próximo repaso de cada tema.
    await recordAssessmentReviews({
      studentId: user.id,
      courseId: assessment.courseId,
      answers: rows.map((row) => ({ topicId: questions.find((question) => question.id === row.questionId).topicId, isCorrect: row.isCorrect })),
      transaction,
    });
    await recordAudit({ actor: user, action: 'attempt.submitted', resourceType: 'attempt', resourceId: attempt.id, metadata: { assessmentId: assessment.id }, transaction });

    return { attemptId: attempt.id, scorePct, earnedPoints, totalPoints, passed: scorePct >= assessment.passingScore, mastery };
  });
}

// Muestra el resultado al propietario o al docente del curso.
export async function getAttemptResult(user, attemptId) {
  const attempt = attemptId ? await AssessmentAttempt.findByPk(attemptId, { include: [{ model: AttemptAnswer, as: 'answers' }] }) : null;
  if (!attempt) throw notFound('Intento no encontrado.');
  const { assessment, canEdit } = await loadAssessment(user, attempt.assessmentId);
  if (!canEdit && attempt.studentId !== user.id) throw notFound('Intento no encontrado.');
  if (attempt.status !== 'submitted') throw conflict('NOT_SUBMITTED', 'El intento aún no se ha enviado.');

  const questions = await Question.findAll({
    where: { assessmentId: assessment.id },
    include: [{ model: QuestionOption, as: 'options' }],
    order: [['position', 'ASC'], ['id', 'ASC']],
  });

  // La clave se revela al estudiante solo cuando ya no puede volver a intentarlo.
  const used = await AssessmentAttempt.count({ where: { assessmentId: assessment.id, studentId: attempt.studentId, status: 'submitted' } });
  const revealKey = canEdit || assessment.status === 'closed' || used >= assessment.maxAttempts;

  return {
    attemptId: attempt.id,
    keyRevealed: revealKey,
    assessment: assessmentDto(assessment),
    studentId: attempt.studentId,
    scorePct: Number(attempt.scorePct),
    earnedPoints: attempt.earnedPoints,
    totalPoints: attempt.totalPoints,
    passed: Number(attempt.scorePct) >= assessment.passingScore,
    submittedAt: attempt.submittedAt,
    questions: questions.map((question) => {
      const answer = attempt.answers.find((item) => item.questionId === question.id);
      return {
        ...questionDto(question, revealKey),
        selectedOptionId: answer?.selectedOptionId ?? null,
        isCorrect: Boolean(answer?.isCorrect),
        earnedPoints: answer?.earnedPoints ?? 0,
      };
    }),
  };
}

// Lista los intentos enviados por el estudiante en un curso.
export async function listMyAttempts(user, courseId) {
  if (user.role !== 'student') throw forbidden();
  const { course } = await getCourseAccess(user, courseId);
  const attempts = await AssessmentAttempt.findAll({
    where: { studentId: user.id, status: 'submitted' },
    include: [{ model: Assessment, as: 'assessment', where: { courseId: course.id }, attributes: ['id', 'title', 'passingScore'] }],
    order: [['submittedAt', 'DESC']],
  });
  return attempts.map((attempt) => ({
    attemptId: attempt.id,
    assessmentId: attempt.assessment.id,
    assessmentTitle: attempt.assessment.title,
    scorePct: Number(attempt.scorePct),
    passed: Number(attempt.scorePct) >= attempt.assessment.passingScore,
    submittedAt: attempt.submittedAt,
  }));
}
