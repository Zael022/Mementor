import { Op, QueryTypes } from 'sequelize';
import {
  Assignment, AssignmentSubmission, Course, CourseStreak, DataDeletionRequest, Enrollment, QuickQuiz, sequelize,
} from '../models/index.js';
import { notFound } from '../utils/AppError.js';
import { addDays, dayKey } from '../utils/clock.js';
import { saveRate } from './external/exchangeRateService.js';
import { logIntegration } from './external/httpClient.js';
import { processDeletion } from './governanceService.js';

// Workflow 1 (n8n): recibe el tipo de cambio que n8n consultó y lo guarda.
export async function receiveExchangeRate({ date, buy, sell }) {
  const row = await saveRate({ date, buy, sell, source: 'n8n-hacienda' });
  await logIntegration({ integration: 'n8n:tipo-cambio', direction: 'inbound', status: 'ok', detail: date });
  return { date: row.rateDate, buy: Number(row.buy), sell: Number(row.sell) };
}

// Workflow 2 (n8n): estudiantes con tareas que vencen en 36 horas o con la racha en riesgo hoy.
// Se recorre por páginas ordenadas por id (cursor `after`): nadie queda fuera aunque haya muchas personas.
// No se incluye a quien ya recibió el recordatorio hoy ni a quien lo desactivó en su configuración.
export const REMINDER_PAGE_MAX = 500;
export async function dailyReminders({ after = 0, limit = 200 } = {}) {
  const now = new Date();
  const soon = new Date(now.getTime() + 36 * 3600000);
  const day = dayKey();
  const size = Math.min(Math.max(1, Number(limit) || 200), REMINDER_PAGE_MAX);
  const students = await sequelize.query(
    `SELECT DISTINCT u.id, u.email, u.display_name AS displayName
       FROM users u
       JOIN enrollments e ON e.student_id = u.id AND e.status = 'active'
       JOIN courses c ON c.id = e.course_id AND c.status = 'published'
       LEFT JOIN user_preferences p ON p.user_id = u.id
       LEFT JOIN reminder_deliveries d ON d.user_id = u.id AND d.reminder_day = :day AND d.status = 'sent'
      WHERE u.status = 'active' AND u.anonymized_at IS NULL AND COALESCE(p.email_reminders, 1) = 1
        AND d.id IS NULL AND u.id > :after
      ORDER BY u.id
      LIMIT :take`,
    { replacements: { day, after: Number(after) || 0, take: size + 1 }, type: QueryTypes.SELECT },
  );
  const hasMore = students.length > size;
  const page = students.slice(0, size);
  const byId = new Map(page.map((student) => [student.id, student]));
  const enrollments = page.length ? await Enrollment.findAll({
    where: { status: 'active', studentId: [...byId.keys()] },
    include: [{ model: Course, as: 'course', where: { status: 'published' }, attributes: ['id', 'title'] }],
    order: [['studentId', 'ASC'], ['courseId', 'ASC']],
  }) : [];
  const courseIds = [...new Set(enrollments.map((row) => row.courseId))];
  const assignments = courseIds.length ? await Assignment.findAll({
    where: { courseId: courseIds, status: 'published', dueAt: { [Op.between]: [now, soon] } },
    attributes: ['id', 'courseId', 'title', 'dueAt'],
    include: [{ model: AssignmentSubmission, as: 'submissions', required: false, attributes: ['studentId'], where: { studentId: [...byId.keys()] } }],
    order: [['dueAt', 'ASC'], ['id', 'ASC']],
  }) : [];
  const withBank = courseIds.length
    ? new Set((await QuickQuiz.findAll({ where: { courseId: courseIds, status: 'published' }, attributes: ['courseId'] })).map((row) => row.courseId))
    : new Set();
  const yesterday = addDays(day, -1);
  const atRisk = withBank.size
    ? await CourseStreak.findAll({ where: { lastDay: yesterday, courseId: [...withBank], studentId: [...byId.keys()] } })
    : [];

  const reminders = new Map();
  const add = (studentId, item) => {
    const student = byId.get(studentId);
    const entry = reminders.get(studentId) || { userId: studentId, day, email: student.email, name: student.displayName, items: [] };
    entry.items.push(item);
    reminders.set(studentId, entry);
  };
  for (const enrollment of enrollments) {
    for (const assignment of assignments.filter((row) => row.courseId === enrollment.courseId)) {
      if (!assignment.submissions.some((sub) => sub.studentId === enrollment.studentId)) {
        add(enrollment.studentId, { type: 'tarea', course: enrollment.course.title, title: assignment.title, dueAt: assignment.dueAt });
      }
    }
    if (atRisk.some((row) => row.courseId === enrollment.courseId && row.studentId === enrollment.studentId)) {
      add(enrollment.studentId, { type: 'racha', course: enrollment.course.title, title: 'Completa la práctica de hoy para no perder tu racha' });
    }
  }
  const list = [...reminders.values()];
  const nextCursor = hasMore ? page[page.length - 1].id : null;
  await logIntegration({ integration: 'n8n:recordatorios', direction: 'inbound', status: 'ok', detail: `${list.length} con pendientes de ${page.length} revisadas` });
  return { day, reminders: list, scanned: page.length, nextCursor };
}

