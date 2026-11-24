import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyDummyPassword, verifyPassword } from '../src/utils/security.js';
import { jwtSecret, signSessionToken, verifySessionToken } from '../src/utils/jwt.js';

test('el coste de bcrypt no baja de diez fuera del entorno de pruebas', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldRounds = process.env.BCRYPT_ROUNDS;
  try {
    process.env.NODE_ENV = 'development';
    process.env.BCRYPT_ROUNDS = '4';
    const hash = await hashPassword('frase local de prueba');
    assert.equal(Number(hash.split('$')[2]), 12);
    assert.equal(await verifyPassword('frase local de prueba', hash), true);
    assert.equal(await verifyPassword('otra frase de prueba', hash), false);
  } finally {
    if (oldEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv;
    if (oldRounds === undefined) delete process.env.BCRYPT_ROUNDS; else process.env.BCRYPT_ROUNDS = oldRounds;
  }
});

test('la comparación ficticia acepta entradas sin crear una sesión', async () => {
  await assert.doesNotReject(() => verifyDummyPassword('entrada de prueba'));
});

test('la sesión exige vencimiento, sujeto e identificador', () => {
  const valid = signSessionToken({ userId: 1, role: 'student', sessionId: 'sesion-prueba' });
  assert.ok(verifySessionToken(valid));
  const noExpiry = jwt.sign({ sid: 'sesion-prueba' }, jwtSecret(), { subject: '1', issuer: 'mentor-ai' });
  const noSid = jwt.sign({}, jwtSecret(), { subject: '1', issuer: 'mentor-ai', expiresIn: '1h' });
  assert.equal(verifySessionToken(noExpiry), null);
  assert.equal(verifySessionToken(noSid), null);
});
