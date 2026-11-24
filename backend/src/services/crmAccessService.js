import { CrmApplication, CrmCycle, CrmProspect, User } from '../models/index.js';
import { forbidden, notFound, conflict } from '../utils/AppError.js';

export function crmScope(actor, roles = ['institution_admin']) {
  if (!actor?.institutionId || !roles.includes(actor.role)) throw forbidden('No tienes permiso para esta operación de admisiones.');
  return { institutionId: actor.institutionId };
}

export async function cycleInScope(actor, id, options = {}) {
  const row = await CrmCycle.findOne({ where: { ...crmScope(actor, ['institution_admin', 'teacher', 'auditor']), id }, ...options });
  if (!row) throw notFound('Convocatoria no encontrada.');
  return row;
}

export async function prospectInScope(actor, id, options = {}) {
  const row = await CrmProspect.findOne({ where: { ...crmScope(actor), id }, ...options });
  if (!row) throw notFound('Prospecto no encontrado.');
  return row;
}

export async function applicationInScope(actor, id, { transaction, lock = false, admin = false, allowAnonymized = false } = {}) {
  const where = { ...crmScope(actor, admin ? ['institution_admin'] : ['institution_admin', 'teacher']), id };
  if (actor.role === 'teacher') where.responsibleId = actor.id;
  const row = await CrmApplication.findOne({ where, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!row) throw notFound('Solicitud no encontrada o sin asignación.');
  if (lock && !allowAnonymized) {
    const prospect = await CrmProspect.findByPk(row.prospectId, { transaction });
    if (prospect.anonymizedAt) throw conflict('ANONYMIZED', 'La ficha fue anonimizada; no se puede volver a guardar información personal en ella.');
  }
  return row;
}

export function expectedVersion(row, version) {
  if (row.version !== version) throw conflict('STALE_VERSION', 'La ficha cambió mientras la editabas. Actualízala antes de volver a guardar; conserva los datos que escribiste.');
}

export async function validateResponsible(actor, id, transaction) {
  if (id === null) return;
  const row = await User.findOne({ where: { id, institutionId: actor.institutionId, role: ['institution_admin', 'teacher'], status: 'active' }, transaction });
  if (!row) throw notFound('Responsable no disponible en tu institución.');
  return row;
}
