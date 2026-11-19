import { Op } from 'sequelize';
import {
  Enrollment, QuickQuiz, QuickQuizOption, QuickQuizQuestion, QuizPlay, QuizPlayAnswer, User, sequelize,
} from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { clock } from '../utils/clock.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import { awardBonus } from './bonusService.js';

// Margen para la latencia de red al medir si una respuesta llegó a tiempo.
const GRACE_MS = 1500;
const MAX_POINTS = 1000;

const quizDto = (quiz) => ({
  id: quiz.id,
  courseId: quiz.courseId,
  title: quiz.title,
  status: quiz.status,
  secondsPerQuestion: quiz.secondsPerQuestion,
});

// Pregunta para el docente (con clave) o para el juego (sin clave).
const questionDto = (question, withKey) => ({
  id: question.id,
  prompt: question.prompt,
  position: question.position,
  options: [...question.options].sort((a, b) => a.position - b.position).map((option) => ({
    id: option.id,
    body: option.body,
    ...(withKey ? { isCorrect: option.isCorrect } : {}),
  })),
});

// Puntos al estilo de los juegos de preguntas: 1000 si es inmediata, mínimo 500 si es correcta al final.
export function pointsFor(elapsedMs, limitMs) {
  const ratio = Math.min(1, Math.max(0, elapsedMs / limitMs));
  return Math.round(MAX_POINTS * (1 - ratio / 2));
}

async function loadQuiz(user, quizId, { write = false, transaction } = {}) {
  const quiz = quizId ? await QuickQuiz.findByPk(quizId, { transaction }) : null;
  if (!quiz) throw notFound('Quiz no encontrado.');
  const access = await getCourseAccess(user, quiz.courseId, { write, transaction });
  if (!access.canEdit && quiz.status !== 'published') throw notFound('Quiz no encontrado.');
  return { quiz, ...access };
}

function assertDraft(quiz) {
  if (quiz.status !== 'draft') throw conflict('QUIZ_LOCKED', 'Un quiz publicado no se puede modificar; archívalo y crea otro.');
}

// Crea un quiz en borrador.
export async function createQuiz(user, courseId, { title, secondsPerQuestion }) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const quiz = await QuickQuiz.create({ courseId: course.id, title, secondsPerQuestion, createdBy: user.id });
  return quizDto(quiz);
}

// Lista los quizzes; el estudiante ve solo los publicados con su mejor puntaje.
export async function listQuizzes(user, courseId) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const quizzes = await QuickQuiz.findAll({
    where: { courseId: course.id, status: canEdit ? ['draft', 'published', 'archived'] : 'published' },
    include: [{ model: QuickQuizQuestion, as: 'questions', attributes: ['id'] }],
    order: [['id', 'DESC']],
  });
  const plays = !canEdit && quizzes.length
    ? await QuizPlay.findAll({ where: { studentId: user.id, quizId: quizzes.map((quiz) => quiz.id), status: 'finished' } })
    : [];
  return quizzes.map((quiz) => {
    const mine = plays.filter((play) => play.quizId === quiz.id);
    return {
      ...quizDto(quiz),
      questionCount: quiz.questions.length,
      ...(canEdit ? {} : {
        playsCount: mine.length,
        bestScore: mine.length ? Math.max(...mine.map((play) => play.score)) : null,
        perfect: mine.some((play) => play.perfect),
      }),
    };
  });
}

