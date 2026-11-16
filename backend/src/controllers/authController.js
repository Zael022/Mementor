import * as authService from '../services/authService.js';
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
  res.json({ data: { user: result.user, csrfToken: result.csrfToken } });
}

// Cierra la sesión actual.
export async function logout(req, res) {
  await authService.logout(req.session);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ data: { ok: true } });
}

// Devuelve el perfil y el token CSRF de la sesión.
export function me(req, res) {
  res.json({ data: { user: authService.publicUser(req.user), csrfToken: req.session.csrfToken } });
}

export function csrf(req, res) {
  res.json({ data: { csrfToken: req.session?.csrfToken ?? null } });
}

// Activa una cuenta invitada.
export async function activate(req, res) {
  res.json({ data: await authService.activateAccount(req.body) });
}
