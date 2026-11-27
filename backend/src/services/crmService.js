import { Op } from 'sequelize';
import { CrmCycle, CrmProspect, CrmApplication, CrmStageEvent, CrmFollowup, CrmDraft, CrmConsent, Course, User, Enrollment, sequelize } from '../models/index.js';
import { clock } from '../utils/clock.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { pageMeta, readPagination } from '../utils/http.js';
import { recordAudit } from './auditService.js';
import { applicationInScope, crmScope, cycleInScope, expectedVersion, prospectInScope, validateResponsible } from './crmAccessService.js';
import { STAGES } from '../validators/crmSchemas.js';
import { buildAdmissionContext } from './crmContextService.js';
import { likeOp } from '../utils/sql.js';

export const auditCrm = (actor, action, row, metadata, transaction) => recordAudit({ actor, action: `crm.${action}`, resourceType: 'crm_application', resourceId: row.id, metadata, transaction });
export async function eventCrm(actor, row, kind, reason, { fromStage = row.stage, effectiveAt = clock.now(), metadata = null, transaction } = {}) {
  return CrmStageEvent.create({ institutionId: row.institutionId, applicationId: row.id, fromStage, toStage: row.stage, kind, reason, actorId: actor.id, effectiveAt, recordedAt: clock.now(), metadataJson: metadata, createdAt: clock.now() }, { transaction });
}

