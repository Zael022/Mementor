import {
  Assessment, AssessmentAttempt, Assignment, AssignmentSubmission, ClassWorkGrade, ClassWorkItem, CourseGradePolicy, Enrollment, User, sequelize,
} from '../models/index.js';
import { forbidden, invalid } from '../utils/AppError.js';
import { clock } from '../utils/clock.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import { bonusTotals, readPolicy } from './bonusService.js';
import { streaksFor } from './streakService.js';

// Escala de la nota final.
export const GRADE_SCALE = 10;

const round2 = (value) => Math.round(value * 100) / 100;
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

// Porcentaje de evaluaciones: mejor intento; una evaluación cerrada sin intentos cuenta 0 y una abierta sin intentos aún no cuenta.
function assessmentScores(assessments, attempts, studentId) {
  const counted = [];
  for (const assessment of assessments) {
    const mine = attempts.filter((attempt) => attempt.assessmentId === assessment.id && attempt.studentId === studentId);
    if (mine.length) counted.push(Math.max(...mine.map((attempt) => Number(attempt.scorePct))));
    else if (assessment.status === 'closed') counted.push(0);
  }
  return counted;
}

// Porcentaje de tareas: las calificadas cuentan; una vencida sin entrega cuenta 0; las pendientes de calificar no cuentan.
function assignmentScores(assignments, submissions, studentId, now) {
  const counted = [];
  for (const assignment of assignments) {
    const submission = submissions.find((item) => item.assignmentId === assignment.id && item.studentId === studentId);
    // Defensa adicional: una entrega nunca vale más del 100 %.
    if (submission && submission.gradePoints !== null) counted.push(Math.min(100, (submission.gradePoints / assignment.maxPoints) * 100));
    else if (!submission && assignment.dueAt && assignment.dueAt < now) counted.push(0);
  }
  return counted;
}

// Porcentaje de trabajo en clase: solo cuentan las actividades que el docente ya calificó a ese estudiante.
function classWorkScores(items, grades, studentId) {
  const counted = [];
  for (const item of items) {
    const grade = grades.find((row) => row.itemId === item.id && row.studentId === studentId);
    if (grade) counted.push(Math.min(100, (Number(grade.points) / item.maxPoints) * 100));
  }
  return counted;
}

// Combina los promedios con sus pesos; si una parte aún no tiene nada que contar, su peso se reparte entre las demás.
export function combine({ assessmentsPct, assignmentsPct, classworkPct = null, policy, bonus }) {
  const parts = [
    { pct: assessmentsPct, weight: policy.assessmentsWeight },
    { pct: assignmentsPct, weight: policy.assignmentsWeight },
    { pct: classworkPct, weight: policy.classworkWeight ?? 0 },
  ].filter((part) => part.pct !== null && part.weight > 0);
  const weights = parts.reduce((sum, part) => sum + part.weight, 0);
  const basePct = weights ? parts.reduce((sum, part) => sum + part.pct * part.weight, 0) / weights : null;
  const bonusEarned = round2(bonus.quiz + bonus.streak);
  const bonusApplied = round2(Math.min(policy.bonusCap, bonusEarned));
  const base = basePct === null ? null : round2((basePct / 100) * GRADE_SCALE);
  const final = base === null ? null : round2(Math.min(GRADE_SCALE, base + bonusApplied));
  return { basePct: basePct === null ? null : round2(basePct), base, bonusEarned, bonusApplied, final };
}

