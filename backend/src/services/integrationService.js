import { Op } from 'sequelize';
import {
  Assignment, AssignmentSubmission, Course, CourseStreak, DataDeletionRequest, Enrollment, QuickQuiz, User,
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
export async function dailyReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 36 * 3600000);
  const enrollments = await Enrollment.findAll({
    where: { status: 'active' },
    include: [
      { model: User, as: 'student', where: { status: 'active', anonymizedAt: null }, attributes: ['id', 'email', 'displayName'] },
      { model: Course, as: 'course', where: { status: 'published' }, attributes: ['id', 'title'] },
    ],
    limit: 5000,
  });
  const courseIds = [...new Set(enrollments.map((row) => row.courseId))];
  const assignments = courseIds.length ? await Assignment.findAll({
    where: { courseId: courseIds, status: 'published', dueAt: { [Op.between]: [now, soon] } },
    attributes: ['id', 'courseId', 'title', 'dueAt'],
    include: [{ model: AssignmentSubmission, as: 'submissions', required: false, attributes: ['studentId'] }],
  }) : [];
  const withBank = new Set((await QuickQuiz.findAll({ where: { courseId: courseIds, status: 'published' }, attributes: ['courseId'] })).map((row) => row.courseId));
  const yesterday = addDays(dayKey(), -1);
  const atRisk = await CourseStreak.findAll({ where: { lastDay: yesterday, courseId: [...withBank] } });

  const byStudent = new Map();
  const add = (student, item) => {
    const entry = byStudent.get(student.id) || { email: student.email, name: student.displayName, items: [] };
    entry.items.push(item);
    byStudent.set(student.id, entry);
  };
  for (const enrollment of enrollments) {
    for (const assignment of assignments.filter((row) => row.courseId === enrollment.courseId)) {
      if (!assignment.submissions.some((sub) => sub.studentId === enrollment.studentId)) {
        add(enrollment.student, { type: 'tarea', course: enrollment.course.title, title: assignment.title, dueAt: assignment.dueAt });
      }
    }
    if (atRisk.some((row) => row.courseId === enrollment.courseId && row.studentId === enrollment.studentId)) {
      add(enrollment.student, { type: 'racha', course: enrollment.course.title, title: 'Completa la práctica de hoy para no perder tu racha' });
    }
  }
  const reminders = [...byStudent.values()].slice(0, 500);
  await logIntegration({ integration: 'n8n:recordatorios', direction: 'inbound', status: 'ok', detail: `${reminders.length} personas` });
  return reminders;
}

// Workflow 3 (n8n): n8n procesa la baja y luego envía el correo de confirmación.
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
