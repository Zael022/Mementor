import path from 'node:path';
import { Op, QueryTypes } from 'sequelize';
import { removeStored } from './fileStore.js';
import {
  ConsentRecord, DataDeletionRequest, EmailChange, PasswordReset, User, UserSession, sequelize,
} from '../models/index.js';
import { POLICY_VERSIONS, pendingConsents } from './consentService.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';
import { recordAudit } from './auditService.js';
import { confirmPassword } from './authService.js';
import { isMailConfigured, sendMail } from './mailService.js';

// Lo que se conserva tras una baja y su motivo (se muestra a la persona y queda en la solicitud).
export const RETAINED_SUMMARY = [
  'Se conservan, sin nombre ni correo, las calificaciones, entregas e intentos de evaluación, porque la institución debe mantener el historial académico.',
  'Se conservan los registros de aceptación de términos y la bitácora de auditoría, como evidencia legal del tratamiento de datos.',
  'Se eliminaron: nombre, correo, teléfono, presentación, foto, contraseña, sesiones, preferencias y conversaciones con el tutor.',
].join(' ');

export async function myConsents(user) {
  const rows = await ConsentRecord.findAll({ where: { userId: user.id }, order: [['acceptedAt', 'DESC']] });
  return {
    current: POLICY_VERSIONS,
    pending: await pendingConsents(user.id),
    history: rows.map((row) => ({ document: row.document, version: row.version, acceptedAt: row.acceptedAt })),
  };
}

// Datos de aprendizaje propios que entran en la copia. Cada consulta filtra por la persona que la pide.
// No se incluyen identificadores de otras personas (quién calificó) ni las claves de respuesta de las preguntas.
const LEARNING_EXPORT = {
  courses: `SELECT c.title AS course, e.status, e.created_at AS enrolledAt
      FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = :id ORDER BY e.id`,
  assessmentAttempts: `SELECT a.title AS assessment, t.status, t.score_pct AS scorePct, t.earned_points AS earnedPoints,
      t.total_points AS totalPoints, t.submitted_at AS submittedAt
      FROM assessment_attempts t JOIN assessments a ON a.id = t.assessment_id WHERE t.student_id = :id ORDER BY t.id`,
  attemptAnswers: `SELECT aa.attempt_id AS attemptId, aa.question_id AS questionId, aa.is_correct AS isCorrect, aa.earned_points AS earnedPoints
      FROM attempt_answers aa JOIN assessment_attempts t ON t.id = aa.attempt_id WHERE t.student_id = :id ORDER BY aa.id`,
  assignmentSubmissions: `SELECT a.title AS assignment, s.body, s.link_url AS linkUrl, s.submitted_at AS submittedAt,
      s.grade_points AS gradePoints, s.feedback, s.graded_at AS gradedAt
      FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.student_id = :id ORDER BY s.id`,
  classWorkGrades: `SELECT i.title AS item, g.points, g.feedback, g.created_at AS gradedAt
      FROM class_work_grades g JOIN class_work_items i ON i.id = g.item_id WHERE g.student_id = :id ORDER BY g.id`,
  attendance: `SELECT session_id AS sessionId, joined_at AS joinedAt FROM session_attendance WHERE student_id = :id ORDER BY id`,
  lessonProgress: `SELECT l.title AS lesson, p.status, p.completed_at AS completedAt
      FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.student_id = :id ORDER BY p.id`,
  mastery: `SELECT tp.title AS topic, m.mastery_score AS masteryScore, m.evidence_count AS evidenceCount, m.updated_at AS updatedAt
      FROM topic_mastery m JOIN topics tp ON tp.id = m.topic_id WHERE m.student_id = :id ORDER BY m.id`,
  recommendations: `SELECT type, reason, status, created_at AS createdAt FROM learning_recommendations WHERE student_id = :id ORDER BY id`,
  reviews: `SELECT tp.title AS topic, r.due_at AS dueAt, r.last_reviewed_at AS lastReviewedAt, r.reps, r.lapses, r.last_grade AS lastGrade
      FROM topic_reviews r JOIN topics tp ON tp.id = r.topic_id WHERE r.student_id = :id ORDER BY r.id`,
  studyPlans: `SELECT id, title, start_date AS startDate, target_date AS targetDate, minutes_per_session AS minutesPerSession, status
      FROM study_plans WHERE student_id = :id ORDER BY id`,
  studyPlanItems: `SELECT i.study_plan_id AS studyPlanId, i.kind, i.description, i.minutes, i.scheduled_date AS scheduledDate, i.status
      FROM study_plan_items i JOIN study_plans p ON p.id = i.study_plan_id WHERE p.student_id = :id ORDER BY i.id`,
  quizPlays: `SELECT quiz_id AS quizId, status, total_questions AS totalQuestions, correct_count AS correctCount, score, finished_at AS finishedAt
      FROM quiz_plays WHERE student_id = :id ORDER BY id`,
  dailyPractices: `SELECT practice_day AS practiceDay, answered_count AS answeredCount, completed_at AS completedAt
      FROM daily_practices WHERE student_id = :id ORDER BY id`,
  streaks: `SELECT c.title AS course, s.current_days AS currentDays, s.best_days AS bestDays, s.last_day AS lastDay
      FROM course_streaks s JOIN courses c ON c.id = s.course_id WHERE s.student_id = :id ORDER BY s.id`,
  bonusEvents: `SELECT kind, amount, created_at AS createdAt FROM grade_bonus_events WHERE student_id = :id ORDER BY id`,
  lessonComments: `SELECT body, created_at AS createdAt FROM lesson_comments WHERE author_id = :id ORDER BY id`,
  tutorConversations: `SELECT t.id AS threadId, t.title AS thread, m.role, m.content, m.created_at AS createdAt
      FROM ai_threads t JOIN ai_messages m ON m.thread_id = t.id WHERE t.user_id = :id ORDER BY m.id`,
  preferences: `SELECT theme, text_scale AS textScale, high_contrast AS highContrast, reduced_motion AS reducedMotion,
      time_zone AS timeZone, daily_goal_minutes AS dailyGoalMinutes, email_reminders AS emailReminders FROM user_preferences WHERE user_id = :id`,
};

