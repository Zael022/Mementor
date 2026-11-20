import * as profileService from '../services/profileService.js';
import { readId } from '../utils/http.js';

// --- Datos personales propios ---
export async function getProfile(req, res) {
  res.json({ data: await profileService.getMyProfile(req.user) });
}

export async function updateProfile(req, res) {
  res.json({ data: await profileService.updateProfile(req.user, req.body) });
}

export async function changePassword(req, res) {
  res.json({ data: await profileService.changePassword(req.user, req.session, req.body) });
}

export async function changeEmail(req, res) {
  res.json({ data: await profileService.changeEmail(req.user, req.body) });
}

// --- Foto de perfil ---
export async function uploadAvatar(req, res) {
  res.json({ data: await profileService.setAvatar(req.user, req.file) });
}

export async function deleteAvatar(req, res) {
  res.json({ data: await profileService.removeAvatar(req.user) });
}

// Se sirve como imagen con tipo fijo, sin poder interpretarse como página ni script.
export async function avatar(req, res) {
  const { filePath, contentType } = await profileService.getAvatarFile(req.user, readId(req.params.userId));
  res.set({
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
    'Cache-Control': 'private, max-age=86400',
  });
  res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Foto no encontrada.' } });
  });
}
