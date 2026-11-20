import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { AiThread, ConsentRecord, DataDeletionRequest, User } from '../src/models/index.js';
import { sentInTests } from '../src/services/mailService.js';
import { POLICY_VERSIONS } from '../src/services/consentService.js';
import { activate, closeDatabase, createPlatformAdmin, loginAs, PASSWORD, prepareDatabase } from './helpers.js';

// Prueba consentimientos, baja con anonimización y el rol auditor de solo lectura.
const ctx = {};

async function invitar(sesion, ruta, cuerpo) {
  const invitado = await sesion.post(ruta, cuerpo);
  assert.equal(invitado.status, 201, JSON.stringify(invitado.body));
  return invitado.body.data.invitationToken;
}

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.gob@prueba.test');
  ctx.plataforma = await loginAs('operador.gob@prueba.test');
  const institucion = await ctx.plataforma.post('/institutions', { name: 'Gobernanza de prueba' });
  const tokenAdmin = await invitar(ctx.plataforma, `/institutions/${institucion.body.data.id}/admins`, { email: 'admin.gob@prueba.test', displayName: 'Admin Gob' });
  await activate(tokenAdmin);
  ctx.admin = await loginAs('admin.gob@prueba.test');
});

after(closeDatabase);

test('activar la cuenta exige aceptar términos y privacidad y deja la evidencia', async () => {
  const token = await invitar(ctx.admin, '/users', { email: 'ana.gob@prueba.test', displayName: 'Ana Gob', role: 'student' });
  const sinAceptar = await request(app).post('/api/v1/auth/activate').send({ token, password: PASSWORD });
  assert.equal(sinAceptar.status, 422);
  assert.match(JSON.stringify(sinAceptar.body), /términos y condiciones/);
  assert.equal((await activate(token)).status, 200);
  const usuario = await User.findOne({ where: { email: 'ana.gob@prueba.test' } });
  assert.deepEqual(
    (await ConsentRecord.findAll({ where: { userId: usuario.id } })).map((row) => `${row.document}@${row.version}`).sort(),
    [`privacy@${POLICY_VERSIONS.privacy}`, `terms@${POLICY_VERSIONS.terms}`],
  );
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'ana.gob@prueba.test', password: PASSWORD });
  assert.deepEqual(login.body.data.pendingConsents, []);
  assert.deepEqual((await request(app).get('/api/v1/legal/versions')).body.data, POLICY_VERSIONS);
});

test('una cuenta anterior sin aceptación ve los documentos pendientes y los acepta', async () => {
  // El administrador de plataforma se creó por consola, sin aceptar nada todavía.
  const me = await ctx.plataforma.get('/auth/me');
  assert.equal(me.body.data.pendingConsents.length, 2);
  const aceptado = await ctx.plataforma.post('/me/consents', { documents: ['terms', 'privacy'] });
  assert.deepEqual(aceptado.body.data.pending, []);
  assert.equal((await ctx.plataforma.post('/me/consents', { documents: ['otro'] })).status, 422);
});

test('la baja confirma la identidad, anonimiza, conserva lo académico, cierra la sesión y notifica', async () => {
  const ana = await loginAs('ana.gob@prueba.test');
  const usuario = await User.findOne({ where: { email: 'ana.gob@prueba.test' } });
  await AiThread.create({ userId: usuario.id, courseId: null, title: 'Conversación' }).catch(() => null);
  const copia = await ana.get('/me/data-export');
  assert.equal(copia.body.data.profile.email, 'ana.gob@prueba.test');
  assert.match(copia.headers['content-disposition'], /attachment/);

  assert.equal((await ana.post('/me/deletion-request', { password: 'Equivocada2026', confirm: true })).status, 422);
  assert.equal((await ana.post('/me/deletion-request', { password: PASSWORD })).status, 422);
  sentInTests.length = 0;
  const baja = await ana.post('/me/deletion-request', { password: PASSWORD, reason: 'Terminé el curso', confirm: true });
  assert.equal(baja.status, 202, JSON.stringify(baja.body));
  assert.equal(baja.body.data.status, 'completed');
  assert.equal(baja.body.data.notificationStatus, 'sent');
  assert.match(baja.body.data.retainedSummary, /historial académico/);

  await usuario.reload();
  assert.equal(usuario.email, `eliminado-${usuario.id}@anonimo.invalid`);
  assert.equal(usuario.displayName, 'Usuario eliminado');
  assert.equal(usuario.passwordHash, null);
  assert.ok(usuario.anonymizedAt);
  assert.equal(await AiThread.count({ where: { userId: usuario.id } }), 0);
  assert.equal(await ConsentRecord.count({ where: { userId: usuario.id } }), 2);
  assert.equal(sentInTests.at(-1).to, 'ana.gob@prueba.test');
  assert.equal((await ana.get('/auth/me')).status, 401);
  await assert.rejects(() => loginAs('ana.gob@prueba.test'));
  assert.equal(await DataDeletionRequest.count({ where: { userId: usuario.id, status: 'completed' } }), 1);
});

test('la única administración no puede darse de baja y la plataforma tampoco', async () => {
  const unica = await ctx.admin.post('/me/deletion-request', { password: PASSWORD, confirm: true });
  assert.equal(unica.status, 409);
  assert.equal((await ctx.plataforma.post('/me/deletion-request', { password: PASSWORD, confirm: true })).status, 403);
});

test('la auditoría lee bitácora y gobernanza de su institución, pero no gestiona nada', async () => {
  const token = await invitar(ctx.admin, '/users', { email: 'auditor.gob@prueba.test', displayName: 'Auditor', role: 'auditor' });
  await activate(token);
  const auditor = await loginAs('auditor.gob@prueba.test');
  assert.equal(auditor.user.role, 'auditor');

  const bitacora = await auditor.get('/audit-logs');
  assert.equal(bitacora.status, 200);
  assert.ok(bitacora.body.data.some((fila) => fila.action === 'governance.user_anonymized'));
  const solicitudes = await auditor.get('/governance/deletion-requests');
  assert.equal(solicitudes.body.data.length, 1);
  const resumen = await auditor.get('/governance/consents');
  assert.ok(resumen.body.data.accepted.every((fila) => !('email' in fila)));

  assert.equal((await auditor.get('/users')).status, 403);
  assert.equal((await auditor.post('/users', { email: 'x@prueba.test', displayName: 'X', role: 'student' })).status, 403);
  assert.equal((await auditor.post('/courses', { code: 'AUD-1', title: 'No' })).status, 403);
  assert.equal((await ctx.admin.get('/governance/deletion-requests')).status, 200);
});
