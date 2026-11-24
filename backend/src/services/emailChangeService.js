import { Op, UniqueConstraintError } from 'sequelize';
import { EmailChange, User, sequelize } from '../models/index.js';
import { conflict, invalid } from '../utils/AppError.js';
import { createToken, hashToken } from '../utils/security.js';
import { recordAudit } from './auditService.js';
import { confirmPassword } from './authService.js';
import { appUrl, assertMailConfigured, sendMail } from './mailService.js';

const CHANGE_MINUTES = 60;

const emailInUse = () => conflict('EMAIL_IN_USE', 'Ese correo ya está registrado.');

// Pide el cambio de correo: valida la contraseña, guarda la solicitud y envía el enlace a la nueva dirección.
// El correo de acceso no cambia hasta que alguien abra ese enlace, así se comprueba que la dirección es real y propia.
export async function requestEmailChange(user, { currentPassword, newEmail }) {
  assertMailConfigured();
  const row = await confirmPassword(user.id, currentPassword);
  const target = String(newEmail).toLowerCase();
  if (target === row.email) throw invalid('Ese ya es tu correo.');
  if (await User.findOne({ where: { email: target } })) throw emailInUse();

  const { token, tokenHash } = createToken();
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    // Una sola solicitud vigente por persona: las anteriores dejan de servir.
    await EmailChange.update({ usedAt: now }, { where: { userId: row.id, usedAt: null }, transaction });
    await EmailChange.create({ userId: row.id, newEmail: target, tokenHash, expiresAt: new Date(now.getTime() + CHANGE_MINUTES * 60000) }, { transaction });
    await recordAudit({ actor: user, action: 'user.email_change_requested', resourceType: 'user', resourceId: row.id, transaction });
  });

  await sendMail({
    to: target,
    subject: 'Confirma tu nuevo correo de MENTOR AI',
    text: [
      `Hola, ${row.displayName}:`,
      '',
      `Pediste usar esta dirección para entrar a MENTOR AI. El enlace vence en ${CHANGE_MINUTES} minutos y sirve una sola vez:`,
      `${appUrl()}/confirmar-correo?token=${token}`,
      '',
      'Si no lo pediste, ignora este correo: no se hará ningún cambio.',
    ].join('\n'),
  });
  // Aviso a la dirección actual por si la solicitud no la hizo la persona dueña de la cuenta.
  await sendMail({
    to: row.email,
    subject: 'Solicitud de cambio de correo en MENTOR AI',
    text: [
      `Hola, ${row.displayName}:`,
      '',
      'Se pidió cambiar el correo con el que entras a MENTOR AI. El cambio solo se aplica si se confirma desde la nueva dirección.',
      'Si no fuiste tú, cambia tu contraseña y avisa a la administración de tu institución.',
    ].join('\n'),
  });
  return { pending: true, newEmail: target, expiresInMinutes: CHANGE_MINUTES };
}

// Aplica el cambio con un token vigente. El token se consume con una actualización condicionada:
// si el enlace se abre dos veces a la vez, solo una solicitud cambia el correo.
export async function confirmEmailChange({ token }) {
  const failure = () => invalid('El enlace no es válido o ya venció. Pide el cambio de nuevo desde tu perfil.');
  const tokenHash = hashToken(token);
  let previous;
  let user;
  try {
    await sequelize.transaction(async (transaction) => {
      const now = new Date();
      const change = await EmailChange.findOne({ where: { tokenHash }, lock: transaction.LOCK.UPDATE, transaction });
      if (!change) throw failure();
      const [consumed] = await EmailChange.update(
        { usedAt: now },
        { where: { id: change.id, usedAt: null, expiresAt: { [Op.gt]: now } }, transaction },
      );
      if (consumed !== 1) throw failure();
      user = await User.findByPk(change.userId, { lock: transaction.LOCK.UPDATE, transaction });
      if (!user || user.status !== 'active') throw failure();
      if (await User.findOne({ where: { email: change.newEmail, id: { [Op.ne]: user.id } }, transaction })) throw emailInUse();
      previous = user.email;
      await user.update({ email: change.newEmail }, { transaction });
      // Sin guardar los correos en la auditoría: basta con saber que cambió.
      await recordAudit({ actor: user, action: 'user.email_changed', resourceType: 'user', resourceId: user.id, transaction });
    });
  } catch (error) {
    // Otra cuenta pudo tomar el correo entre la solicitud y la confirmación.
    if (error instanceof UniqueConstraintError) throw emailInUse();
    throw error;
  }
  if (previous && previous !== user.email) {
    await sendMail({
      to: previous,
      subject: 'Tu correo de MENTOR AI cambió',
      text: [
        `Hola, ${user.displayName}:`,
        '',
        'El correo con el que entras a MENTOR AI se cambió a otra dirección confirmada.',
        'Si no fuiste tú, contacta de inmediato a la administración de tu institución.',
      ].join('\n'),
    }).catch(() => {});
  }
  return { email: user.email };
}