// Qué queda fuera de la copia y cómo pedirlo.
const EXPORT_NOTE = 'Incluye tu perfil, aceptaciones, solicitudes de baja y tus datos de aprendizaje en MENTOR AI. '
  + 'La bitácora de seguridad y los registros técnicos de uso no se incluyen: pídelos a la administración de tu institución.';

// Copia de los datos personales propios (derecho de acceso).
export async function exportMyData(user) {
  const row = await User.findByPk(user.id);
  const learning = {};
  for (const [section, sql] of Object.entries(LEARNING_EXPORT)) {
    learning[section] = await sequelize.query(sql, { replacements: { id: user.id }, type: QueryTypes.SELECT });
  }
  return {
    generatedAt: new Date().toISOString(),
    scope: EXPORT_NOTE,
    profile: {
      email: row.email, displayName: row.displayName, firstName: row.firstName, lastName: row.lastName,
      phone: row.phone, bio: row.bio, role: row.role, createdAt: row.createdAt,
    },
    consents: (await myConsents(user)).history,
    deletionRequests: await DataDeletionRequest.findAll({ where: { userId: user.id }, attributes: ['id', 'status', 'createdAt', 'processedAt'] }),
    learning,
  };
}

// Evita dejar una institución sin administración o borrar a quien opera la plataforma.
async function assertCanLeave(user) {
  if (user.role === 'platform_admin') throw forbidden('La cuenta que opera la plataforma no se elimina desde aquí.');
  if (user.role === 'institution_admin') {
    const admins = await User.count({ where: { institutionId: user.institutionId, role: 'institution_admin', status: 'active' } });
    if (admins <= 1) throw conflict('LAST_ADMIN', 'Eres la única administración activa de tu institución. Designa a otra persona antes de darte de baja.');
  }
}

// La persona pide su baja confirmando su identidad con la contraseña.
export async function requestDeletion(user, { password, reason }) {
  await confirmPassword(user.id, password);
  await assertCanLeave(user);
  const pending = await DataDeletionRequest.findOne({ where: { userId: user.id, status: 'pending' } });
  const request = pending || await DataDeletionRequest.create({
    userId: user.id, institutionId: user.institutionId, reason: reason || null, identityConfirmedAt: new Date(),
  });
  await recordAudit({ actor: user, action: 'governance.deletion_requested', resourceType: 'data_deletion_request', resourceId: request.id });
  // La baja se completa aquí, en una transacción, antes de responder: no depende de que un workflow externo termine.
  // Con DELETION_PROCESSOR=n8n, n8n solo envía el correo de confirmación; si no recibe el aviso, el correo sale desde aquí.
  const delegate = process.env.DELETION_PROCESSOR === 'n8n' && process.env.N8N_DELETION_WEBHOOK_URL;
  const contact = { email: user.email, displayName: user.displayName };
  const result = await processDeletion(request.id, 'app', { notify: !delegate });
  if (delegate) {
    const { notifyDeletionWebhook } = await import('./integrationService.js');
    if (!(await notifyDeletionWebhook(request, contact))) {
      await notifyCompletion(await DataDeletionRequest.findByPk(request.id), contact.email, contact.displayName);
    }
  }
  return deletionDto(await DataDeletionRequest.findByPk(result.id));
}

