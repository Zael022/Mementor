import { CourseGradePolicy, GradeBonusEvent } from '../models/index.js';

// Valores por defecto mientras el docente no guarde su propia configuración.
export const DEFAULT_POLICY = Object.freeze({
  assessmentsWeight: 40,
  assignmentsWeight: 30,
  classworkWeight: 30,
  quizBonus: 0.1,
  streakDayBonus: 0.09,
  bonusCap: 1,
});

// Lee la política del curso con los decimales ya convertidos a número.
export async function readPolicy(courseId, { transaction } = {}) {
  const row = await CourseGradePolicy.findByPk(courseId, { transaction });
  if (!row) return { ...DEFAULT_POLICY, saved: false };
  return {
    assessmentsWeight: row.assessmentsWeight,
    assignmentsWeight: row.assignmentsWeight,
    classworkWeight: row.classworkWeight,
    quizBonus: Number(row.quizBonus),
    streakDayBonus: Number(row.streakDayBonus),
    bonusCap: Number(row.bonusCap),
    saved: true,
  };
}

// Registra un bono una sola vez; el índice único evita duplicados aunque lleguen dos solicitudes a la vez.
export async function awardBonus({ courseId, studentId, kind, reference, transaction }) {
  const policy = await readPolicy(courseId, { transaction });
  const amount = kind === 'quiz' ? policy.quizBonus : policy.streakDayBonus;
  const [event, created] = await GradeBonusEvent.findOrCreate({
    where: { courseId, studentId, kind, reference: String(reference) },
    defaults: { amount },
    transaction,
  });
  return { awarded: created, amount: Number(event.amount) };
}

// Suma el bono ganado por cada estudiante, separado por tipo.
export async function bonusTotals(courseId, studentIds) {
  const rows = studentIds.length
    ? await GradeBonusEvent.findAll({ where: { courseId, studentId: studentIds }, attributes: ['studentId', 'kind', 'amount'] })
    : [];
  const totals = new Map(studentIds.map((studentId) => [studentId, { quiz: 0, streak: 0, quizCount: 0, streakDays: 0 }]));
  for (const row of rows) {
    const total = totals.get(row.studentId);
    if (row.kind === 'quiz') {
      total.quiz += Number(row.amount);
      total.quizCount += 1;
    } else {
      total.streak += Number(row.amount);
      total.streakDays += 1;
    }
  }
  return totals;
}
