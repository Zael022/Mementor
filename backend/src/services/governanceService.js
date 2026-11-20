import { unlink } from 'node:fs/promises';
import { anonymizeLinkedCrm, exportLinkedCrm } from './crmPrivacyService.js';
import path from 'node:path';
import { avatarDir } from '../middlewares/upload.js';
import {
  ConsentRecord, DataDeletionRequest, PasswordReset, User, UserSession, sequelize,
  Enrollment, LessonProgress, AssessmentAttempt, AttemptAnswer, TopicMastery, LearningRecommendation, UserPreference, StudyPlan, StudyPlanItem, TopicReview, TopicReviewLog, AiThread, AiMessage, AssignmentSubmission, QuizPlay, QuizPlayAnswer, GradeBonusEvent,
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

// Copia de los datos personales propios (derecho de acceso).
export async function exportMyData(user) {
  const row = await User.findByPk(user.id);
  const [attempts, plans, reviews, threads, plays] = await Promise.all([
    AssessmentAttempt.findAll({ where: { studentId: user.id } }), StudyPlan.findAll({ where: { studentId: user.id } }), TopicReview.findAll({ where: { studentId: user.id } }), AiThread.findAll({ where: { userId: user.id } }), QuizPlay.findAll({ where: { studentId: user.id } }),
  ]);
  const ownRows = (Model, key, rows) => rows.length ? Model.findAll({ where: { [key]: rows.map((r) => r.id) } }) : [];
  return {
    generatedAt: new Date().toISOString(),
    profile: {
      email: row.email, displayName: row.displayName, firstName: row.firstName, lastName: row.lastName,
      phone: row.phone, bio: row.bio, role: row.role, createdAt: row.createdAt,
    },
    consents: (await myConsents(user)).history,
    admissions: await exportLinkedCrm(user),
    learning: {
      enrollments: await Enrollment.findAll({ where: { studentId: user.id } }), lessonProgress: await LessonProgress.findAll({ where: { studentId: user.id } }),
      attempts, answers: await ownRows(AttemptAnswer, 'attemptId', attempts.filter((a) => a.status === 'submitted')),
      mastery: await TopicMastery.findAll({ where: { studentId: user.id } }), recommendations: await LearningRecommendation.findAll({ where: { studentId: user.id } }),
      preferences: await UserPreference.findOne({ where: { userId: user.id } }), plans, planItems: await ownRows(StudyPlanItem, 'studyPlanId', plans), reviews, reviewLogs: await ownRows(TopicReviewLog, 'reviewId', reviews),
      threads, messages: await ownRows(AiMessage, 'threadId', threads), submissions: await AssignmentSubmission.findAll({ where: { studentId: user.id } }),
      plays, playAnswers: await ownRows(QuizPlayAnswer, 'playId', plays), bonuses: await GradeBonusEvent.findAll({ where: { studentId: user.id } }),
    },
    deletionRequests: await DataDeletionRequest.findAll({ where: { userId: user.id }, attributes: ['id', 'status', 'createdAt', 'processedAt'] }),
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
  // Con DELETION_PROCESSOR=n8n el workflow procesa y confirma; si n8n no responde, se procesa aquí para no dejarla esperando.
  if (process.env.DELETION_PROCESSOR === 'n8n' && process.env.N8N_DELETION_WEBHOOK_URL) {
    const { notifyDeletionWebhook } = await import('./integrationService.js');
    if (await notifyDeletionWebhook(request, { email: user.email, displayName: user.displayName })) return deletionDto(request);
  }
  return processDeletion(request.id, 'app');
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
    await anonymizeLinkedCrm(user, transaction);
    await UserSession.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
    await PasswordReset.destroy({ where: { userId: user.id }, transaction });
    // Conversaciones con el tutor (sus mensajes y citas se borran en cascada) y preferencias personales.
    await sequelize.query('DELETE FROM ai_threads WHERE user_id = :id', { replacements: { id: user.id }, transaction });
    await sequelize.query('DELETE FROM user_preferences WHERE user_id = :id', { replacements: { id: user.id }, transaction });
    await row.update({ status: 'completed', processedAt: new Date(), processedVia: via, retainedSummary: RETAINED_SUMMARY }, { transaction });
    return row;
  });

  if (avatarFile) await unlink(path.join(avatarDir(), path.basename(avatarFile))).catch(() => {});
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
  const institution = user.role === 'platform_admin' ? '' : 'WHERE u.institution_id = :institutionId';
  const [rows] = await sequelize.query(
    `SELECT c.document, c.version, COUNT(*) AS total FROM consent_records c JOIN users u ON u.id = c.user_id ${institution}
      GROUP BY c.document, c.version ORDER BY c.document, c.version DESC`,
    { replacements: { institutionId: user.institutionId } },
  );
  return { current: POLICY_VERSIONS, accepted: rows.map((row) => ({ ...row, total: Number(row.total) })) };
}
