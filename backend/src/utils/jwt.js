import jwt from 'jsonwebtoken';

const ISSUER = 'mentor-ai';
const TEST_SECRET = 'secreto-solo-para-pruebas-automaticas-0001';

// Secreto para firmar los tokens; es obligatorio fuera de las pruebas y debe ser largo.
export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'test') return TEST_SECRET;
  throw new Error('Configura JWT_SECRET en backend/.env (mínimo 32 caracteres).');
}

// Horas de vida del token (JWT_EXPIRES_HOURS; antes SESSION_TTL_HOURS).
export function jwtHours() {
  const hours = Number(process.env.JWT_EXPIRES_HOURS || process.env.SESSION_TTL_HOURS || 8);
  return Number.isFinite(hours) && hours > 0 && hours <= 72 ? hours : 8;
}

// Firma un token con lo mínimo para identificar la sesión: usuario, rol y sesión. Nunca datos sensibles.
export function signSessionToken({ userId, role, sessionId }) {
  return jwt.sign({ role, sid: sessionId }, jwtSecret(), {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: ISSUER,
    expiresIn: Math.round(jwtHours() * 3600),
  });
}

// Verifica firma, emisor y vencimiento; devuelve null si el token no sirve.
export function verifySessionToken(token) {
  try {
    const payload = jwt.verify(String(token), jwtSecret(), { algorithms: ['HS256'], issuer: ISSUER });
    if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string'
      || typeof payload.sid !== 'string' || !payload.sid || !Number.isInteger(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}
