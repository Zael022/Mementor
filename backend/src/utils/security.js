import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const COSTO = { N: 16384, r: 8, p: 1 };

// Genera el hash de una contraseña con scrypt y sal aleatoria.
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, COSTO);
  return `scrypt$${COSTO.N}$${COSTO.r}$${COSTO.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Compara una contraseña con su hash guardado.
export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// Crea un token aleatorio y el hash que se guarda en la base.
export function createToken() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}
