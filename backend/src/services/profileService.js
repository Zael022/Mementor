import path from 'node:path';
import { Op } from 'sequelize';
import { User, UserSession, sequelize } from '../models/index.js';
import { avatarContentType, avatarDir } from '../middlewares/upload.js';
import { conflict, invalid, notFound } from '../utils/AppError.js';
import { matchesSignature } from '../utils/fileSignature.js';
import { hashPassword } from '../utils/security.js';
import { recordAudit } from './auditService.js';
import { discardUpload, persistUpload, readStored, removeStored } from './fileStore.js';
import { assertStrongPassword, avatarUrl, confirmPassword } from './authService.js';

const AVATAR_NAME = /^[0-9a-f]{32}\.(png|jpe?g|webp)$/;
// MySQL guarda la fecha sin milisegundos; se redondea para que la dirección de la foto no cambie al releerla.
const nowToSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

// Datos personales propios (el correo y el rol se muestran, el rol no se edita aquí).
function profileDto(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    bio: user.bio,
    email: user.email,
    role: user.role,
    avatarUrl: avatarUrl(user),
  };
}

export async function getMyProfile(user) {
  return profileDto(await User.findByPk(user.id));
}

// Guarda solo los campos enviados; un texto vacío borra el dato opcional.
export async function updateProfile(user, changes) {
  const row = await User.findByPk(user.id);
  const values = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value === '' ? null : value]));
  await sequelize.transaction(async (transaction) => {
    await row.update(values, { transaction });
    // La auditoría registra qué campos cambiaron, no sus valores.
    await recordAudit({ actor: user, action: 'user.profile_updated', resourceType: 'user', resourceId: user.id, metadata: { fields: Object.keys(values) }, transaction });
  });
  return profileDto(row);
}

// Cambia la contraseña con la actual y cierra las demás sesiones abiertas.
export async function changePassword(user, session, { currentPassword, newPassword }) {
  const row = await confirmPassword(user.id, currentPassword);
  assertStrongPassword(newPassword);
  if (currentPassword === newPassword) throw invalid('La nueva contraseña debe ser distinta de la actual.');
  const passwordHash = await hashPassword(newPassword);
  let closed = 0;
  await sequelize.transaction(async (transaction) => {
    await row.update({ passwordHash }, { transaction });
    [closed] = await UserSession.update({ revokedAt: new Date() }, {
      where: { userId: user.id, revokedAt: null, id: { [Op.ne]: session.id } }, transaction,
    });
    await recordAudit({ actor: user, action: 'user.password_changed', resourceType: 'user', resourceId: user.id, metadata: { otherSessionsClosed: closed }, transaction });
  });
  return { otherSessionsClosed: closed };
}

// Cambia el correo de acceso confirmando con la contraseña.
export async function changeEmail(user, { currentPassword, newEmail }) {
  const row = await confirmPassword(user.id, currentPassword);
  if (newEmail === row.email) throw invalid('Ese ya es tu correo.');
  if (await User.findOne({ where: { email: newEmail } })) throw conflict('EMAIL_IN_USE', 'Ese correo ya está registrado.');
  await sequelize.transaction(async (transaction) => {
    await row.update({ email: newEmail }, { transaction });
    // Sin guardar los correos en la auditoría: basta con saber que cambió.
    await recordAudit({ actor: user, action: 'user.email_changed', resourceType: 'user', resourceId: user.id, transaction });
  });
  return profileDto(row);
}

async function removeAvatarFile(name) {
  if (name && AVATAR_NAME.test(name)) await removeStored('avatars', name).catch(() => {});
}

// Guarda la foto nueva si su contenido es realmente una imagen permitida; borra la anterior.
export async function setAvatar(user, file) {
  if (!file) throw invalid('Elige una imagen PNG, JPG o WebP de hasta 2 MB.');
  const filePath = path.join(avatarDir(), file.filename);
  if (!(await matchesSignature(filePath, path.extname(file.filename)))) {
    await discardUpload('avatars', file.filename);
    throw invalid('El archivo no es una imagen PNG, JPG o WebP válida.');
  }
  const row = await User.findByPk(user.id);
  const previous = row.avatarFile;
  try {
    await persistUpload('avatars', file.filename);
    await row.update({ avatarFile: file.filename, avatarUpdatedAt: nowToSecond() });
  } catch (error) {
    await discardUpload('avatars', file.filename);
    throw error;
  }
  await removeAvatarFile(previous);
  await recordAudit({ actor: user, action: 'user.avatar_updated', resourceType: 'user', resourceId: user.id });
  return { avatarUrl: avatarUrl(row) };
}

export async function removeAvatar(user) {
  const row = await User.findByPk(user.id);
  const previous = row.avatarFile;
  await row.update({ avatarFile: null, avatarUpdatedAt: nowToSecond() });
  await removeAvatarFile(previous);
  return { avatarUrl: null };
}

// La foto solo la ve la propia persona o alguien de su misma institución.
export async function getAvatarFile(viewer, userId) {
  const target = userId ? await User.findByPk(userId, { attributes: ['id', 'institutionId', 'avatarFile'] }) : null;
  const sameInstitution = target && viewer.institutionId && target.institutionId === viewer.institutionId;
  if (!target || !target.avatarFile || !AVATAR_NAME.test(target.avatarFile) || (target.id !== viewer.id && !sameInstitution)) {
    throw notFound('Foto no encontrada.');
  }
  return { buffer: await readStored('avatars', target.avatarFile), contentType: avatarContentType(target.avatarFile) };
}