export async function listCycles(actor, filters = {}) {
  crmScope(actor, ['institution_admin', 'teacher', 'auditor']);
  const assignments = actor.role === 'teacher' ? await CrmApplication.findAll({ where: { institutionId: actor.institutionId, responsibleId: actor.id }, attributes: ['cycleId'], group: ['cycleId'] }) : null;
  const pagination = readPagination({ limit: 100, ...filters });
  const { rows, count } = await CrmCycle.findAndCountAll({ where: { institutionId: actor.institutionId, ...(assignments ? { id: assignments.map((a) => a.cycleId) } : {}), ...(filters.buscar ? { name: { [likeOp]: `%${filters.buscar.replace(/[%_\\]/g, '')}%` } } : {}) }, order: [['id', 'DESC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows, meta: pageMeta(pagination, count) };
}

export async function applicationHistory(actor, id, filters) {
  const row = await applicationInScope(actor, id);
  const pagination = readPagination(filters);
  const { rows, count } = await CrmStageEvent.findAndCountAll({ where: { institutionId: actor.institutionId, applicationId: row.id }, order: [['effectiveAt', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows, meta: pageMeta(pagination, count) };
}

export async function createCycle(actor, input) {
  crmScope(actor);
  const course = await Course.findOne({ where: { id: input.courseId, institutionId: actor.institutionId, status: { [Op.ne]: 'archived' } } });
  if (!course) throw notFound('Curso no disponible en la institución.');
  return sequelize.transaction(async (transaction) => {
    const row = await CrmCycle.create({ institutionId: actor.institutionId, courseId: course.id, name: input.nombre, campus: input.sede, startsAt: input.inicio, endsAt: input.fin, configJson: input.configuracion, configHistory: [{ version: 1, effectiveAt: clock.now(), config: input.configuracion }] }, { transaction });
    await recordAudit({ actor, action: 'crm.cycle_created', resourceType: 'crm_cycle', resourceId: row.id, transaction });
    return row;
  });
}

export async function updateCycle(actor, id, input) {
  crmScope(actor);
  return sequelize.transaction(async (transaction) => {
    const row = await cycleInScope(actor, id, { transaction, lock: transaction.LOCK.UPDATE });
    expectedVersion(row, input.versionEsperada);
    const version = row.version + 1;
    const config = input.configuracion ?? row.configJson;
    const changedConfig = JSON.stringify(config) !== JSON.stringify(row.configJson);
    await row.update({ version, ...(input.nombre ? { name: input.nombre } : {}), ...(input.estado ? { status: input.estado } : {}), configJson: config, ...(changedConfig ? { configHistory: [...row.configHistory, { version, effectiveAt: clock.now(), config }] } : {}) }, { transaction });
    await recordAudit({ actor, action: 'crm.cycle_updated', resourceType: 'crm_cycle', resourceId: row.id, metadata: { version }, transaction });
    return row;
  });
}

async function insertApplication(actor, prospect, cycle, transaction) {
  if (prospect.anonymizedAt) throw conflict('ANONYMIZED', 'La ficha fue anonimizada.');
  if (cycle.status !== 'open' || clock.now() < cycle.startsAt || clock.now() > cycle.endsAt) throw conflict('CYCLE_CLOSED', 'La convocatoria no está abierta en esta fecha.');
  if (await CrmApplication.findOne({ where: { prospectId: prospect.id, cycleId: cycle.id }, transaction })) throw conflict('APPLICATION_EXISTS', 'La persona ya tiene una solicitud en esta convocatoria.');
  const row = await CrmApplication.create({ institutionId: actor.institutionId, prospectId: prospect.id, cycleId: cycle.id, stage: 'prospecto', lastStageChangedAt: clock.now(), configVersion: cycle.configHistory.at(-1).version, configJson: cycle.configJson, activityJson: {}, acquisitionOrigin: prospect.origin, createdAt: clock.now() }, { transaction });
  await eventCrm(actor, row, 'initial', 'Solicitud registrada', { fromStage: null, transaction });
  await auditCrm(actor, 'application_created', row, null, transaction);
  return { prospectoId: prospect.id, solicitudId: row.id, version: row.version };
}

export async function createProspect(actor, input) {
  crmScope(actor);
  return sequelize.transaction(async (transaction) => {
    const cycle = await cycleInScope(actor, input.convocatoriaId, { transaction, lock: transaction.LOCK.UPDATE });
    const existing = await CrmProspect.findOne({ where: { institutionId: actor.institutionId, email: input.correo }, transaction });
    if (existing) throw conflict('PROSPECT_EXISTS', 'Ya existe una ficha con ese correo en tu institución. Búscala y selecciónala para agregar otra solicitud.');
    const prospect = await CrmProspect.create({ institutionId: actor.institutionId, name: input.nombre, email: input.correo, phone: input.telefono || null, origin: input.procedencia, utmJson: input.utm ?? null }, { transaction });
    return insertApplication(actor, prospect, cycle, transaction);
  });
}

export async function createApplication(actor, input) {
  return sequelize.transaction(async (transaction) => {
    const cycle = await cycleInScope(actor, input.convocatoriaId, { transaction, lock: transaction.LOCK.UPDATE });
    const prospect = await prospectInScope(actor, input.prospectoId, { transaction, lock: transaction.LOCK.UPDATE });
    return insertApplication(actor, prospect, cycle, transaction);
  });
}

export function applicationWhere(actor, filters) {
  const where = { ...crmScope(actor, ['institution_admin', 'teacher']) };
  if (actor.role === 'teacher') where.responsibleId = actor.id;
  if (filters.convocatoriaId) where.cycleId = filters.convocatoriaId;
  if (filters.etapa) where.stage = filters.etapa;
  if (filters.estado) where.status = filters.estado;
  if (filters.responsableId && actor.role !== 'teacher') where.responsibleId = filters.responsableId;
  if (filters.desde || filters.hasta) where.createdAt = { ...(filters.desde ? { [Op.gte]: new Date(filters.desde) } : {}), ...(filters.hasta ? { [Op.lte]: new Date(filters.hasta) } : {}) };
  return where;
}

export async function listApplications(actor, filters) {
  const pagination = readPagination(filters);
  const prospectWhere = {};
  if (filters.procedencia) prospectWhere.origin = filters.procedencia;
  if (filters.buscar) prospectWhere.name = { [likeOp]: `%${filters.buscar.replace(/[%_\\]/g, '')}%` };
  const { rows, count } = await CrmApplication.findAndCountAll({ where: applicationWhere(actor, filters), include: [
    { model: CrmProspect, as: 'prospect', where: prospectWhere, attributes: ['id', 'name', 'email', 'origin', 'anonymizedAt'] },
    { model: CrmCycle, as: 'cycle', ...(filters.sede ? { where: { campus: filters.sede } } : {}), attributes: ['id', 'name', 'campus'] },
  ], order: [['id', 'DESC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows, meta: pageMeta(pagination, count) };
}

export async function listProspects(actor, filters) {
  const pagination = readPagination(filters);
  const where = { ...crmScope(actor), anonymizedAt: null };
  if (filters.buscar) where[Op.or] = ['name', 'email'].map((key) => ({ [key]: { [likeOp]: `%${filters.buscar.replace(/[%_\\]/g, '')}%` } }));
  const { rows, count } = await CrmProspect.findAndCountAll({ where, order: [['name', 'ASC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows, meta: pageMeta(pagination, count) };
}

export async function applicationDetail(actor, id) {
  const row = await applicationInScope(actor, id);
  const [prospect, cycle, events, followups, drafts, consents] = await Promise.all([
    CrmProspect.findByPk(row.prospectId), CrmCycle.findByPk(row.cycleId),
    CrmStageEvent.findAll({ where: { applicationId: row.id }, order: [['effectiveAt', 'ASC'], ['id', 'ASC']], limit: 500 }),
    CrmFollowup.findAll({ where: { applicationId: row.id }, order: [['dueAt', 'ASC']], limit: 100 }),
    actor.role === 'institution_admin' ? CrmDraft.findAll({ where: { applicationId: row.id }, order: [['id', 'DESC']], limit: 50 }) : [],
    actor.role === 'institution_admin' ? CrmConsent.findAll({ where: { prospectId: row.prospectId }, order: [['id', 'DESC']] }) : [],
  ]);
  const user = prospect.userId ? await User.findOne({ where: { id: prospect.userId, institutionId: actor.institutionId }, attributes: ['id', 'status', 'invitationExpiresAt'] }) : null;
  const enrollment = row.enrollmentId ? await Enrollment.findByPk(row.enrollmentId, { attributes: ['id', 'status', 'courseId'] }) : null;
  const course = drafts.length ? await Course.findByPk(cycle.courseId) : null;
  const reviewedDrafts = drafts.map((draft) => {
    let staleContext = true;
    if (!prospect.anonymizedAt) { try { staleContext = buildAdmissionContext(row, cycle, prospect, course, draft.channel, draft.contextJson.objetivo, draft.contextJson.tono).hash !== draft.contextHash; } catch { /* Un contacto eliminado exige revisión. */ } }
    return { ...draft.toJSON(), staleContext, approvalValid: draft.status === 'approved' && draft.approvedVersion === draft.version && !staleContext };
  });
  return { ...row.toJSON(), prospect, cycle, events, followups, drafts: reviewedDrafts, consents, account: user, enrollment };
}

export function recordActivity(row, input) {
  const activity = { ...(row.activityJson[input.tipo] || {}), ...input };
  const results = { campus: ['asistio', 'no_asistio'], tecnica: ['aprobada', 'no_aprobada'], entrevista: ['favorable', 'desfavorable'], prueba: ['completada', 'no_aprobada'] };
  if (input.resultado && !results[input.tipo].includes(input.resultado)) throw invalid('El resultado no corresponde al tipo de actividad.');
  if (!input.programada && !input.resultado) throw invalid('Registra una fecha programada o un resultado con evidencia.');
  if (input.programada && input.programada !== row.activityJson[input.tipo]?.programada && !input.resultado) { delete activity.resultado; delete activity.efectiva; delete activity.evidencia; }
  if (input.efectiva && new Date(input.efectiva) > clock.now()) throw invalid('Una actividad realizada no puede tener fecha futura.');
  if (input.resultado && (!input.efectiva || !input.evidencia)) throw invalid('El resultado requiere fecha efectiva y referencia de evidencia.');
  if (input.resultado && activity.programada && new Date(activity.programada) > clock.now()) throw invalid('La cita todavía es futura; no puede registrarse asistencia ni ausencia.');
  if (input.resultado && activity.programada && new Date(input.efectiva) < new Date(activity.programada)) throw invalid('La fecha efectiva no puede ser anterior a la cita; registra su reprogramación primero.');
  return { ...row.activityJson, [input.tipo]: activity };
}

function requireTransition(row, target, activity) {
  const required = (ok, message) => { if (!ok) throw invalid(message); };
  const campus = activity.campus;
  if (target === 'agenda_campus_day') required(campus?.programada, 'Programa la fecha del Campus Day.');
  if (target === 'asiste_campus_day') required(campus?.resultado === 'asistio' && campus.efectiva, 'Registra asistencia real al Campus Day con evidencia.');
  if (target === 'prueba_tecnica') required(activity.tecnica?.resultado && activity.tecnica.efectiva && activity.tecnica.evidencia, 'Registra el resultado y evidencia de la prueba técnica de admisión.');
  if (target === 'entrevista') required(activity.tecnica?.resultado === 'aprobada' && activity.entrevista?.programada, 'Se requiere prueba técnica aprobada y entrevista programada.');
  if (target === 'admitido') required(activity.entrevista?.resultado === 'favorable' && activity.entrevista?.efectiva, 'Registra el resultado favorable de la entrevista y su evidencia.');
  if (target === 'semana_prueba') required(activity.prueba?.programada, 'Programa el inicio de la semana de prueba.');
}

export async function moveStage(actor, prospectId, input) {
  crmScope(actor);
  return sequelize.transaction(async (transaction) => {
    const row = await applicationInScope(actor, input.solicitudId, { transaction, lock: true, admin: true });
    if (String(row.prospectId) !== String(prospectId)) throw notFound('La solicitud no corresponde al prospecto.');
    expectedVersion(row, input.versionEsperada);
    if (row.status !== 'activo' || row.enrollmentId) throw conflict('PROCESS_CLOSED', 'Solo se mueven solicitudes activas sin matrícula confirmada.');
    const from = STAGES.indexOf(row.stage); const to = STAGES.indexOf(input.etapa);
    if (to === 8 || to === from || to > from + 1) throw conflict('INVALID_TRANSITION', 'Avanza una etapa; Estudiante se alcanza confirmando la matrícula.');
    const effectiveAt = input.fechaEfectiva ? new Date(input.fechaEfectiva) : clock.now();
    if (effectiveAt > clock.now() || effectiveAt < row.createdAt || effectiveAt < row.lastStageChangedAt) throw invalid('La fecha efectiva debe estar entre el último cambio y ahora.');
    const activityJson = input.actividad ? recordActivity(row, input.actividad) : row.activityJson;
    if (to > from) requireTransition(row, input.etapa, activityJson);
    const fromStage = row.stage;
    await row.update({ stage: input.etapa, activityJson, version: row.version + 1, lastStageChangedAt: effectiveAt, ...(to === 1 ? { reviewedAt: clock.now() } : {}) }, { transaction });
    await eventCrm(actor, row, to < from ? 'correction' : 'advance', input.motivo, { fromStage, effectiveAt, metadata: { actividad: input.actividad ?? null }, transaction });
    await auditCrm(actor, to < from ? 'stage_corrected' : 'stage_changed', row, { fromStage, toStage: row.stage, reasonInEvent: true }, transaction);
    return row;
  });
}

export async function updateApplication(actor, id, input) {
  crmScope(actor);
  return sequelize.transaction(async (transaction) => {
    const row = await applicationInScope(actor, id, { transaction, lock: true, admin: true }); expectedVersion(row, input.versionEsperada);
    if (row.enrollmentId && input.estado) throw conflict('ENROLLED', 'La admisión matriculada conserva su historia. Gestiona el estado académico desde Matrículas.');
    if (input.responsableId !== undefined) await validateResponsible(actor, input.responsableId, transaction);
    await row.update({ version: row.version + 1, ...(input.responsableId !== undefined ? { responsibleId: input.responsableId } : {}), ...(input.estado ? { status: input.estado, closedAt: ['retirado', 'rechazado'].includes(input.estado) ? row.closedAt || clock.now() : null } : {}), ...(input.revisada ? { reviewedAt: clock.now() } : {}), ...(input.excepcionConservacion !== undefined ? { retentionException: input.excepcionConservacion } : {}) }, { transaction });
    await eventCrm(actor, row, 'administration', input.motivo, { metadata: { status: row.status, responsibleId: row.responsibleId }, transaction });
    await auditCrm(actor, 'application_updated', row, { reasonInEvent: true, status: row.status, responsibleId: row.responsibleId }, transaction);
    return row;
  });
}

export async function addActivity(actor, id, input) {
  if (actor.role === 'teacher' && input.actividad.tipo !== 'entrevista') throw forbidden('El docente asignado solo registra entrevistas y seguimientos.');
  return sequelize.transaction(async (transaction) => {
    const row = await applicationInScope(actor, id, { transaction, lock: true }); expectedVersion(row, input.versionEsperada);
    if (row.enrollmentId || ['retirado', 'rechazado'].includes(row.status)) throw conflict('PROCESS_CLOSED', 'La solicitud está cerrada.');
    const activityJson = recordActivity(row, input.actividad);
    await row.update({ activityJson, version: row.version + 1 }, { transaction });
    await eventCrm(actor, row, 'activity', input.motivo, { metadata: input.actividad, transaction });
    await auditCrm(actor, 'activity_recorded', row, { type: input.actividad.tipo }, transaction);
    return row;
  });
}

export async function addFollowup(actor, id, input) {
  return sequelize.transaction(async (transaction) => {
    const row = await applicationInScope(actor, id, { transaction, lock: true }); expectedVersion(row, input.versionEsperada);
    if (['retirado', 'rechazado'].includes(row.status)) throw conflict('PROCESS_CLOSED', 'Reabre la solicitud antes de programar seguimientos.');
    if (actor.role === 'teacher' && Number(input.responsableId) !== Number(actor.id)) throw invalid('Solo puedes asignarte tu propio seguimiento.');
    const responsible = await validateResponsible(actor, input.responsableId, transaction);
    if (responsible.role === 'teacher' && String(row.responsibleId) !== String(responsible.id)) throw invalid('Asigna primero la ficha a este docente para que pueda acceder a su seguimiento.');
    const followup = await CrmFollowup.create({ institutionId: actor.institutionId, applicationId: row.id, responsibleId: input.responsableId, dueAt: input.vence, type: input.tipo, note: input.nota || null }, { transaction });
    await row.update({ version: row.version + 1 }, { transaction });
    await auditCrm(actor, 'followup_created', row, { followupId: followup.id }, transaction);
    return followup;
  });
}

export async function finishFollowup(actor, id, followupId, input) {
  return sequelize.transaction(async (transaction) => {
    const row = await applicationInScope(actor, id, { transaction, lock: true }); expectedVersion(row, input.versionEsperada);
    const followup = await CrmFollowup.findOne({ where: { id: followupId, applicationId: row.id, ...(actor.role === 'teacher' ? { responsibleId: actor.id } : {}) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!followup) throw notFound('Seguimiento no encontrado.');
    if (followup.status !== 'pending') throw conflict('FOLLOWUP_COMPLETED', 'El seguimiento ya está cerrado.');
    await followup.update({ status: 'completed', result: input.resultado, completedAt: clock.now() }, { transaction });
    await row.update({ lastContactAt: clock.now(), version: row.version + 1 }, { transaction });
    await auditCrm(actor, 'followup_completed', row, { followupId }, transaction);
    return followup;
  });
}
