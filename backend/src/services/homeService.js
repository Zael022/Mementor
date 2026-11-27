import { Op, QueryTypes } from 'sequelize';
import {
  Announcement, Assignment, AssignmentSubmission, ClassSession, Course, Enrollment, Lesson, LessonProgress, SessionAttendance, sequelize,
} from '../models/index.js';
import { forbidden } from '../utils/AppError.js';
import { clock, dayKey } from '../utils/clock.js';
import { getStudentRanks } from './progressRankService.js';
import { sessionDto } from './sessionService.js';

// Última actividad de aprendizaje real (no cuenta el inicio de sesión): lecciones, entregas, evaluaciones,
// quizzes, práctica diaria, Parejas, tutor y clases en vivo.
const LAST_ACTIVITY_SQL = `SELECT MAX(moment) AS lastActivityAt FROM (
    SELECT MAX(completed_at) AS moment FROM lesson_progress WHERE student_id = :id
    UNION ALL SELECT MAX(submitted_at) FROM assignment_submissions WHERE student_id = :id
    UNION ALL SELECT MAX(created_at) FROM assessment_attempts WHERE student_id = :id
    UNION ALL SELECT MAX(created_at) FROM quiz_plays WHERE student_id = :id
    UNION ALL SELECT MAX(a.created_at) FROM daily_practice_answers a JOIN daily_practices p ON p.id = a.practice_id WHERE p.student_id = :id
    UNION ALL SELECT MAX(updated_at) FROM memory_games WHERE student_id = :id
    UNION ALL SELECT MAX(m.created_at) FROM ai_messages m JOIN ai_threads t ON t.id = m.thread_id WHERE t.user_id = :id AND m.role = 'user'
    UNION ALL SELECT MAX(joined_at) FROM session_attendance WHERE student_id = :id
  ) actividad`;

// Días de calendario completos entre la última actividad y hoy, en la zona horaria de la aplicación.
const utcDay = (date) => {
  const [year, month, day] = dayKey(date).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
export function daysBetween(from, to = clock.now()) {
  if (!from) return null;
  return Math.max(0, Math.round((utcDay(to) - utcDay(new Date(from))) / 86400000));
}

export async function getLastActivity(user) {
  const [row] = await sequelize.query(LAST_ACTIVITY_SQL, { replacements: { id: user.id }, type: QueryTypes.SELECT });
  const lastActivityAt = row?.lastActivityAt ? new Date(row.lastActivityAt) : null;
  return { lastActivityAt, daysAway: daysBetween(lastActivityAt) };
}

// Reúne lo que el estudiante necesita ver al entrar: clases, tareas, anuncios y avance.
export async function getStudentHome(user) {
  if (user.role !== 'student') throw forbidden('Esta vista es solo para estudiantes.');

  const enrollments = await Enrollment.findAll({
    where: { studentId: user.id, status: 'active' },
    attributes: [],
    include: [{ model: Course, as: 'course', where: { status: 'published', institutionId: user.institutionId }, attributes: ['id', 'code', 'title'] }],
    raw: true,
    nest: true,
  });
  const courses = enrollments.map((row) => row.course);
  const courseIds = courses.map((course) => course.id);
  const titleOf = new Map(courses.map((course) => [course.id, course.title]));
  const activity = await getLastActivity(user);
  if (courseIds.length === 0) return { courses: [], sessions: [], assignments: [], announcements: [], activity };

  // Incluye clases que ya empezaron pero aún no terminan (máximo 8 horas de duración).
  const since = new Date(Date.now() - 8 * 3600000);
  const [sessions, assignments, announcements, progress, ranks] = await Promise.all([
    ClassSession.findAll({
      where: { courseId: courseIds, status: 'scheduled', startsAt: { [Op.gte]: since } },
      attributes: ['id', 'courseId', 'topicId', 'title', 'description', 'startsAt', 'durationMinutes', 'status', 'recordingUrl'],
      include: [{ model: SessionAttendance, as: 'attendance', attributes: ['studentId'], where: { studentId: user.id }, required: false }],
      order: [['startsAt', 'ASC']],
      limit: 20,
      subQuery: false,
      raw: true,
      nest: true,
    }),
    Assignment.findAll({
      where: { courseId: courseIds, status: 'published' },
      attributes: ['id', 'courseId', 'title', 'dueAt', 'maxPoints'],
      include: [{ model: AssignmentSubmission, as: 'submissions', required: false, where: { studentId: user.id }, attributes: ['id'] }],
      order: [['dueAt', 'ASC'], ['id', 'ASC']],
      raw: true,
      nest: true,
    }),
    Announcement.findAll({
      where: { courseId: courseIds }, attributes: ['id', 'courseId', 'title', 'body', 'createdAt'], order: [['id', 'DESC']], limit: 5, raw: true,
    }),
    Lesson.findAll({
      where: { courseId: courseIds, status: 'published' },
      attributes: ['courseId', [sequelize.fn('COUNT', sequelize.col('Lesson.id')), 'totalLessons'], [sequelize.fn('COUNT', sequelize.col('progress.id')), 'completedLessons']],
      include: [{ model: LessonProgress, as: 'progress', attributes: [], where: { studentId: user.id }, required: false }],
      group: [sequelize.col('Lesson.course_id')],
      raw: true,
    }),
    getStudentRanks(user.id, courseIds),
  ]);

  const progressByCourse = new Map(progress.map((row) => [row.courseId, row]));
  return {
    courses: courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      totalLessons: Number(progressByCourse.get(course.id)?.totalLessons || 0),
      completedLessons: Number(progressByCourse.get(course.id)?.completedLessons || 0),
      rank: ranks.get(Number(course.id)),
    })),
    sessions: sessions
      .map((session) => ({
        ...sessionDto(session, { attended: session.attendance.studentId === user.id }),
        courseTitle: titleOf.get(session.courseId),
      }))
      .filter((session) => session.state !== 'ended')
      .slice(0, 5),
    assignments: assignments
      .filter((assignment) => !assignment.submissions.id)
      .map((assignment) => ({
        id: assignment.id,
        courseId: assignment.courseId,
        courseTitle: titleOf.get(assignment.courseId),
        title: assignment.title,
        dueAt: assignment.dueAt,
        maxPoints: assignment.maxPoints,
      })),
    announcements: announcements.map((row) => ({
      id: row.id, courseId: row.courseId, courseTitle: titleOf.get(row.courseId), title: row.title, body: row.body, createdAt: row.createdAt,
    })),
    activity,
  };
}