// Completa las solicitudes que quedaron pendientes (por ejemplo, si el servidor se apagó a mitad de la baja).
// Corre con la retención diaria. Como la cuenta aún no se anonimizó, el aviso llega al correo original.
export async function reconcilePendingDeletions({ olderThanMinutes = 10 } = {}) {
  const rows = await DataDeletionRequest.findAll({
    where: { status: 'pending', createdAt: { [Op.lt]: new Date(Date.now() - olderThanMinutes * 60000) } },
    attributes: ['id'], order: [['id', 'ASC']], limit: 500,
  });
  for (const row of rows) await processDeletion(row.id, 'app');
  return rows.length;
}

// Anonimiza la cuenta, borra lo personal, conserva lo obligatorio y notifica al correo original.
export async function processDeletion(requestId, via, { notify = true } = {}) {
  let originalEmail;
  let displayName;
  let avatarFile;
  const request = await sequelize.transaction(async (transaction) => {
    const row = await DataDeletionRequest.findByPk(requestId, { lock: transaction.LOCK.UPDATE, transaction });
    if (!row) throw notFound('Solicitud no encontrada.');
    if (row.status !== 'pending') return row;
    const user = await User.findByPk(row.userId, { lock: transaction.LOCK.UPDATE, transaction });
    originalEmail = user.email;
    displayName = user.displayName;
    avatarFile = user.avatarFile;
    await recordAudit({ actor: user, action: 'governance.user_anonymized', resourceType: 'user', resourceId: user.id, metadata: { via }, transaction });
    await user.update({
      email: `eliminado-${user.id}@anonimo.invalid`,
      displayName: 'Usuario eliminado',
      firstName: null, lastName: null, phone: null, bio: null, avatarFile: null, avatarUpdatedAt: null,
      passwordHash: null, invitationTokenHash: null, invitationExpiresAt: null,
      status: 'disabled', anonymizedAt: new Date(),
    }, { transaction });
    await UserSession.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
    await PasswordReset.destroy({ where: { userId: user.id }, transaction });
    await EmailChange.destroy({ where: { userId: user.id }, transaction });
    // Conversaciones con el tutor (sus mensajes y citas se borran en cascada) y preferencias personales.
    await sequelize.query('DELETE FROM ai_threads WHERE user_id = :id', { replacements: { id: user.id }, transaction });
    await sequelize.query('DELETE FROM user_preferences WHERE user_id = :id', { replacements: { id: user.id }, transaction });
    await sequelize.query('DELETE FROM reminder_deliveries WHERE user_id = :id', { replacements: { id: user.id }, transaction });
    await row.update({ status: 'completed', processedAt: new Date(), processedVia: via, retainedSummary: RETAINED_SUMMARY }, { transaction });
    return row;
  });

  if (avatarFile) await removeStored('avatars', path.basename(avatarFile)).catch(() => {});
  if (originalEmail && notify) await notifyCompletion(request, originalEmail, displayName);
  return deletionDto(request);
}

// Aviso final al correo que tenía la cuenta; el resultado queda registrado en la solicitud.
async function notifyCompletion(request, email, displayName) {
  let notificationStatus = 'not_configured';
  if (isMailConfigured()) {
    try {
      await sendMail({
        to: email,
        subject: 'Tu cuenta de MENTOR AI fue eliminada',
        text: `Hola, ${displayName}:\n\nProcesamos tu solicitud de baja n.º ${request.id}. ${RETAINED_SUMMARY}\n\nSi no la pediste, contacta de inmediato a la administración de tu institución.`,
      });
      notificationStatus = 'sent';
    } catch {
      notificationStatus = 'failed';
    }
  }
  await request.update({ notificationStatus });
}

function deletionDto(row) {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
    processedVia: row.processedVia,
    retainedSummary: row.retainedSummary,
    notificationStatus: row.notificationStatus,
  };
}

// Solicitudes de baja de la institución (administración y auditoría, solo lectura).
export async function listDeletionRequests(user) {
  const where = user.role === 'platform_admin' ? {} : { institutionId: user.institutionId };
  const rows = await DataDeletionRequest.findAll({ where, order: [['createdAt', 'DESC']], limit: 200 });
  return rows.map(deletionDto);
}

// Resumen de aceptación por documento y versión, sin datos de cada persona.
export async function consentSummary(user) {
  // Consulta fija con parámetros: ningún fragmento de SQL se arma con texto.
  const [rows] = await sequelize.query(
    `SELECT c.document, c.version, COUNT(*) AS total FROM consent_records c JOIN users u ON u.id = c.user_id
      WHERE (:all = 1 OR u.institution_id = :institutionId)
      GROUP BY c.document, c.version ORDER BY c.document, c.version DESC`,
    { replacements: { all: user.role === 'platform_admin' ? 1 : 0, institutionId: user.institutionId ?? 0 } },
  );
  return { current: POLICY_VERSIONS, accepted: rows.map((row) => ({ ...row, total: Number(row.total) })) };
}
