import { findSession } from '../services/authService.js';
import { forbidden, unauthenticated } from '../utils/AppError.js';
import { safeEqual } from '../utils/security.js';

export const SESSION_COOKIE = 'mentor_session';

// Carga la sesión del usuario si la cookie es válida.
export async function loadSession(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const found = await findSession(token);
    if (found) {
      req.session = found.session;
      req.user = found.user;
    }
  }
  next();
}

// Exige una sesión activa.
export function requireAuth(req, res, next) {
  if (!req.user) throw unauthenticated();
  next();
}

// Exige uno de los roles indicados.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) throw unauthenticated();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

// Protege las operaciones de escritura contra CSRF.
export function csrfProtection(allowedOrigins) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !allowedOrigins.includes(origin)) throw forbidden('Origen no permitido.');
    if (req.session && !safeEqual(req.get('x-csrf-token'), req.session.csrfToken)) {
      throw forbidden('Token CSRF inválido o ausente.');
    }
    next();
  };
}
