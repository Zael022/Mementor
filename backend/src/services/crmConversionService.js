import { Institution, User, Course, CrmProspect, sequelize } from '../models/index.js';
import { conflict, invalid, notFound } from '../utils/AppError.js';
import { clock } from '../utils/clock.js';
import { applicationInScope, crmScope, expectedVersion } from './crmAccessService.js';
import { auditCrm, eventCrm, recordActivity } from './crmService.js';
import { createInvitedUser } from './userService.js';
import { applyEnrollment } from './enrollmentMutationService.js';

export async function convertApplication(actor, id, input) {
  crmScope(actor);
  return sequelize.transaction(async (transaction) => {
    const institution = await Institution.findByPk(actor.institutionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (institution?.status !== 'active') throw conflict('INSTITUTION_INACTIVE', 'La institución no está activa.');
    const row = await applicationInScope(actor, id, { transaction, lock: true, admin: true, allowAnonymized: true });
    if (row.enrollmentId) return { solicitudId: row.id, matriculaId: row.enrollmentId, tipo: row.conversionKind, repetida: true };
    expectedVersion(row, input.versionEsperada);
    if (row.status !== 'activo') throw conflict('PROCESS_CLOSED', 'La solicitud debe estar activa.');
    if (input.excepcional && input.modo !== 'vincular') throw invalid('La excepción solo permite vincular una matrícula activa preexistente.');
    const activityJson = input.actividad ? recordActivity(row, input.actividad) : row.activityJson;
    if (!input.excepcional && (row.stage !== 'semana_prueba' || activityJson.prueba?.resultado !== 'completada')) throw conflict('ADMISSION_REQUIREMENTS', 'Se requiere semana de prueba completada con evidencia y decisión humana.');
    const cycle = await row.getCycle({ transaction });
    const course = await Course.findOne({ where: { id: cycle.courseId, institutionId: actor.institutionId, status: 'published' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!course) throw notFound('La matrícula final requiere un curso publicado y no archivado.');
    const prospect = await CrmProspect.findOne({ where: { id: row.prospectId, institutionId: actor.institutionId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!prospect.email || prospect.anonymizedAt) throw conflict('NO_CONTACT', 'La ficha no tiene contacto disponible.');
    let student = await User.findOne({ where: { email: prospect.email }, transaction, lock: transaction.LOCK.UPDATE });
    if (student && (String(student.institutionId) !== String(actor.institutionId) || student.role !== 'student')) throw conflict('CONTACT_UNAVAILABLE', 'Ese contacto no puede vincularse. La administración debe resolver la compatibilidad por el procedimiento autorizado.');
    if (student?.status === 'disabled') throw conflict('ACCOUNT_DISABLED', 'La cuenta está deshabilitada. Revisa su estado en Usuarios antes de matricular.');
    let invitation = null;
    if (!student) {
      if (input.modo !== 'nueva') throw conflict('NO_ENROLLMENT', 'No existe una matrícula compatible para vincular o reintegrar.');
      invitation = await createInvitedUser(actor, { institutionId: actor.institutionId, email: prospect.email, displayName: prospect.name, role: 'student' }, transaction);
      student = invitation.user;
    }
    const { enrollment, kind } = await applyEnrollment(actor, course, student, input.modo, transaction);
    const fromStage = row.stage;
    await prospect.update({ userId: student.id }, { transaction });
    await row.update({ enrollmentId: enrollment.id, conversionKind: kind, convertedAt: clock.now(), stage: 'estudiante', status: 'matriculado', lastStageChangedAt: clock.now(), version: row.version + 1, activityJson }, { transaction });
    await eventCrm(actor, row, input.excepcional ? 'exceptional_link' : 'enrollment', input.motivo, { fromStage, metadata: { kind, enrollmentId: enrollment.id }, transaction });
    await auditCrm(actor, 'converted', row, { kind, enrollmentId: enrollment.id, reasonInEvent: true }, transaction);
    return { solicitudId: row.id, matriculaId: enrollment.id, tipo: kind, cuenta: { id: student.id, status: student.status }, activacionPendiente: student.status === 'invited', ...(invitation ? { invitacion: { user: { id: student.id, email: student.email }, invitationToken: invitation.invitationToken, invitationExpiresAt: invitation.invitationExpiresAt } } : {}) };
  });
}