// n8n informa qué recordatorios salieron. Un «enviado» no se vuelve «fallido» al repetir el aviso.
export async function recordReminderDeliveries({ day, results }) {
  const rows = results.map(({ userId, status }) => [userId, day, status]);
  await sequelize.query(
    `INSERT INTO reminder_deliveries (user_id, reminder_day, status, attempts) VALUES ${rows.map(() => '(?, ?, ?, 1)').join(', ')}
     ON DUPLICATE KEY UPDATE status = IF(status = 'sent', 'sent', VALUES(status)), attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP`,
    { replacements: rows.flat() },
  );
  const sent = results.filter((item) => item.status === 'sent').length;
  await logIntegration({
    integration: 'n8n:recordatorios', direction: 'inbound', status: sent === results.length ? 'ok' : 'error',
    detail: `${sent} enviados, ${results.length - sent} fallidos (${day})`,
  });
  return { recorded: results.length, sent, failed: results.length - sent };
}

// Workflow 3 (n8n): la baja ya se completó en el servidor; esta llamada es idempotente y confirma el estado
// antes de que n8n envíe el correo. Una solicitud antigua que siguiera pendiente se completa aquí.
export async function processDeletionFromN8n(requestId) {
  if (!(await DataDeletionRequest.findByPk(requestId))) throw notFound('Solicitud no encontrada.');
  const result = await processDeletion(requestId, 'n8n', { notify: false });
  await logIntegration({ integration: 'n8n:baja', direction: 'inbound', status: 'ok', detail: `solicitud ${requestId}` });
  return result;
}

// n8n informa si pudo enviar el correo de confirmación.
export async function markDeletionNotified(requestId, notificationStatus) {
  const row = await DataDeletionRequest.findByPk(requestId);
  if (!row) throw notFound('Solicitud no encontrada.');
  await row.update({ notificationStatus });
  return { id: row.id, notificationStatus };
}

// Aviso saliente a n8n al crear una solicitud de baja (lleva el correo original para confirmar al final).
export async function notifyDeletionWebhook(request, { email, displayName }) {
  const url = process.env.N8N_DELETION_WEBHOOK_URL;
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-integration-key': process.env.N8N_INTEGRATION_KEY || '' },
      body: JSON.stringify({ requestId: request.id, email, displayName }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await logIntegration({ integration: 'n8n:baja', direction: 'outbound', status: 'ok', latencyMs: Date.now() - startedAt });
    return true;
  } catch (error) {
    await logIntegration({ integration: 'n8n:baja', direction: 'outbound', status: 'error', detail: error.message, latencyMs: Date.now() - startedAt });
    return false;
  }
}
