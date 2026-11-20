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
  };
}

function newInvitation() {
  const { token, tokenHash } = createToken();
  return { token, tokenHash, expiresAt: new Date(Date.now() + INVITATION_HOURS * 3600000) };
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

  const invitation = newInvitation();
  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({
      institutionId: institution.id,
      email,
      displayName,
      role,
      status: 'invited',
      invitationTokenHash: invitation.tokenHash,
      invitationExpiresAt: invitation.expiresAt,
    }, { transaction });
    await recordAudit({
      actor, institutionId: institution.id, action: 'user.invited', resourceType: 'user', resourceId: created.id, metadata: { role }, transaction,
    });
    return created;
  });
  return { user: toDto(user), invitationToken: invitation.token, invitationExpiresAt: invitation.expiresAt };
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
  const user = await findInScope(actor, userId);
  if (user.status !== 'invited') throw conflict('ALREADY_ACTIVE', 'La cuenta ya fue activada.');
  const invitation = newInvitation();
  await user.update({ invitationTokenHash: invitation.tokenHash, invitationExpiresAt: invitation.expiresAt });
  await recordAudit({ actor, institutionId: user.institutionId, action: 'user.invitation_renewed', resourceType: 'user', resourceId: user.id });
  return { user: toDto(user), invitationToken: invitation.token, invitationExpiresAt: invitation.expiresAt };
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
