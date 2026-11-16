import { AuditLog, User } from '../models/index.js';
import { pageMeta } from '../utils/http.js';

// Registra una acción sensible sin guardar datos privados.
export async function recordAudit({ actor, institutionId, action, resourceType, resourceId = null, metadata = null, transaction }) {
  await AuditLog.create({
    institutionId: institutionId ?? actor?.institutionId ?? null,
    actorId: actor?.id ?? null,
    action,
    resourceType,
    resourceId,
    metadataJson: metadata,
  }, { transaction });
}

// Consulta la bitácora de la institución del usuario.
export async function listAudit(user, pagination) {
  const where = { institutionId: user.role === 'platform_admin' ? null : user.institutionId };
  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'displayName'] }],
    order: [['id', 'DESC']],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  const data = rows.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    actor: row.actor ? { id: row.actor.id, displayName: row.actor.displayName } : null,
    metadata: row.metadataJson,
    createdAt: row.createdAt,
  }));
  return { data, meta: pageMeta(pagination, count) };
}