async function gradesFor(courseId, studentIds) {
  const policy = await readPolicy(courseId);
  const assessments = await Assessment.findAll({ where: { courseId, status: ['published', 'closed'] }, attributes: ['id', 'status'] });
  const attempts = assessments.length && studentIds.length
    ? await AssessmentAttempt.findAll({
      where: { assessmentId: assessments.map((item) => item.id), studentId: studentIds, status: 'submitted' },
      attributes: ['assessmentId', 'studentId', 'scorePct'],
    })
    : [];
  const assignments = await Assignment.findAll({ where: { courseId, status: 'published' }, attributes: ['id', 'dueAt', 'maxPoints'] });
  const submissions = assignments.length && studentIds.length
    ? await AssignmentSubmission.findAll({
      where: { assignmentId: assignments.map((item) => item.id), studentId: studentIds },
      attributes: ['assignmentId', 'studentId', 'gradePoints'],
    })
    : [];
  const classItems = await ClassWorkItem.findAll({ where: { courseId }, attributes: ['id', 'maxPoints'] });
  const classGrades = classItems.length && studentIds.length
    ? await ClassWorkGrade.findAll({ where: { itemId: classItems.map((item) => item.id), studentId: studentIds }, attributes: ['itemId', 'studentId', 'points'] })
    : [];
  const bonuses = await bonusTotals(courseId, studentIds);
  const streaks = await streaksFor(courseId, studentIds);
  const now = clock.now();

  return {
    policy,
    grades: new Map(studentIds.map((studentId) => {
      const fromAssessments = assessmentScores(assessments, attempts, studentId);
      const fromAssignments = assignmentScores(assignments, submissions, studentId, now);
      const fromClassWork = classWorkScores(classItems, classGrades, studentId);
      const bonus = bonuses.get(studentId);
      const totals = combine({
        assessmentsPct: average(fromAssessments), assignmentsPct: average(fromAssignments), classworkPct: average(fromClassWork), policy, bonus,
      });
      return [studentId, {
        ...totals,
        assessmentsPct: fromAssessments.length ? round2(average(fromAssessments)) : null,
        assessmentsCounted: fromAssessments.length,
        assignmentsPct: fromAssignments.length ? round2(average(fromAssignments)) : null,
        assignmentsCounted: fromAssignments.length,
        classworkPct: fromClassWork.length ? round2(average(fromClassWork)) : null,
        classworkCounted: fromClassWork.length,
        quizBonus: round2(bonus.quiz),
        perfectQuizzes: bonus.quizCount,
        streakBonus: round2(bonus.streak),
        streakDaysEarned: bonus.streakDays,
        streak: streaks.get(studentId),
      }];
    })),
  };
}

const policyDto = (policy) => ({
  assessmentsWeight: policy.assessmentsWeight,
  assignmentsWeight: policy.assignmentsWeight,
  classworkWeight: policy.classworkWeight,
  quizBonus: policy.quizBonus,
  streakDayBonus: policy.streakDayBonus,
  bonusCap: policy.bonusCap,
  scale: GRADE_SCALE,
});

// Nota del estudiante en un curso, con su desglose.
export async function getMyGrade(user, courseId) {
  if (user.role !== 'student') throw forbidden();
  const { course } = await getCourseAccess(user, courseId);
  const { policy, grades } = await gradesFor(course.id, [user.id]);
  return { policy: policyDto(policy), grade: grades.get(user.id) };
}

// Notas de todos los estudiantes activos del curso, para el docente.
export async function getCourseGrades(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const enrollments = await Enrollment.findAll({
    where: { courseId: course.id, status: 'active' },
    include: [{ model: User, as: 'student', attributes: ['id', 'displayName', 'email'] }],
    order: [[{ model: User, as: 'student' }, 'displayName', 'ASC']],
  });
  const ids = enrollments.map((enrollment) => enrollment.studentId);
  const { policy, grades } = await gradesFor(course.id, ids);
  return {
    policy: { ...policyDto(policy), saved: policy.saved },
    students: enrollments.map((enrollment) => ({
      studentId: enrollment.studentId,
      displayName: enrollment.student.displayName,
      email: enrollment.student.email,
      ...grades.get(enrollment.studentId),
    })),
  };
}

// Guarda los pesos y el bono del curso; los tres pesos deben sumar 100.
export async function savePolicy(user, courseId, changes) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  if (changes.assessmentsWeight + changes.assignmentsWeight + changes.classworkWeight !== 100) {
    throw invalid('Los pesos de evaluaciones, tareas y trabajo en clase deben sumar 100.');
  }
  await sequelize.transaction(async (transaction) => {
    await CourseGradePolicy.upsert({ courseId: course.id, ...changes }, { transaction });
    await recordAudit({ actor: user, action: 'grade_policy.saved', resourceType: 'course', resourceId: course.id, metadata: changes, transaction });
  });
  return policyDto(await readPolicy(course.id));
}
