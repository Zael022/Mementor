import { Op } from 'sequelize';
import {
  Assignment, AssignmentSubmission, ClassSession, Course, CourseStreak, CourseTeacher, Enrollment, QuickQuiz, User, sequelize,
} from '../models/index.js';
import { forbidden, invalid } from '../utils/AppError.js';
import { clock, dayKey } from '../utils/clock.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';
import { streakView } from './streakService.js';

// Cursos visibles para el usuario (los mismos que su barra lateral).
async function myCourses(user) {
  const where = { institutionId: user.institutionId };
  if (user.role === 'teacher') {
    const links = await CourseTeacher.findAll({ where: { userId: user.id }, attributes: ['courseId'] });
    where.id = links.map((link) => link.courseId);
    where.status = ['draft', 'published'];
  } else if (user.role === 'student') {
    const links = await Enrollment.findAll({ where: { studentId: user.id, status: 'active' }, attributes: ['courseId'] });
    where.id = links.map((link) => link.courseId);
    where.status = 'published';
  } else if (user.role !== 'institution_admin') {
    throw forbidden();
  }
  return Course.findAll({ where, attributes: ['id', 'code', 'title', 'status'], order: [['title', 'ASC']] });
}

// Docentes y compañeros del curso; el estudiante solo ve nombres, el docente también los correos.
export async function getPeople(user, courseId) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const attributes = canEdit ? ['id', 'displayName', 'email'] : ['id', 'displayName'];
  const teachers = await course.getTeachers({ attributes, joinTableAttributes: [], order: [['displayName', 'ASC']] });
  const enrollments = await Enrollment.findAll({
    where: { courseId: course.id, status: 'active' },
    include: [{ model: User, as: 'student', attributes }],
    order: [[{ model: User, as: 'student' }, 'displayName', 'ASC']],
  });
  const person = (row) => ({ id: row.id, displayName: row.displayName, ...(canEdit ? { email: row.email } : {}), isMe: row.id === user.id });
  return { teachers: teachers.map(person), students: enrollments.map((row) => person(row.student)) };
}

// Entregas de tareas y clases en vivo dentro de un rango de fechas (máximo 6 semanas).
export async function getCalendar(user, { from, to, courseId }) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw invalid('Rango de fechas no válido.');
  if (end - start > 42 * 24 * 3600 * 1000) throw invalid('El rango máximo es de 6 semanas.');

  let courses = await myCourses(user);
  if (courseId) courses = courses.filter((course) => course.id === courseId);
  const ids = courses.map((course) => course.id);
  const titleOf = new Map(courses.map((course) => [course.id, course.title]));
  if (ids.length === 0) return { courses: [], items: [] };

  const staff = user.role !== 'student';
  const [assignments, sessions] = await Promise.all([
    Assignment.findAll({
      where: { courseId: ids, dueAt: { [Op.between]: [start, end] }, ...(staff ? {} : { status: 'published' }) },
      attributes: ['id', 'courseId', 'title', 'dueAt', 'status'],
    }),
    ClassSession.findAll({
      where: { courseId: ids, status: 'scheduled', startsAt: { [Op.between]: [start, end] } },
      attributes: ['id', 'courseId', 'title', 'startsAt', 'durationMinutes'],
    }),
  ]);
  const items = [
    ...assignments.map((row) => ({ type: 'assignment', id: row.id, courseId: row.courseId, courseTitle: titleOf.get(row.courseId), title: row.title, at: row.dueAt, draft: row.status === 'draft' })),
    ...sessions.map((row) => ({ type: 'session', id: row.id, courseId: row.courseId, courseTitle: titleOf.get(row.courseId), title: row.title, at: row.startsAt, durationMinutes: row.durationMinutes })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  return { courses: courses.map((course) => ({ id: course.id, title: course.title })), items };
}

// Pendientes del estudiante (asignado, faltante, entregado y racha) o del docente (entregas por revisar).
export async function getTodo(user) {
  const courses = await myCourses(user);
  const ids = courses.map((course) => course.id);
  const titleOf = new Map(courses.map((course) => [course.id, course.title]));
  if (ids.length === 0) return user.role === 'student' ? { assigned: [], missing: [], done: [], streaks: [] } : { toReview: [] };

  if (user.role !== 'student') {
    const pending = await AssignmentSubmission.findAll({
      where: { gradePoints: null },
      include: [
        { model: Assignment, as: 'assignment', where: { courseId: ids }, attributes: ['id', 'courseId', 'title', 'maxPoints'] },
        { model: User, as: 'student', attributes: ['id', 'displayName'] },
      ],
      order: [['submittedAt', 'ASC']],
      limit: 200,
    });
    return {
      toReview: pending.map((row) => ({
        submissionId: row.id,
        assignmentId: row.assignment.id,
        assignmentTitle: row.assignment.title,
        courseId: row.assignment.courseId,
        courseTitle: titleOf.get(row.assignment.courseId),
        studentName: row.student.displayName,
        submittedAt: row.submittedAt,
      })),
    };
  }

  const now = clock.now();
  const assignments = await Assignment.findAll({
    where: { courseId: ids, status: 'published' },
    attributes: ['id', 'courseId', 'title', 'dueAt', 'maxPoints'],
    include: [{ model: AssignmentSubmission, as: 'submissions', required: false, where: { studentId: user.id }, attributes: ['id', 'submittedAt', 'gradePoints'] }],
    order: [['dueAt', 'ASC'], ['id', 'ASC']],
  });
  const item = (row) => ({
    id: row.id, courseId: row.courseId, courseTitle: titleOf.get(row.courseId), title: row.title, dueAt: row.dueAt, maxPoints: row.maxPoints,
    submittedAt: row.submissions[0]?.submittedAt ?? null, gradePoints: row.submissions[0]?.gradePoints ?? null,
  });
  const result = { assigned: [], missing: [], done: [] };
  for (const row of assignments) {
    if (row.submissions.length) result.done.push(item(row));
    else if (row.dueAt && row.dueAt < now) result.missing.push(item(row));
    else result.assigned.push(item(row));
  }

  // Racha de cada curso que ya tiene quizzes publicados (son el banco de la práctica diaria).
  const withBank = await QuickQuiz.findAll({
    where: { courseId: ids, status: 'published' },
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('course_id')), 'courseId']],
    raw: true,
  });
  const bankIds = withBank.map((row) => row.courseId);
  const streaks = bankIds.length ? await CourseStreak.findAll({ where: { courseId: bankIds, studentId: user.id } }) : [];
  const today = dayKey();
  result.streaks = bankIds.map((courseId) => ({
    courseId,
    courseTitle: titleOf.get(courseId),
    ...streakView(streaks.find((row) => row.courseId === courseId), today),
  }));
  return result;
}

// El usuario cambia su nombre visible.
export async function updateProfile(user, { displayName }) {
  const row = await User.findByPk(user.id);
  await sequelize.transaction(async (transaction) => {
    await row.update({ displayName }, { transaction });
    await recordAudit({ actor: user, action: 'user.profile_updated', resourceType: 'user', resourceId: user.id, transaction });
  });
  return { id: row.id, displayName: row.displayName, email: row.email, role: row.role };
}
