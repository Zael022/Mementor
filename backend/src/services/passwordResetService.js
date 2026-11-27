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
    subject: 'Restablece tu contraseña de MENTOR IA',
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
// El token se consume con una actualización condicionada dentro de la transacción: si dos solicitudes
// llegan a la vez con el mismo enlace, solo una afecta la fila y la otra recibe el mismo error que un enlace usado.
export async function resetPassword({ token, password }) {
  assertStrongPassword(password);
  const passwordHash = await hashPassword(password);
  const tokenHash = hashToken(token);
  const failure = () => invalid('El enlace no es válido o ya venció. Solicita uno nuevo.');
  await sequelize.transaction(async (transaction) => {
    const now = new Date();
    const reset = await PasswordReset.findOne({ where: { tokenHash }, lock: transaction.LOCK.UPDATE, transaction });
    if (!reset) throw failure();
    const [consumed] = await PasswordReset.update(
      { usedAt: now },
      { where: { id: reset.id, usedAt: null, expiresAt: { [Op.gt]: now } }, transaction },
    );
    if (consumed !== 1) throw failure();
    const user = await User.findByPk(reset.userId, { lock: transaction.LOCK.UPDATE, transaction });
    if (!user || user.status !== 'active') throw failure();
    await user.update({ passwordHash, failedLoginCount: 0, lockedUntil: null }, { transaction });
    // Invalida otros enlaces pendientes y las sesiones, por si alguien más tenía acceso.
    await PasswordReset.update({ usedAt: now }, { where: { userId: user.id, usedAt: null }, transaction });
    await UserSession.update({ revokedAt: now }, { where: { userId: user.id, revokedAt: null }, transaction });
    await recordAudit({ actor: user, action: 'auth.password_reset', resourceType: 'user', resourceId: user.id, transaction });
  });
}
