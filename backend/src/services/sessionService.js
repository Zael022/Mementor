import { ClassSession, SessionAttendance, Enrollment, Topic, User } from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';

const OPEN_BEFORE_MINUTES = 15;

// Calcula en qué momento está la clase respecto a la hora actual.
export function sessionState(session, now = new Date()) {
  if (session.status === 'cancelled') return 'cancelled';
  const start = new Date(session.startsAt).getTime();
  const end = start + session.durationMinutes * 60000;
  if (now.getTime() > end) return 'ended';
  if (now.getTime() >= start) return 'live';
  return 'upcoming';
}

// Indica si ya se puede entrar (desde 15 minutos antes hasta el final).
function isOpen(session, now = new Date()) {
  const start = new Date(session.startsAt).getTime();
  const end = start + session.durationMinutes * 60000;
  return session.status === 'scheduled' && now.getTime() >= start - OPEN_BEFORE_MINUTES * 60000 && now.getTime() <= end;
}

// Arma la respuesta; el enlace de la reunión solo lo ve quien gestiona el curso.
export function sessionDto(session, { canEdit, attended, attendanceCount } = {}) {
  return {
    id: session.id,
    courseId: session.courseId,
    topicId: session.topicId,
    title: session.title,
    description: session.description,
    startsAt: session.startsAt,
    durationMinutes: session.durationMinutes,
    status: session.status,
    state: sessionState(session),
    canJoin: isOpen(session),
    recordingUrl: session.recordingUrl,
    ...(canEdit ? { meetingUrl: session.meetingUrl, attendanceCount: attendanceCount ?? 0 } : { attended: Boolean(attended) }),
  };
}

async function loadSession(user, sessionId, { write = false } = {}) {
  const session = sessionId ? await ClassSession.findByPk(sessionId) : null;
  if (!session) throw notFound('Clase no encontrada.');
  const access = await getCourseAccess(user, session.courseId, { write });
  return { session, ...access };
}

async function assertTopic(topicId, courseId) {
  if (!topicId) return;
  if (!(await Topic.findOne({ where: { id: topicId, courseId } }))) throw invalid('El tema indicado no pertenece a este curso.');
}

// Lista las clases del curso, de la más próxima a la más antigua.
export async function listSessions(user, courseId) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const sessions = await ClassSession.findAll({
    where: { courseId: course.id },
    include: [{ model: SessionAttendance, as: 'attendance', attributes: ['studentId'] }],
    order: [['startsAt', 'ASC']],
  });
  return sessions.map((session) => sessionDto(session, {
    canEdit,
    attendanceCount: session.attendance.length,
    attended: session.attendance.some((row) => row.studentId === user.id),
  }));
}

// Programa una clase en vivo.
export async function createSession(user, courseId, data) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  await assertTopic(data.topicId, course.id);
  const session = await ClassSession.create({ ...data, topicId: data.topicId || null, courseId: course.id, createdBy: user.id });
  await recordAudit({ actor: user, action: 'session.created', resourceType: 'class_session', resourceId: session.id });
  return sessionDto(session, { canEdit: true });
}

// Cambia los datos de la clase, la cancela o agrega la grabación.
export async function updateSession(user, sessionId, changes) {
  const { session } = await loadSession(user, sessionId, { write: true });
  if (changes.topicId) await assertTopic(changes.topicId, session.courseId);
  await session.update(changes);
  const attendanceCount = await SessionAttendance.count({ where: { sessionId: session.id } });
  return sessionDto(session, { canEdit: true, attendanceCount });
}

export async function deleteSession(user, sessionId) {
  const { session } = await loadSession(user, sessionId, { write: true });
  await session.destroy();
}

// Registra la asistencia del estudiante y le entrega el enlace de la reunión.
export async function joinSession(user, sessionId) {
  const { session, canEdit } = await loadSession(user, sessionId);
  if (canEdit) return { meetingUrl: session.meetingUrl, attendanceRecorded: false };
  if (user.role !== 'student') throw forbidden();
  if (!isOpen(session)) {
    throw conflict('SESSION_NOT_OPEN', session.status === 'cancelled'
      ? 'Esta clase fue cancelada.'
      : `La clase solo se puede abrir desde ${OPEN_BEFORE_MINUTES} minutos antes hasta que termina.`);
  }
  await SessionAttendance.findOrCreate({
    where: { sessionId: session.id, studentId: user.id },
    defaults: { joinedAt: new Date() },
  });
  return { meetingUrl: session.meetingUrl, attendanceRecorded: true };
}

// Muestra quién entró a la clase entre los estudiantes matriculados.
export async function getAttendance(user, sessionId) {
  const { session } = await loadSession(user, sessionId, { write: true });
  const [enrollments, attendance] = await Promise.all([
    Enrollment.findAll({
      where: { courseId: session.courseId, status: 'active' },
      include: [{ model: User, as: 'student', attributes: ['id', 'displayName', 'email'] }],
      order: [[{ model: User, as: 'student' }, 'displayName', 'ASC']],
    }),
    SessionAttendance.findAll({ where: { sessionId: session.id } }),
  ]);
  const joined = new Map(attendance.map((row) => [row.studentId, row.joinedAt]));
  return {
    session: sessionDto(session, { canEdit: true, attendanceCount: attendance.length }),
    students: enrollments.map((row) => ({
      id: row.student.id,
      displayName: row.student.displayName,
      email: row.student.email,
      joinedAt: joined.get(row.student.id) || null,
    })),
  };
}
