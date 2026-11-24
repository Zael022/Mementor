import { Op } from 'sequelize';
import { User, UserSession, Institution, sequelize } from '../models/index.js';
import { AppError, invalid, unauthenticated } from '../utils/AppError.js';
import { jwtHours, signSessionToken, verifySessionToken } from '../utils/jwt.js';
import { createToken, hashPassword, hashToken, needsRehash, verifyDummyPassword, verifyPassword } from '../utils/security.js';
import { recordAudit } from './auditService.js';
import { acceptPolicies } from './consentService.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// Devuelve solo los datos públicos del usuario.
export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    institutionId: user.institutionId,
    institutionName: user.institution?.name ?? null,
    avatarUrl: avatarUrl(user),
  };
}

// Dirección de la foto; la fecha en la consulta obliga al navegador a pedir la nueva tras un cambio.
export function avatarUrl(user) {
  return user.avatarFile ? `/api/v1/users/${user.id}/avatar?v=${new Date(user.avatarUpdatedAt || 0).getTime()}` : null;
}

// Busca la sesión a partir del JWT de la cookie: primero valida firma y vencimiento,
// luego confirma que la sesión no se haya cerrado (así el cierre de sesión revoca el token).
export async function findSession(token) {
  const payload = verifySessionToken(token);
  if (!payload?.sid || !payload.sub) return null;
  const session = await UserSession.findOne({
    where: { tokenHash: hashToken(payload.sid), revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    include: [{ model: User, as: 'user', include: [{ model: Institution, as: 'institution' }] }],
  });
  if (!session || String(session.userId) !== payload.sub || session.user.status !== 'active') return null;
  if (session.user.institution && session.user.institution.status !== 'active') return null;
  return { session, user: session.user };
}

// Valida las credenciales y crea una sesión nueva.
export async function login({ email, password }) {
  const user = await User.findOne({ where: { email }, include: [{ model: Institution, as: 'institution' }] });
  const genericError = unauthenticated('Correo o contraseña incorrectos.');

  if (!user || user.status !== 'active' || !user.passwordHash) {
    await verifyDummyPassword(password);
    throw genericError;
  }
  if (user.institution && user.institution.status !== 'active') throw genericError;
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(429, 'RATE_LIMITED', 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    const lockedUntil = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await user.update({ failedLoginCount: lockedUntil ? 0 : failed, lockedUntil });
    throw genericError;
  }

  // La sesión guarda solo el hash de su identificador; el JWT lo lleva firmado.
  const { token: sessionId, tokenHash } = createToken();
  const csrf = createToken().token;
  const expiresAt = new Date(Date.now() + jwtHours() * 3600000);
  // Contraseñas de cuentas anteriores (scrypt) pasan a bcrypt sin que la persona note nada.
  const upgradedHash = needsRehash(user.passwordHash) && Buffer.byteLength(password, 'utf8') <= 72 ? await hashPassword(password) : null;
  await sequelize.transaction(async (transaction) => {
    await user.update({ failedLoginCount: 0, lockedUntil: null, ...(upgradedHash ? { passwordHash: upgradedHash } : {}) }, { transaction });
    await UserSession.create({ userId: user.id, tokenHash, csrfToken: csrf, expiresAt }, { transaction });
    await recordAudit({ actor: user, action: 'auth.login', resourceType: 'user', resourceId: user.id, transaction });
  });
  const token = signSessionToken({ userId: user.id, role: user.role, sessionId });
  return { token, csrfToken: csrf, expiresAt, user: publicUser(user) };
}

// Confirma la contraseña actual antes de un cambio sensible; aplica el mismo bloqueo que el inicio de sesión.
export async function confirmPassword(userId, password) {
  const user = await User.findByPk(userId);
  if (!user?.passwordHash) throw unauthenticated();
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(429, 'RATE_LIMITED', 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.');
  }
  if (!(await verifyPassword(String(password || ''), user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    const lockedUntil = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await user.update({ failedLoginCount: lockedUntil ? 0 : failed, lockedUntil });
    throw invalid('La contraseña actual no es correcta.', [{ field: 'currentPassword', message: 'La contraseña actual no es correcta.' }]);
  }
  if (user.failedLoginCount) await user.update({ failedLoginCount: 0 });
  return user;
}

// Cierra la sesión actual.
export async function logout(session) {
  await session.update({ revokedAt: new Date() });
}

// Exige contraseñas con longitud y variedad mínimas.
export function assertStrongPassword(password) {
  if (typeof password === 'string' && Buffer.byteLength(password, 'utf8') > 72) {
    throw invalid('La contraseña no puede superar 72 bytes en UTF-8.');
  }
  const ok = typeof password === 'string' && password.length >= 10 && password.length <= 200
    && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  if (!ok) throw invalid('La contraseña debe tener al menos 10 caracteres e incluir letras y números.');
}

// Activa una cuenta invitada con la contraseña elegida y la aceptación explícita de términos y privacidad.
export async function activateAccount({ token, password }) {
  assertStrongPassword(password);
  const passwordHash = await hashPassword(password);
  return sequelize.transaction(async (transaction) => {
    const user = await User.findOne({ where: { invitationTokenHash: hashToken(token), status: 'invited' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user || !user.invitationExpiresAt || user.invitationExpiresAt <= new Date()) {
      throw invalid('El enlace de invitación no es válido o ya venció.');
    }
    await user.update({ passwordHash, status: 'active', invitationTokenHash: null, invitationExpiresAt: null }, { transaction });
    await acceptPolicies(user.id, ['terms', 'privacy'], { transaction });
    await recordAudit({ actor: user, action: 'user.activated', resourceType: 'user', resourceId: user.id, transaction });
    return { email: user.email };
  });
}
