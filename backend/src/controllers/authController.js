import * as authService from '../services/authService.js';
import * as demoService from '../services/demoService.js';
import * as emailChangeService from '../services/emailChangeService.js';
import * as passwordResetService from '../services/passwordResetService.js';
import { pendingConsents } from '../services/consentService.js';
import { SESSION_COOKIE } from '../middlewares/auth.js';

const cookieOptions = (expires) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires,
});

// Inicia sesión y entrega la cookie segura.
export async function login(req, res) {
  const result = await authService.login(req.body);
  res.cookie(SESSION_COOKIE, result.token, cookieOptions(result.expiresAt));
  res.json({ data: { user: result.user, csrfToken: result.csrfToken, pendingConsents: await pendingConsents(result.user.id) } });
}

// Indica si el modo de prueba está encendido y con qué roles se puede entrar rápido.
export async function demoInfo(req, res) {
  res.json({ data: demoService.demoInfo() });
}

// Acceso rápido con una cuenta de prueba (solo con DEMO_MODE encendido).
export async function demoLogin(req, res) {
  const result = await demoService.demoLogin(req.body.role);
  res.cookie(SESSION_COOKIE, result.token, cookieOptions(result.expiresAt));
  res.json({ data: { user: result.user, csrfToken: result.csrfToken, pendingConsents: await pendingConsents(result.user.id) } });
}

// Cierra la sesión actual.
export async function logout(req, res) {
  await authService.logout(req.session);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ data: { ok: true } });
}

// Devuelve el perfil, el token CSRF y los documentos que faltan por aceptar.
export async function me(req, res) {
  res.json({ data: { user: authService.publicUser(req.user), csrfToken: req.session.csrfToken, pendingConsents: await pendingConsents(req.user.id) } });
}

export function csrf(req, res) {
  res.json({ data: { csrfToken: req.session?.csrfToken ?? null } });
}

// Activa una cuenta invitada.
export async function activate(req, res) {
  res.json({ data: await authService.activateAccount(req.body) });
}

// Pide el enlace para restablecer la contraseña; la respuesta no revela si el correo existe.
export async function forgotPassword(req, res) {
  await passwordResetService.requestReset(req.body.email);
  res.json({ data: { ok: true, message: 'Si el correo pertenece a una cuenta activa, enviamos un enlace para restablecer la contraseña.' } });
}

// Cambia la contraseña con el enlace recibido.
export async function resetPassword(req, res) {
  await passwordResetService.resetPassword(req.body);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ data: { ok: true } });
}

// Confirma el nuevo correo con el enlace enviado a esa dirección.
export async function confirmEmail(req, res) {
  res.json({ data: await emailChangeService.confirmEmailChange(req.body) });
}
