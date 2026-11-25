import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/index.js';

// Rango de avance por curso (ADR 0010). Mide avance, no rendimiento: no toca la nota ni el dominio.
// Avance = (lecciones completadas + tareas entregadas) ÷ (lecciones publicadas + tareas publicadas).
export const RANKS = Object.freeze([
  { key: 'destello', name: 'Destello', min: 0 },
  { key: 'brillo', name: 'Brillo', min: 20 },
  { key: 'luz', name: 'Luz', min: 45 },
  { key: 'estrella', name: 'Estrella', min: 70 },
  { key: 'constelacion', name: 'Constelación', min: 100 },
]);

export const NO_RANK_NAME = 'Sin rango todavía';

// Calcula el rango con enteros para que cada umbral se cumpla de forma exacta (20 % de 5 es 1, no 0,999…).
export function rankFor({ lessonsDone = 0, lessonsTotal = 0, assignmentsDone = 0, assignmentsTotal = 0 } = {}) {
  const total = lessonsTotal + assignmentsTotal;
  const parts = {
    lessons: { done: Math.min(lessonsDone, lessonsTotal), total: lessonsTotal },
    assignments: { done: Math.min(assignmentsDone, assignmentsTotal), total: assignmentsTotal },
  };
  if (total === 0) {
    return { key: null, name: NO_RANK_NAME, level: 0, percent: null, done: 0, total: 0, ...parts, next: null };
  }
  const done = parts.lessons.done + parts.assignments.done;
  let index = 0;
  RANKS.forEach((rank, position) => {
    if (done * 100 >= rank.min * total) index = position;
  });
  const current = RANKS[index];
  const upcoming = RANKS[index + 1];
  return {
    key: current.key,
    name: current.name,
    level: index + 1,
    // Se redondea hacia abajo: 99,5 % no se muestra como 100 % hasta terminar de verdad.
    percent: Math.floor((done * 100) / total),
    done,
    total,
    ...parts,
    next: upcoming
      ? { key: upcoming.key, name: upcoming.name, threshold: upcoming.min, remaining: Math.ceil((upcoming.min * total) / 100) - done }
      : null,
  };
}

// Indica si el segundo rango es mayor que el primero (para celebrar «¡Subiste de rango!»).
export function rankWentUp(before, after) {
  return Boolean(before && after && after.level > before.level && before.level > 0);
}

const key = (courseId, studentId) => `${Number(courseId)}:${Number(studentId)}`;

// Cuenta lo publicado por curso y lo hecho por cada estudiante, en cuatro consultas agregadas.
export async function getProgressRanks({ courseIds, studentIds, transaction } = {}) {
  const ranks = new Map();
  if (!courseIds?.length || !studentIds?.length) return ranks;
  const options = { replacements: { courseIds, studentIds }, type: QueryTypes.SELECT, transaction };
  const [lessonTotals, lessonDone, assignmentTotals, assignmentDone] = await Promise.all([
    sequelize.query(
      `SELECT course_id AS courseId, COUNT(*) AS total FROM lessons
        WHERE course_id IN (:courseIds) AND status = 'published' GROUP BY course_id`,
      options,
    ),
    sequelize.query(
      `SELECT l.course_id AS courseId, lp.student_id AS studentId, COUNT(*) AS done
         FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id AND l.status = 'published'
        WHERE l.course_id IN (:courseIds) AND lp.student_id IN (:studentIds)
        GROUP BY l.course_id, lp.student_id`,
      options,
    ),
    sequelize.query(
      `SELECT course_id AS courseId, COUNT(*) AS total FROM assignments
        WHERE course_id IN (:courseIds) AND status = 'published' GROUP BY course_id`,
      options,
    ),
    sequelize.query(
      `SELECT a.course_id AS courseId, s.student_id AS studentId, COUNT(*) AS done
         FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id AND a.status = 'published'
        WHERE a.course_id IN (:courseIds) AND s.student_id IN (:studentIds)
        GROUP BY a.course_id, s.student_id`,
      options,
    ),
  ]);

  const byCourse = (rows) => new Map(rows.map((row) => [Number(row.courseId), Number(row.total)]));
  const byPair = (rows) => new Map(rows.map((row) => [key(row.courseId, row.studentId), Number(row.done)]));
  const [lessons, lessonsDoneBy, assignments, assignmentsDoneBy] = [byCourse(lessonTotals), byPair(lessonDone), byCourse(assignmentTotals), byPair(assignmentDone)];

  for (const courseId of courseIds) {
    for (const studentId of studentIds) {
      ranks.set(key(courseId, studentId), rankFor({
        lessonsDone: lessonsDoneBy.get(key(courseId, studentId)) || 0,
        lessonsTotal: lessons.get(Number(courseId)) || 0,
        assignmentsDone: assignmentsDoneBy.get(key(courseId, studentId)) || 0,
        assignmentsTotal: assignments.get(Number(courseId)) || 0,
      }));
    }
  }
  return ranks;
}

// Rango de un estudiante en un curso.
export async function getStudentCourseRank(studentId, courseId, { transaction } = {}) {
  const ranks = await getProgressRanks({ courseIds: [courseId], studentIds: [studentId], transaction });
  return ranks.get(key(courseId, studentId));
}

// Rangos de un estudiante en varios cursos (tarjetas de inicio).
export async function getStudentRanks(studentId, courseIds) {
  const ranks = await getProgressRanks({ courseIds, studentIds: [studentId] });
  return new Map(courseIds.map((courseId) => [Number(courseId), ranks.get(key(courseId, studentId))]));
}

// Rangos de los estudiantes de un curso (analítica docente, sin ordenar ni comparar).
export async function getCourseRanks(courseId, studentIds) {
  const ranks = await getProgressRanks({ courseIds: [courseId], studentIds });
  return new Map(studentIds.map((studentId) => [Number(studentId), ranks.get(key(courseId, studentId))]));
}
