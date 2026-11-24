import { Op } from 'sequelize';
import { CrmConsent, CrmProspect, CrmApplication, CrmDraft, CrmFollowup, CrmStageEvent, CrmPrivacyCase, sequelize } from '../models/index.js';
import { prospectInScope } from './crmAccessService.js';
import { recordAudit } from './auditService.js';
import { clock } from '../utils/clock.js';
import { conflict, invalid, notFound } from '../utils/AppError.js';

export async function recordConsent(actor, id, input) {
  if (new Date(input.aceptadoEn) > clock.now()) throw invalid('La aceptación no puede ser futura.');
  return sequelize.transaction(async (transaction) => {
    const prospect = await prospectInScope(actor, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (prospect.anonymizedAt) throw conflict('ANONYMIZED', 'No se pueden añadir evidencias a una ficha anonimizada.');
    const row = await CrmConsent.create({ institutionId: actor.institutionId, prospectId: id, purpose: input.finalidad, documentVersion: input.documentoVersion, evidenceRef: input.evidencia, origin: input.origen, acceptedAt: input.aceptadoEn }, { transaction });
    await recordAudit({ actor, action: 'crm.consent_recorded', resourceType: 'crm_prospect', resourceId: id, metadata: { consentId: row.id, purpose: row.purpose }, transaction });
    return row;
  });
}

export async function revokeConsent(actor, id, consentId) {
  await prospectInScope(actor, id);
  return sequelize.transaction(async (transaction) => {
    const row = await CrmConsent.findOne({ where: { id: consentId, prospectId: id, institutionId: actor.institutionId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw notFound('Consentimiento no encontrado.');
    if (!row.revokedAt) await row.update({ revokedAt: clock.now() }, { transaction });
    await recordAudit({ actor, action: 'crm.consent_revoked', resourceType: 'crm_prospect', resourceId: id, metadata: { consentId }, transaction });
    return row;
  });
}

export async function exportCrmProspect(prospect, transaction) {
  const options = { transaction };
  const applications = await CrmApplication.findAll({ where: { prospectId: prospect.id, institutionId: prospect.institutionId }, ...options });
  const ids = applications.map((r) => r.id);
  const [events, followups, drafts, consents] = await Promise.all([
    ids.length ? CrmStageEvent.findAll({ where: { applicationId: ids }, ...options }) : [],
    ids.length ? CrmFollowup.findAll({ where: { applicationId: ids }, ...options }) : [],
    ids.length ? CrmDraft.findAll({ where: { applicationId: ids }, ...options }) : [],
    CrmConsent.findAll({ where: { prospectId: prospect.id }, ...options }),
  ]);
  return { prospect, applications, events, followups, drafts, consents };
}

export async function anonymizeCrmProspect(prospect, transaction) {
  const applications = await CrmApplication.findAll({ where: { prospectId: prospect.id }, transaction, lock: transaction.LOCK.UPDATE });
  const ids = applications.map((r) => r.id);
  if (ids.length) {
    await CrmDraft.destroy({ where: { applicationId: ids }, transaction });
    await CrmFollowup.update({ note: null, result: null, status: 'cancelled' }, { where: { applicationId: ids }, transaction });
    const events = await CrmStageEvent.findAll({ where: { applicationId: ids }, transaction });
    for (const event of events) await event.update({ reason: 'Detalle eliminado por privacidad', metadataJson: Object.fromEntries(Object.entries(event.metadataJson || {}).filter(([key]) => ['status', 'kind', 'enrollmentId'].includes(key))) }, { transaction });
    for (const application of applications) await application.update({ activityJson: {}, retentionException: null, ...(application.enrollmentId ? {} : { status: 'retirado', closedAt: clock.now() }), version: application.version + 1 }, { transaction });
  }
  await CrmConsent.update({ evidenceRef: 'Referencia eliminada por privacidad', origin: 'Origen eliminado', revokedAt: clock.now() }, { where: { prospectId: prospect.id }, transaction });
  await prospect.update({ name: 'Persona anonimizada', email: null, phone: null, utmJson: null, origin: 'Anonimizada', anonymizedAt: clock.now() }, { transaction });
}

export async function resolvePrivacy(actor, id, input) {
  if (new Date(input.verificadaEn) > clock.now()) throw invalid('La verificación no puede ser futura.');
  return sequelize.transaction(async (transaction) => {
    const prospect = await prospectInScope(actor, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (prospect.anonymizedAt && input.accion === 'correccion') throw conflict('ANONYMIZED', 'La supresión ya fue atendida. No se vuelven a guardar contactos en esta ficha.');
    let data = null;
    if (input.accion === 'acceso') data = await exportCrmProspect(prospect, transaction);
    if (input.accion === 'correccion') {
      if (!input.correccion || !Object.keys(input.correccion).length) throw invalid('Indica los datos que deben corregirse.');
      const p = input.correccion;
      const previousOrigin = prospect.origin;
      await prospect.update({ ...(p.nombre ? { name: p.nombre } : {}), ...(p.correo ? { email: p.correo } : {}), ...(p.telefono !== undefined ? { phone: p.telefono || null } : {}), ...(p.procedencia ? { origin: p.procedencia } : {}) }, { transaction });
      // Cualquier texto aprobado requiere revisión después de corregir la identidad.
      const apps = await CrmApplication.findAll({ where: { prospectId: prospect.id }, transaction });
      if (p.procedencia && p.procedencia !== previousOrigin) for (const app of apps) await CrmStageEvent.create({ institutionId: actor.institutionId, applicationId: app.id, fromStage: app.stage, toStage: app.stage, kind: 'origin_correction', reason: 'Corrección de procedencia verificada', actorId: actor.id, effectiveAt: clock.now(), recordedAt: clock.now(), metadataJson: { previousOrigin, newOrigin: p.procedencia } }, { transaction });
      if (apps.length) await CrmDraft.update({ status: 'pending', approverId: null, approvedAt: null, approvedVersion: null }, { where: { applicationId: apps.map((r) => r.id) }, transaction });
    }
    if (input.accion === 'supresion') await anonymizeCrmProspect(prospect, transaction);
    const privacyCase = await CrmPrivacyCase.create({ institutionId: actor.institutionId, prospectId: prospect.id, actorId: actor.id, action: input.accion, verificationRef: input.verificacionRef, verifiedAt: input.verificadaEn, reason: input.motivo, completedAt: clock.now() }, { transaction });
    await recordAudit({ actor, action: `crm.privacy_${input.accion}`, resourceType: 'crm_prospect', resourceId: prospect.id, metadata: { caseId: privacyCase.id }, transaction });
    return { casoId: privacyCase.id, data };
  });
}

export async function exportLinkedCrm(user, transaction) {
  const prospects = await CrmProspect.findAll({ where: { userId: user.id, institutionId: user.institutionId }, transaction });
  return Promise.all(prospects.map((p) => exportCrmProspect(p, transaction)));
}

export async function anonymizeLinkedCrm(user, transaction) {
  const prospects = await CrmProspect.findAll({ where: { userId: user.id, institutionId: user.institutionId }, transaction, lock: transaction.LOCK.UPDATE });
  for (const prospect of prospects) await anonymizeCrmProspect(prospect, transaction);
}

// Se invoca dentro del trabajo de conservación ya coordinado por job_leases.
let retentionCursor = 0;
export async function retainCrmData() {
  let prospects = await CrmProspect.findAll({ where: { anonymizedAt: null, id: { [Op.gt]: retentionCursor } }, order: [['id', 'ASC']], limit: 200 });
  if (!prospects.length) { retentionCursor = 0; prospects = await CrmProspect.findAll({ where: { anonymizedAt: null }, order: [['id', 'ASC']], limit: 200 }); }
  for (const prospect of prospects) {
    await sequelize.transaction(async (transaction) => {
      const rows = await CrmApplication.findAll({ where: { prospectId: prospect.id, institutionId: prospect.institutionId }, transaction });
      for (const row of rows) await CrmDraft.destroy({ where: { applicationId: row.id, updatedAt: { [Op.lt]: new Date(clock.now() - row.configJson.conservacionBorradoresDias * 86400000) } }, transaction });
      if (rows.length && rows.every((r) => ['retirado', 'rechazado'].includes(r.status) && !r.retentionException && r.closedAt && clock.now() - r.closedAt > r.configJson.conservacionCerradasDias * 86400000)) {
        await anonymizeCrmProspect(prospect, transaction);
        await recordAudit({ institutionId: prospect.institutionId, action: 'crm.retention_anonymized', resourceType: 'crm_prospect', resourceId: prospect.id, transaction });
      }
    });
    retentionCursor = prospect.id;
  }
}
