import bcrypt from 'bcryptjs';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Costo de bcrypt: 12 en uso normal; las pruebas usan uno bajo para ir rápido.
function bcryptRounds() {
  const configured = Number(process.env.BCRYPT_ROUNDS);
  const minimum = process.env.NODE_ENV === 'test' ? 4 : 10;
  if (Number.isInteger(configured) && configured >= minimum && configured <= 15) return configured;
  return process.env.NODE_ENV === 'test' ? 4 : 12;
}

let dummyHashPromise;
export async function verifyDummyPassword(password) {
  dummyHashPromise ||= hashPassword('valor-de-comparacion-no-utilizable');
  await verifyPassword(password, await dummyHashPromise);
}

// Genera el hash de una contraseña con bcrypt (incluye su propia sal).
export async function hashPassword(password) {
  return bcrypt.hash(String(password), bcryptRounds());
}

// Compara una contraseña con su hash guardado (bcrypt, o scrypt de cuentas anteriores).
export async function verifyPassword(password, stored) {
  try {
    const value = String(stored || '');
    if (value.startsWith('$2')) return await bcrypt.compare(String(password), value);
    return await verifyLegacyScrypt(password, value);
  } catch {
    return false;
  }
}

// Indica si un hash viene del esquema anterior y debe regenerarse con bcrypt.
export function needsRehash(stored) {
  return !String(stored || '').startsWith('$2');
}

// Hashes scrypt creados antes del cambio a bcrypt; se convierten en el siguiente inicio de sesión.
async function verifyLegacyScrypt(password, stored) {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(expected, actual);
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
