import {
  CourseStreak, DailyPractice, DailyPracticeAnswer, Enrollment, QuickQuiz, QuickQuizOption, QuickQuizQuestion, sequelize,
} from '../models/index.js';
import { conflict, forbidden, invalid } from '../utils/AppError.js';
import { addDays, clock, dayKey } from '../utils/clock.js';
import { getCourseAccess } from './accessService.js';
import { awardBonus } from './bonusService.js';

// Preguntas que hay que responder cada día para mantener la racha.
export const DAILY_QUESTIONS = 5;

// Racha vigente: si el último día cumplido fue antes de ayer, la racha ya se perdió.
export function streakView(streak, today = dayKey()) {
  const lastDay = streak?.lastDay ?? null;
  const yesterday = addDays(today, -1);
  const alive = lastDay === today || lastDay === yesterday;
  return {
    current: alive ? streak.currentDays : 0,
    best: streak?.bestDays ?? 0,
    completedToday: lastDay === today,
    // Ayer se cumplió y hoy todavía no: la racha se pierde si no se completa hoy.
    atRisk: lastDay === yesterday,
    lastDay,
  };
}

async function assertStudent(user, courseId, transaction) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes tienen racha.');
  return getCourseAccess(user, courseId, { transaction });
}

// Banco del curso: preguntas de los quizzes publicados.
async function pickQuestionIds(courseId, transaction) {
  const rows = await QuickQuizQuestion.findAll({
    attributes: ['id'],
    include: [{ model: QuickQuiz, as: 'quiz', attributes: [], where: { courseId, status: 'published' } }],
    order: sequelize.random(),
    limit: DAILY_QUESTIONS,
    transaction,
  });
  return rows.map((row) => row.id);
}

async function practiceQuestions(ids, transaction) {
  const questions = await QuickQuizQuestion.findAll({
    where: { id: ids },
    include: [{ model: QuickQuizOption, as: 'options' }],
    transaction,
  });
  // Conserva el orden con que se eligieron.
  return ids.map((questionId) => questions.find((question) => question.id === questionId)).filter(Boolean);
}

function practiceDto(practice, questions, answers, streak, today) {
  return {
    available: true,
    day: practice.practiceDay,
    required: questions.length,
    answeredCount: answers.length,
    completed: Boolean(practice.completedAt),
    questions: questions.map((question) => {
      const answer = answers.find((item) => item.questionId === question.id);
      return {
        id: question.id,
        prompt: question.prompt,
        options: [...question.options].sort((a, b) => a.position - b.position).map((option) => ({ id: option.id, body: option.body })),
        // La clave solo se muestra en preguntas ya respondidas.
        answer: answer ? {
          optionId: answer.optionId,
          isCorrect: answer.isCorrect,
          correctOptionId: question.options.find((option) => option.isCorrect)?.id ?? null,
        } : null,
      };
    }),
    streak: streakView(streak, today),
  };
}

// Abre (o retoma) la práctica de hoy con preguntas al azar del banco del curso.
export async function getTodayPractice(user, courseId) {
  return sequelize.transaction(async (transaction) => {
    const { course } = await assertStudent(user, courseId, transaction);
    const today = dayKey();
    const streak = await CourseStreak.findOne({ where: { courseId: course.id, studentId: user.id }, transaction });
    let practice = await DailyPractice.findOne({ where: { courseId: course.id, studentId: user.id, practiceDay: today }, transaction });

    if (!practice) {
      // Bloquea la matrícula para que dos pestañas no elijan preguntas distintas a la vez.
      await Enrollment.findOne({ where: { courseId: course.id, studentId: user.id }, lock: transaction.LOCK.UPDATE, transaction });
      practice = await DailyPractice.findOne({ where: { courseId: course.id, studentId: user.id, practiceDay: today }, transaction });
      if (!practice) {
        const ids = await pickQuestionIds(course.id, transaction);
        if (ids.length === 0) return { available: false, streak: streakView(streak, today) };
        practice = await DailyPractice.create({ courseId: course.id, studentId: user.id, practiceDay: today, questionIds: ids }, { transaction });
      }
    }

    const questions = await practiceQuestions(practice.questionIds, transaction);
    const answers = await DailyPracticeAnswer.findAll({ where: { practiceId: practice.id }, transaction });
    return practiceDto(practice, questions, answers, streak, today);
  });
}

// Suma un día a la racha (o la reinicia si hubo un día sin práctica).
async function extendStreak(courseId, studentId, today, transaction) {
  await CourseStreak.findOrCreate({ where: { courseId, studentId }, defaults: { currentDays: 0, bestDays: 0 }, transaction });
  const streak = await CourseStreak.findOne({ where: { courseId, studentId }, lock: transaction.LOCK.UPDATE, transaction });
  if (streak.lastDay === today) return streak;
  const currentDays = streak.lastDay === addDays(today, -1) ? streak.currentDays + 1 : 1;
  await streak.update({ currentDays, bestDays: Math.max(streak.bestDays, currentDays), lastDay: today }, { transaction });
  return streak;
}

// Responde una pregunta de la práctica de hoy; al completar todas, la racha avanza y se gana el bono del día.
export async function answerDaily(user, courseId, { questionId, optionId }) {
  return sequelize.transaction(async (transaction) => {
    const { course } = await assertStudent(user, courseId, transaction);
    const today = dayKey();
    const practice = await DailyPractice.findOne({
      where: { courseId: course.id, studentId: user.id, practiceDay: today },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!practice) throw conflict('PRACTICE_NOT_STARTED', 'Abre la práctica de hoy antes de responder.');
    if (!practice.questionIds.includes(questionId)) throw invalid('La pregunta no es parte de la práctica de hoy.');
    if (await DailyPracticeAnswer.findOne({ where: { practiceId: practice.id, questionId }, transaction })) {
      throw conflict('ALREADY_ANSWERED', 'Esta pregunta ya fue respondida hoy.');
    }

    const questions = await practiceQuestions(practice.questionIds, transaction);
    const question = questions.find((item) => item.id === questionId);
    const option = question.options.find((item) => item.id === optionId);
    if (!option) throw invalid('La opción elegida no pertenece a la pregunta.');

    await DailyPracticeAnswer.create({ practiceId: practice.id, questionId, optionId, isCorrect: option.isCorrect }, { transaction });
    const answeredCount = practice.answeredCount + 1;
    await practice.update({ answeredCount }, { transaction });

    let streak = await CourseStreak.findOne({ where: { courseId: course.id, studentId: user.id }, transaction });
    let bonus = { awarded: false, amount: 0 };
    const completed = answeredCount >= questions.length;
    if (completed && !practice.completedAt) {
      await practice.update({ completedAt: clock.now() }, { transaction });
      streak = await extendStreak(course.id, user.id, today, transaction);
      bonus = await awardBonus({ courseId: course.id, studentId: user.id, kind: 'streak_day', reference: today, transaction });
    }

    return {
      isCorrect: option.isCorrect,
      correctOptionId: question.options.find((item) => item.isCorrect).id,
      answeredCount,
      required: questions.length,
      completed,
      bonus,
      streak: streakView(streak, today),
    };
  });
}

// Racha de cada estudiante (para la vista del docente).
export async function streaksFor(courseId, studentIds) {
  const today = dayKey();
  const rows = studentIds.length ? await CourseStreak.findAll({ where: { courseId, studentId: studentIds } }) : [];
  return new Map(studentIds.map((studentId) => [studentId, streakView(rows.find((row) => row.studentId === studentId), today)]));
}
