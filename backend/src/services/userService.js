import { User, Institution, UserSession, sequelize } from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { createToken } from '../utils/security.js';
import { pageMeta } from '../utils/http.js';
import { recordAudit } from './auditService.js';

const INVITATION_HOURS = 72;
const INSTITUTION_ROLES = ['institution_admin', 'teacher', 'student', 'auditor'];

function toDto(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    institutionId: user.institutionId,
    createdAt: user.createdAt,
    invitationExpiresAt: user.status === 'invited' ? user.invitationExpiresAt : null,
  };
}

export function newInvitation() {
  const { token, tokenHash } = createToken();
  return { token, tokenHash, expiresAt: new Date(Date.now() + INVITATION_HOURS * 3600000) };
}

// Se usa también en la conversión del CRM, dentro de la transacción de quien llama.
export async function createInvitedUser(actor, { institutionId, email, displayName, role }, transaction) {
  const invitation = newInvitation();
  const user = await User.create({ institutionId, email, displayName, role, status: 'invited', invitationTokenHash: invitation.tokenHash, invitationExpiresAt: invitation.expiresAt }, { transaction });
  await recordAudit({ actor, institutionId, action: 'user.invited', resourceType: 'user', resourceId: user.id, metadata: { role }, transaction });
  return { user, invitationToken: invitation.token, invitationExpiresAt: invitation.expiresAt };
}

// Lista los usuarios de la institución del administrador.
export async function listUsers(actor, { role, pagination }) {
  const where = { institutionId: actor.institutionId };
  if (role && INSTITUTION_ROLES.includes(role)) where.role = role;
  const { rows, count } = await User.findAndCountAll({
    where,
    order: [['displayName', 'ASC']],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return { data: rows.map(toDto), meta: pageMeta(pagination, count) };
}

// Crea una cuenta invitada; la persona define su contraseña con el enlace.
export async function inviteUser(actor, { email, displayName, role, institutionId }) {
  const targetInstitutionId = actor.role === 'platform_admin' ? institutionId : actor.institutionId;
  if (actor.role === 'platform_admin' && role !== 'institution_admin') {
    throw forbidden('El administrador de plataforma solo puede invitar administradores de institución.');
  }
  if (!INSTITUTION_ROLES.includes(role)) throw invalid('Rol no permitido.');
  const institution = await Institution.findByPk(targetInstitutionId);
  if (!institution) throw notFound('Institución no encontrada.');
  if (await User.findOne({ where: { email } })) throw conflict('EMAIL_IN_USE', 'Ya existe una cuenta con ese correo.');

  const result = await sequelize.transaction((transaction) => createInvitedUser(actor, { institutionId: institution.id, email, displayName, role }, transaction));
  return { ...result, user: toDto(result.user) };
}

async function findInScope(actor, userId) {
  const user = await User.findByPk(userId);
  const sameInstitution = user && user.institutionId === actor.institutionId;
  const platformScope = user && actor.role === 'platform_admin' && user.role === 'institution_admin';
  if (!user || !(sameInstitution || platformScope)) throw notFound('Usuario no encontrado.');
  return user;
}

// Genera un enlace nuevo para una cuenta que aún no se activa.
export async function renewInvitation(actor, userId) {
  await findInScope(actor, userId);
  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (user.status !== 'invited') throw conflict('ALREADY_ACTIVE', 'La cuenta ya fue activada o deshabilitada.');
    // Dos renovaciones simultáneas no invalidan dos enlaces seguidos.
    const [recent] = await sequelize.query('SELECT id FROM audit_logs WHERE resource_type = :type AND resource_id = :id AND action = :action AND created_at > :since LIMIT 1', { replacements: { type: 'user', id: user.id, action: 'user.invitation_renewed', since: new Date(Date.now() - 30000) }, transaction });
    if (recent.length) throw conflict('INVITATION_RECENT', 'El enlace se acaba de renovar. Usa el enlace mostrado o espera 30 segundos para renovarlo.');
    const invitation = newInvitation();
    await user.update({ invitationTokenHash: invitation.tokenHash, invitationExpiresAt: invitation.expiresAt }, { transaction });
    await recordAudit({ actor, institutionId: user.institutionId, action: 'user.invitation_renewed', resourceType: 'user', resourceId: user.id, transaction });
    return { user: toDto(user), invitationToken: invitation.token, invitationExpiresAt: invitation.expiresAt };
  });
}

// Actualiza el nombre o habilita/deshabilita una cuenta.
export async function updateUser(actor, userId, { displayName, status }) {
  const user = await findInScope(actor, userId);
  if (user.id === actor.id && status === 'disabled') throw invalid('No puedes deshabilitar tu propia cuenta.');
  if (status === 'active' && !user.passwordHash) throw invalid('La cuenta aún no ha sido activada por la persona invitada.');

  await sequelize.transaction(async (transaction) => {
    await user.update({ ...(displayName ? { displayName } : {}), ...(status ? { status } : {}) }, { transaction });
    if (status === 'disabled') {
      await UserSession.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
    }
    await recordAudit({
      actor, institutionId: user.institutionId, action: 'user.updated', resourceType: 'user', resourceId: user.id, metadata: { status: status ?? null }, transaction,
    });
  });
  return toDto(user);
}
