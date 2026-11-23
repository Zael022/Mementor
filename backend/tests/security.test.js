import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import { PasswordReset, User } from '../src/models/index.js';
import { sentInTests } from '../src/services/mailService.js';
import { jwtSecret, signSessionToken, verifySessionToken } from '../src/utils/jwt.js';
import { hashPassword, needsRehash, verifyPassword } from '../src/utils/security.js';
import { closeDatabase, createPlatformAdmin, loginAs, PASSWORD, prepareDatabase } from './helpers.js';

// Prueba bcrypt, el JWT de sesión y la recuperación de contraseña con datos temporales.
const scryptAsync = promisify(scrypt);

before(prepareDatabase);
after(closeDatabase);

test('las contraseñas se guardan con bcrypt y nunca en texto plano', async () => {
  const hash = await hashPassword(PASSWORD);
  assert.match(hash, /^\$2[aby]\$\d{2}\$/);
  assert.equal(hash.includes(PASSWORD), false);
  assert.equal(await verifyPassword(PASSWORD, hash), true);
  assert.equal(await verifyPassword('OtraClave2026', hash), false);
  assert.equal(needsRehash(hash), false);
});

test('el JWT lleva solo usuario, rol y sesión, vence y se rechaza si lo alteran', () => {
  const token = signSessionToken({ userId: 7, role: 'student', sessionId: 'abc' });
  const payload = verifySessionToken(token);
  assert.deepEqual([payload.sub, payload.role, payload.sid, payload.iss], ['7', 'student', 'abc', 'mentor-ai']);
  assert.ok(payload.exp > payload.iat);
  assert.equal(Object.keys(payload).some((key) => /pass|email|hash/i.test(key)), false);

  const [cabecera, cuerpo, firma] = token.split('.');
  const alterado = Buffer.from(JSON.stringify({ ...payload, role: 'platform_admin' })).toString('base64url');
  assert.equal(verifySessionToken(`${cabecera}.${alterado}.${firma}`), null);
  assert.equal(verifySessionToken(jwt.sign({ sid: 'x' }, 'otro-secreto-de-al-menos-treinta-y-dos-caracteres', { subject: '7', issuer: 'mentor-ai' })), null);
  const vencido = jwt.sign({ role: 'student', sid: 'abc' }, jwtSecret(), { subject: '7', issuer: 'mentor-ai', expiresIn: -10 });
  assert.equal(verifySessionToken(vencido), null);
  assert.ok(cuerpo);
});

test('el inicio de sesión entrega el JWT en una cookie httpOnly y el cierre de sesión lo revoca', async () => {
  await createPlatformAdmin('jwt@prueba.test');
  const respuesta = await request(app).post('/api/v1/auth/login').send({ email: 'jwt@prueba.test', password: PASSWORD });
  assert.equal(respuesta.status, 200);
  const cookie = respuesta.headers['set-cookie'].find((linea) => linea.startsWith('mentor_session='));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Expires=/i);
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(token.split('.').length, 3);
  assert.equal(verifySessionToken(token).role, 'platform_admin');
  assert.equal(JSON.stringify(respuesta.body).includes(token), false);

  const sesion = await loginAs('jwt@prueba.test');
  assert.equal((await sesion.get('/auth/me')).status, 200);
  assert.equal((await sesion.post('/auth/logout')).status, 200);
  const repetido = await request(app).get('/api/v1/auth/me').set('Cookie', `mentor_session=${token}`);
  assert.equal(repetido.status, 200);
  await request(app).post('/api/v1/auth/logout').set('Cookie', `mentor_session=${token}`)
    .set('x-csrf-token', respuesta.body.data.csrfToken);
  assert.equal((await request(app).get('/api/v1/auth/me').set('Cookie', `mentor_session=${token}`)).status, 401);
});