// Detalle para el docente, con la clave de respuestas.
export async function getQuizForEdit(user, quizId) {
  const { quiz } = await loadQuiz(user, quizId, { write: true });
  const questions = await QuickQuizQuestion.findAll({
    where: { quizId: quiz.id },
    include: [{ model: QuickQuizOption, as: 'options' }],
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  return { ...quizDto(quiz), questions: questions.map((question) => questionDto(question, true)) };
}

// Cambia título o tiempo mientras está en borrador.
export async function updateQuiz(user, quizId, changes) {
  const { quiz } = await loadQuiz(user, quizId, { write: true });
  assertDraft(quiz);
  await quiz.update(changes);
  return quizDto(quiz);
}

// Agrega una pregunta con sus opciones en una sola transacción.
export async function addQuestion(user, quizId, { prompt, options }) {
  const { quiz } = await loadQuiz(user, quizId, { write: true });
  assertDraft(quiz);
  if (options.filter((option) => option.isCorrect).length !== 1) throw invalid('Marca exactamente una opción correcta.');
  return sequelize.transaction(async (transaction) => {
    const position = ((await QuickQuizQuestion.max('position', { where: { quizId: quiz.id }, transaction })) || 0) + 1;
    const question = await QuickQuizQuestion.create({ quizId: quiz.id, prompt, position }, { transaction });
    question.options = await QuickQuizOption.bulkCreate(
      options.map((option, index) => ({ questionId: question.id, body: option.body, isCorrect: option.isCorrect, position: index + 1 })),
      { transaction },
    );
    return questionDto(question, true);
  });
}

// Elimina una pregunta de un quiz en borrador.
export async function deleteQuestion(user, questionId) {
  const question = questionId ? await QuickQuizQuestion.findByPk(questionId) : null;
  if (!question) throw notFound('Pregunta no encontrada.');
  const { quiz } = await loadQuiz(user, question.quizId, { write: true });
  assertDraft(quiz);
  await question.destroy();
}

// Publica o archiva; un quiz archivado deja de aparecer y sus preguntas salen del banco diario.
export async function changeStatus(user, quizId, status) {
  const { quiz } = await loadQuiz(user, quizId, { write: true });
  if (status === 'published') {
    assertDraft(quiz);
    if (await QuickQuizQuestion.count({ where: { quizId: quiz.id } }) === 0) throw invalid('Agrega al menos una pregunta antes de publicar.');
  }
  if (status === 'archived' && quiz.status !== 'published') throw conflict('INVALID_STATUS', 'Solo se archiva un quiz publicado.');
  await sequelize.transaction(async (transaction) => {
    await quiz.update({ status }, { transaction });
    await recordAudit({ actor: user, action: `quick_quiz.${status}`, resourceType: 'quick_quiz', resourceId: quiz.id, transaction });
  });
  return quizDto(quiz);
}

// Borra un quiz en borrador (aún no tiene partidas).
export async function deleteQuiz(user, quizId) {
  const { quiz } = await loadQuiz(user, quizId, { write: true });
  assertDraft(quiz);
  await quiz.destroy();
}

// --- Juego ---

async function loadPlay(user, playId, transaction) {
  const play = playId
    ? await QuizPlay.findOne({ where: { id: playId, studentId: user.id }, lock: transaction.LOCK.UPDATE, transaction })
    : null;
  if (!play) throw notFound('Partida no encontrada.');
  const { quiz } = await loadQuiz(user, play.quizId, { transaction });
  return { play, quiz };
}

async function playQuestions(quizId, transaction) {
  return QuickQuizQuestion.findAll({
    where: { quizId },
    include: [{ model: QuickQuizOption, as: 'options' }],
    order: [['position', 'ASC'], ['id', 'ASC']],
    transaction,
  });
}

// Cierra la partida; si todas fueron correctas, entrega el bono una sola vez por quiz.
async function finishPlay(play, quiz, transaction) {
  const perfect = play.correctCount === play.totalQuestions;
  await play.update({ status: 'finished', perfect, finishedAt: clock.now() }, { transaction });
  const bonus = perfect
    ? await awardBonus({ courseId: quiz.courseId, studentId: play.studentId, kind: 'quiz', reference: quiz.id, transaction })
    : { awarded: false, amount: 0 };
  return { finished: true, perfect, score: play.score, correctCount: play.correctCount, totalQuestions: play.totalQuestions, bonus };
}

// Marca como fuera de tiempo una pregunta mostrada que nadie respondió.
async function expire(answer, limitMs, transaction) {
  await answer.update({ answeredAt: new Date(answer.shownAt.getTime() + limitMs), isCorrect: false, points: 0 }, { transaction });
}

// Inicia una partida nueva; una partida anterior sin terminar se cierra tal como quedó.
export async function startPlay(user, quizId) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes juegan los quizzes.');
  return sequelize.transaction(async (transaction) => {
    const { quiz } = await loadQuiz(user, quizId, { transaction });
    // Bloquea la matrícula para que dos clics seguidos no creen dos partidas.
    await Enrollment.findOne({ where: { courseId: quiz.courseId, studentId: user.id }, lock: transaction.LOCK.UPDATE, transaction });
    await QuizPlay.update(
      { status: 'finished', finishedAt: clock.now() },
      { where: { quizId: quiz.id, studentId: user.id, status: 'in_progress' }, transaction },
    );
    const total = await QuickQuizQuestion.count({ where: { quizId: quiz.id }, transaction });
    const play = await QuizPlay.create({ quizId: quiz.id, studentId: user.id, totalQuestions: total }, { transaction });
    return { playId: play.id, quiz: quizDto(quiz), totalQuestions: total };
  });
}

// Entrega la pregunta actual; si se recarga la página, el tiempo sigue corriendo desde que se mostró.
export async function nextQuestion(user, playId) {
  return sequelize.transaction(async (transaction) => {
    const { play, quiz } = await loadPlay(user, playId, transaction);
    if (play.status === 'finished') throw conflict('PLAY_FINISHED', 'Esta partida ya terminó.');
    const limitMs = quiz.secondsPerQuestion * 1000;
    const questions = await playQuestions(quiz.id, transaction);
    const answers = await QuizPlayAnswer.findAll({ where: { playId: play.id }, transaction });
    const now = clock.now();

    const pending = answers.find((answer) => !answer.answeredAt);
    if (pending) {
      const elapsed = now - pending.shownAt;
      if (elapsed <= limitMs + GRACE_MS) {
        const question = questions.find((item) => item.id === pending.questionId);
        return {
          finished: false,
          index: questions.indexOf(question) + 1,
          total: questions.length,
          secondsLeft: Math.max(0, Math.ceil((limitMs - elapsed) / 1000)),
          secondsPerQuestion: quiz.secondsPerQuestion,
          question: questionDto(question, false),
        };
      }
      await expire(pending, limitMs, transaction);
    }

    const seen = new Set(answers.map((answer) => answer.questionId));
    const question = questions.find((item) => !seen.has(item.id));
    if (!question) return finishPlay(play, quiz, transaction);
    await QuizPlayAnswer.create({ playId: play.id, questionId: question.id, shownAt: now }, { transaction });
    return {
      finished: false,
      index: questions.indexOf(question) + 1,
      total: questions.length,
      secondsLeft: quiz.secondsPerQuestion,
      secondsPerQuestion: quiz.secondsPerQuestion,
      question: questionDto(question, false),
    };
  });
}

// Corrige la respuesta con el tiempo medido por el servidor y revela la opción correcta.
export async function answerQuestion(user, playId, { questionId, optionId }) {
  return sequelize.transaction(async (transaction) => {
    const { play, quiz } = await loadPlay(user, playId, transaction);
    if (play.status === 'finished') throw conflict('PLAY_FINISHED', 'Esta partida ya terminó.');
    const answer = await QuizPlayAnswer.findOne({ where: { playId: play.id, questionId }, transaction });
    if (!answer) throw invalid('Esa pregunta todavía no se ha mostrado en esta partida.');
    if (answer.answeredAt) throw conflict('ALREADY_ANSWERED', 'Esta pregunta ya fue respondida.');

    const question = (await playQuestions(quiz.id, transaction)).find((item) => item.id === questionId);
    const option = optionId ? question.options.find((item) => item.id === optionId) : null;
    if (optionId && !option) throw invalid('La opción elegida no pertenece a la pregunta.');

    const limitMs = quiz.secondsPerQuestion * 1000;
    const now = clock.now();
    const elapsed = now - answer.shownAt;
    const timedOut = !option || elapsed > limitMs + GRACE_MS;
    const isCorrect = !timedOut && option.isCorrect;
    const points = isCorrect ? pointsFor(elapsed, limitMs) : 0;
    await answer.update({ optionId: option?.id ?? null, answeredAt: now, isCorrect, points }, { transaction });
    await play.update({ score: play.score + points, correctCount: play.correctCount + (isCorrect ? 1 : 0) }, { transaction });

    const answered = await QuizPlayAnswer.count({ where: { playId: play.id, answeredAt: { [Op.ne]: null } }, transaction });
    const result = {
      isCorrect,
      timedOut,
      points,
      score: play.score,
      correctOptionId: question.options.find((item) => item.isCorrect).id,
      isLast: answered >= play.totalQuestions,
    };
    if (result.isLast) result.summary = await finishPlay(play, quiz, transaction);
    return result;
  });
}

// Resultado final con la tabla de posiciones del quiz (mejor puntaje de cada estudiante).
export async function getPlayResult(user, playId) {
  const play = playId ? await QuizPlay.findByPk(playId) : null;
  if (!play) throw notFound('Partida no encontrada.');
  const { quiz, canEdit } = await loadQuiz(user, play.quizId);
  if (!canEdit && play.studentId !== user.id) throw notFound('Partida no encontrada.');
  if (play.status !== 'finished') throw conflict('PLAY_IN_PROGRESS', 'La partida aún no termina.');
  return {
    playId: play.id,
    quiz: quizDto(quiz),
    score: play.score,
    correctCount: play.correctCount,
    totalQuestions: play.totalQuestions,
    perfect: play.perfect,
    leaderboard: await leaderboard(quiz.id, user.id),
  };
}

// Las 10 mejores marcas del quiz, mostrando solo el nombre visible de cada estudiante.
export async function leaderboard(quizId, viewerId) {
  const rows = await QuizPlay.findAll({
    where: { quizId, status: 'finished' },
    attributes: ['studentId', [sequelize.fn('MAX', sequelize.col('score')), 'best']],
    group: ['studentId'],
    order: [[sequelize.literal('best'), 'DESC']],
    limit: 10,
    raw: true,
  });
  const users = rows.length ? await User.findAll({ where: { id: rows.map((row) => row.studentId) }, attributes: ['id', 'displayName'] }) : [];
  return rows.map((row, index) => ({
    position: index + 1,
    displayName: users.find((item) => item.id === row.studentId)?.displayName ?? 'Estudiante',
    score: Number(row.best),
    isMe: row.studentId === viewerId,
  }));
}
