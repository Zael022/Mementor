import { Op } from 'sequelize';
import { PasswordReset, User, UserSession, sequelize } from '../models/index.js';
import { invalid } from '../utils/AppError.js';
import { createToken, hashPassword, hashToken } from '../utils/security.js';
import { recordAudit } from './auditService.js';
import { assertStrongPassword } from './authService.js';
import { appUrl, assertMailConfigured, sendMail } from './mailService.js';

const RESET_MINUTES = 60;

// Envía el enlace de restablecimiento; la respuesta es la misma exista o no la cuenta, para no revelar correos.
export async function requestReset(email) {
  assertMailConfigured();
  const user = await User.findOne({ where: { email: String(email).toLowerCase(), status: 'active' } });
  if (!user) return;
  const { token, tokenHash } = createToken();
  await PasswordReset.create({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_MINUTES * 60000) });
  await sendMail({
    to: user.email,
    subject: 'Restablece tu contraseña de MENTOR AI',
    text: [
      `Hola, ${user.displayName}:`,
      '',
      `Recibimos una solicitud para restablecer tu contraseña. El enlace vence en ${RESET_MINUTES} minutos y sirve una sola vez:`,
      `${appUrl()}/restablecer?token=${token}`,
      '',
      'Si no la pediste, ignora este correo: tu contraseña no cambia.',
    ].join('\n'),
  });
  await recordAudit({ actor: user, action: 'auth.password_reset_requested', resourceType: 'user', resourceId: user.id });
}

// Cambia la contraseña con un token vigente y cierra todas las sesiones abiertas.
export async function resetPassword({ token, password }) {
  assertStrongPassword(password);
  const reset = await PasswordReset.findOne({
    where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { [Op.gt]: new Date() } },
  });
  const user = reset ? await User.findByPk(reset.userId) : null;
  if (!user || user.status !== 'active') throw invalid('El enlace no es válido o ya venció. Solicita uno nuevo.');
  await sequelize.transaction(async (transaction) => {
    await user.update({ passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null }, { transaction });
    await reset.update({ usedAt: new Date() }, { transaction });
    // Invalida otros enlaces pendientes y las sesiones, por si alguien más tenía acceso.
    await PasswordReset.update({ usedAt: new Date() }, { where: { userId: user.id, usedAt: null }, transaction });
    await UserSession.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
    await recordAudit({ actor: user, action: 'auth.password_reset', resourceType: 'user', resourceId: user.id, transaction });
  });
}