test('una cuenta con hash anterior (scrypt) entra y su contraseña pasa a bcrypt', async () => {
  const sal = randomBytes(16);
  const hash = await scryptAsync(PASSWORD, sal, 64, { N: 16384, r: 8, p: 1 });
  const legado = `scrypt$16384$8$1$${sal.toString('base64')}$${Buffer.from(hash).toString('base64')}`;
  const usuario = await User.create({ email: 'legado@prueba.test', displayName: 'Cuenta anterior', role: 'platform_admin', status: 'active', passwordHash: legado });
  assert.equal(needsRehash(legado), true);
  await loginAs('legado@prueba.test');
  await usuario.reload();
  assert.match(usuario.passwordHash, /^\$2/);
  await loginAs('legado@prueba.test');
});

test('recuperar la contraseña: respuesta igual exista o no la cuenta, enlace de un uso y sesiones cerradas', async () => {
  await createPlatformAdmin('olvido@prueba.test');
  const sesionAbierta = await loginAs('olvido@prueba.test');
  sentInTests.length = 0;

  const desconocido = await request(app).post('/api/v1/auth/password/forgot').send({ email: 'nadie@prueba.test' });
  const conocido = await request(app).post('/api/v1/auth/password/forgot').send({ email: 'OLVIDO@prueba.test' });
  assert.equal(desconocido.status, 200);
  assert.deepEqual(desconocido.body, conocido.body);
  assert.equal(sentInTests.length, 1);
  assert.equal(sentInTests[0].to, 'olvido@prueba.test');
  const token = sentInTests[0].text.match(/token=([a-f0-9]{64})/)[1];
  // En la base solo queda el hash del token.
  assert.equal(await PasswordReset.count({ where: { tokenHash: token } }), 0);

  const debil = await request(app).post('/api/v1/auth/password/reset').send({ token, password: 'corta' });
  assert.equal(debil.status, 422);
  const ok = await request(app).post('/api/v1/auth/password/reset').send({ token, password: 'NuevaClave2026x' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await request(app).post('/api/v1/auth/password/reset').send({ token, password: 'OtraClave2026xx' })).status, 422);
  assert.equal((await sesionAbierta.get('/auth/me')).status, 401);
  await assert.rejects(() => loginAs('olvido@prueba.test'));
  await loginAs('olvido@prueba.test', 'NuevaClave2026x');
});

// M08: dos solicitudes simultáneas con el mismo enlace: una sola contraseña queda vigente.
test('un enlace de recuperación usado dos veces a la vez solo confirma una operación', async () => {
  await createPlatformAdmin('carrera@prueba.test');
  const abierta = await loginAs('carrera@prueba.test');
  sentInTests.length = 0;
  await request(app).post('/api/v1/auth/password/forgot').send({ email: 'carrera@prueba.test' });
  const token = sentInTests[0].text.match(/token=([a-f0-9]{64})/)[1];
  const [a, b] = await Promise.all([
    request(app).post('/api/v1/auth/password/reset').send({ token, password: 'PrimeraClave2026' }),
    request(app).post('/api/v1/auth/password/reset').send({ token, password: 'SegundaClave2026' }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 422]);
  const ganadora = a.status === 200 ? 'PrimeraClave2026' : 'SegundaClave2026';
  const perdedora = ganadora === 'PrimeraClave2026' ? 'SegundaClave2026' : 'PrimeraClave2026';
  await loginAs('carrera@prueba.test', ganadora);
  await assert.rejects(() => loginAs('carrera@prueba.test', perdedora));
  assert.equal((await abierta.get('/auth/me')).status, 401);
});

test('una invitación activada dos veces a la vez solo fija una contraseña', async () => {
  await createPlatformAdmin('operador.carrera@prueba.test');
  const plataforma = await loginAs('operador.carrera@prueba.test');
  const institucion = await plataforma.post('/institutions', { name: 'Carrera de prueba' });
  const invitado = await plataforma.post(`/institutions/${institucion.body.data.id}/admins`, { email: 'admin.carrera@prueba.test', displayName: 'Admin Carrera' });
  const token = invitado.body.data.invitationToken;
  const activar = (password) => request(app).post('/api/v1/auth/activate').send({ token, password, acceptTerms: true, acceptPrivacy: true });
  const [a, b] = await Promise.all([activar('PrimeraClave2026'), activar('SegundaClave2026')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 422]);
  const ganadora = a.status === 200 ? 'PrimeraClave2026' : 'SegundaClave2026';
  await loginAs('admin.carrera@prueba.test', ganadora);
});
