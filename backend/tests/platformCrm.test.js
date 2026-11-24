import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Institution, PlatformCrmAccount, PlatformCrmContact, User } from '../src/models/index.js';
import { activate, closeDatabase, createPlatformAdmin, loginAs, prepareDatabase, setupInstitution } from './helpers.js';

const ctx = {};
before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.plataforma@prueba.test');
  ctx.platform = await loginAs('operador.plataforma@prueba.test');
  ctx.org = await setupInstitution(ctx.platform, 'Relación A');
  ctx.other = await setupInstitution(ctx.platform, 'Relación B');
  const invited = await ctx.org.admin.post('/users', { email: 'auditor.relacion@prueba.test', displayName: 'Auditor', role: 'auditor' });
  await activate(invited.body.data.invitationToken);
  ctx.auditor = await loginAs('auditor.relacion@prueba.test');
});
after(closeDatabase);

test('el módulo es exclusivo de plataforma y leer no crea fichas', async () => {
  for (const session of [ctx.org.admin, ctx.org.teacher, ctx.org.student, ctx.auditor]) {
    assert.equal((await session.get('/platform-crm/institutions')).status, 403);
    assert.equal((await session.post(`/platform-crm/institutions/${ctx.org.institutionId}/account`)).status, 403);
  }
  const list = await ctx.platform.get('/platform-crm/institutions');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 2);
  assert.ok(list.body.data.every((row) => row.account === null));
  assert.equal(await PlatformCrmAccount.count(), 0);
});

test('configuración simultánea es idempotente y no crea instituciones', async () => {
  const url = `/platform-crm/institutions/${ctx.org.institutionId}/account`;
  const responses = await Promise.all([ctx.platform.post(url), ctx.platform.post(url)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);
  assert.equal(responses[0].body.data.id, responses[1].body.data.id);
  assert.equal(await PlatformCrmAccount.count(), 1);
  assert.equal(await Institution.count(), 2);
});

test('contactos no crean usuarios y la auditoría institucional no expone la actividad interna', async () => {
  const users = await User.count();
  const url = `/platform-crm/institutions/${ctx.org.institutionId}/contacts`;
  const data = { requestKey: randomUUID(), name: 'Contacto profesional', email: 'contacto@prueba.test' };
  const created = await ctx.platform.post(url, data);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await ctx.platform.post(url, data)).status, 201);
  assert.equal((await ctx.platform.post(url, { ...data, name: 'Otro contacto' })).status, 409);
  assert.equal(await User.count(), users);
  assert.equal(await PlatformCrmContact.count(), 1);
  assert.equal((await ctx.platform.get(`/platform-crm/institutions/${ctx.other.institutionId}/contacts`)).status, 404);
  assert.equal((await ctx.platform.post(url, { name: 'Contacto', actorId: 2 })).status, 422);
  const logs = await ctx.org.admin.get('/audit-logs');
  assert.equal(logs.status, 200);
  assert.equal(logs.body.data.some((row) => row.action.startsWith('platform_crm.')), false);
});

test('versión obsoleta no sobrescribe y el estado institucional no cambia', async () => {
  const path = `/platform-crm/institutions/${ctx.org.institutionId}/account`;
  assert.equal((await ctx.platform.patch(path, { version: 1, needs: 'Seguimiento interno' })).status, 200);
  assert.equal((await ctx.platform.patch(path, { version: 1, needs: 'Cambio obsoleto' })).status, 409);
  assert.equal((await ctx.platform.patch(path, { version: 2, onboardingStatus: 'completed' })).status, 422);
  assert.equal((await Institution.findByPk(ctx.org.institutionId)).status, 'active');
});
