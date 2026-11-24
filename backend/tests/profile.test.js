import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse, PASSWORD, request, app } from './helpers.js';
import { EmailChange, User } from '../src/models/index.js';
import { sentInTests } from '../src/services/mailService.js';

const tokenFrom = (message) => message.text.match(/token=([a-f0-9]{64})/)[1];
import { avatarDir } from '../src/middlewares/upload.js';

// Datos personales, contraseña, correo y foto de perfil con datos temporales.
const ctx = {};
// PNG mínimo válido de 1×1 px.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const NUEVA = 'OtraClave2026segura';

const subirFoto = (sesion, contenido, filename, contentType) => sesion.agent.post('/api/v1/me/avatar')
  .set('x-csrf-token', sesion.csrf).attach('avatar', contenido, { filename, contentType });

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.perfil@prueba.test');
  const platform = await loginAs('operador.perfil@prueba.test');
  ctx.org = await setupInstitution(platform, 'Perfil A');
  ctx.otra = await setupInstitution(platform, 'Perfil B');
  const { courseId } = await setupCourse(ctx.org, 'PERF-1');
  ctx.courseId = courseId;
  ctx.companera = await ctx.org.invite(ctx.org.admin, '/users', { email: 'companera.perfil@prueba.test', displayName: 'Compañera', role: 'student' });
  await ctx.org.teacher.post(`/courses/${courseId}/enrollments`, { studentId: ctx.companera.user.id });
});

after(closeDatabase);

test('cada persona edita sus datos personales; un texto vacío borra el dato', async () => {
  const yo = ctx.org.student;
  const inicial = await yo.get('/me/profile');
  assert.equal(inicial.status, 200);
  assert.equal(inicial.body.data.phone, null);

  const cambio = await yo.patch('/me/profile', { firstName: 'Ana', lastName: 'Rojas Vega', phone: '+506 8888-1234', bio: 'Me gusta el álgebra.' });
  assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
  assert.deepEqual([cambio.body.data.firstName, cambio.body.data.lastName, cambio.body.data.phone], ['Ana', 'Rojas Vega', '+506 8888-1234']);

  assert.equal((await yo.patch('/me/profile', { phone: 'llámame' })).status, 422);
  assert.equal((await yo.patch('/me/profile', { role: 'teacher' })).status, 422);
  assert.equal((await yo.patch('/me/profile', { email: 'otro@prueba.test' })).status, 422);
  assert.equal((await yo.patch('/me/profile', { lastName: '' })).body.data.lastName, null);
  // La auditoría guarda qué campos cambiaron, no los valores.
  assert.equal(JSON.stringify((await User.findByPk(yo.user.id)).toJSON()).includes('8888'), true);
});

test('los compañeros ven foto y presentación, pero no el teléfono ni el correo', async () => {
  const personas = await ctx.companera.get(`/courses/${ctx.courseId}/people`);
  const ana = personas.body.data.students.find((persona) => persona.id === ctx.org.student.user.id);
  assert.equal(ana.bio, 'Me gusta el álgebra.');
  assert.equal('phone' in ana, false);
  assert.equal('email' in ana, false);
});

test('la foto se valida por contenido, se sirve como imagen y solo dentro de la institución', async () => {
  const yo = ctx.org.student;
  const falsa = await subirFoto(yo, Buffer.from('<script>alert(1)</script>'), 'foto.png', 'image/png');
  assert.equal(falsa.status, 422);
  assert.equal((await subirFoto(yo, Buffer.from('<svg/>'), 'foto.svg', 'image/svg+xml')).status, 422);

  const subida = await subirFoto(yo, PNG, 'foto.png', 'image/png');
  assert.equal(subida.status, 200, JSON.stringify(subida.body));
  ctx.url = subida.body.data.avatarUrl;
  assert.match(ctx.url, new RegExp(`^/api/v1/users/${yo.user.id}/avatar\\?v=\\d+$`));
  assert.equal((await yo.get('/auth/me')).body.data.user.avatarUrl, ctx.url);
  const guardada = (await User.findByPk(yo.user.id)).avatarFile;
  ctx.archivo = path.join(avatarDir(), guardada);
  assert.ok(existsSync(ctx.archivo));

  const propia = await yo.agent.get(ctx.url);
  assert.equal(propia.status, 200);
  assert.equal(propia.headers['content-type'], 'image/png');
  assert.equal(propia.headers['x-content-type-options'], 'nosniff');
  assert.equal((await ctx.companera.agent.get(ctx.url)).status, 200);
  assert.equal((await ctx.otra.student.agent.get(ctx.url)).status, 404);
  assert.equal((await request(app).get(ctx.url)).status, 401);

  // Cambiar la foto borra el archivo anterior; quitarla borra el actual.
  const otra = await subirFoto(yo, PNG, 'nueva.png', 'image/png');
  assert.equal(otra.status, 200);
  assert.equal(existsSync(ctx.archivo), false);
  const actual = path.join(avatarDir(), (await User.findByPk(yo.user.id)).avatarFile);
  assert.equal((await yo.delete('/me/avatar')).status, 200);
  assert.equal(existsSync(actual), false);
  assert.equal((await yo.agent.get(`/api/v1/users/${yo.user.id}/avatar`)).status, 404);
});

test('cambiar la contraseña exige la actual y cierra las demás sesiones', async () => {
  const email = 'companera.perfil@prueba.test';
  const otraSesion = await loginAs(email);
  const mala = await ctx.companera.post('/me/password', { currentPassword: 'equivocada', newPassword: NUEVA });
  assert.equal(mala.status, 422);
  assert.equal((await ctx.companera.post('/me/password', { currentPassword: PASSWORD, newPassword: 'corta' })).status, 422);

  const bien = await ctx.companera.post('/me/password', { currentPassword: PASSWORD, newPassword: NUEVA });
  assert.equal(bien.status, 200, JSON.stringify(bien.body));
  assert.equal(bien.body.data.otherSessionsClosed, 1);
  assert.equal((await ctx.companera.get('/auth/me')).status, 200);
  assert.equal((await otraSesion.get('/auth/me')).status, 401);
  await assert.rejects(loginAs(email, PASSWORD));
  await loginAs(email, NUEVA);
});

test('cambiar el correo exige la contraseña, un correo libre y confirmar desde la nueva dirección', async () => {
  const sesion = await loginAs('companera.perfil@prueba.test', NUEVA);
  assert.equal((await sesion.post('/me/email', { currentPassword: 'equivocada', newEmail: 'nuevo.perfil@prueba.test' })).status, 422);
  const ocupado = await sesion.post('/me/email', { currentPassword: NUEVA, newEmail: ctx.org.teacher.user.email });
  assert.equal(ocupado.status, 409);
  assert.equal(ocupado.body.error.code, 'EMAIL_IN_USE');

  // Una primera solicitud que luego se reemplaza: su enlace deja de servir.
  sentInTests.length = 0;
  assert.equal((await sesion.post('/me/email', { currentPassword: NUEVA, newEmail: 'descartado.perfil@prueba.test' })).status, 200);
  const viejo = tokenFrom(sentInTests.find((m) => m.to === 'descartado.perfil@prueba.test'));

  sentInTests.length = 0;
  const cambio = await sesion.post('/me/email', { currentPassword: NUEVA, newEmail: 'Nuevo.Perfil@Prueba.test' });
  assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
  assert.deepEqual(cambio.body.data, { pending: true, newEmail: 'nuevo.perfil@prueba.test', expiresInMinutes: 60 });
  // Mientras no se confirme, el correo de acceso sigue siendo el anterior y se avisó a esa dirección.
  assert.equal((await sesion.get('/auth/me')).body.data.user.email, 'companera.perfil@prueba.test');
  assert.ok(sentInTests.some((m) => m.to === 'companera.perfil@prueba.test' && /cambio de correo/i.test(m.subject)));
  await assert.rejects(loginAs('nuevo.perfil@prueba.test', NUEVA));
  const token = tokenFrom(sentInTests.find((m) => m.to === 'nuevo.perfil@prueba.test'));

  const anonimo = request(app);
  assert.equal((await anonimo.post('/api/v1/auth/email/confirm').send({ token: viejo })).status, 422);
  assert.equal((await anonimo.post('/api/v1/auth/email/confirm').send({ token: 'f'.repeat(64) })).status, 422);
  const confirmado = await anonimo.post('/api/v1/auth/email/confirm').send({ token });
  assert.equal(confirmado.status, 200, JSON.stringify(confirmado.body));
  assert.equal(confirmado.body.data.email, 'nuevo.perfil@prueba.test');
  assert.equal((await anonimo.post('/api/v1/auth/email/confirm').send({ token })).status, 422);
  assert.ok(sentInTests.some((m) => m.to === 'companera.perfil@prueba.test' && /cambió/.test(m.subject)));
  await loginAs('nuevo.perfil@prueba.test', NUEVA);
  await assert.rejects(loginAs('companera.perfil@prueba.test', NUEVA));
});

test('un enlace de cambio de correo no aplica si otra cuenta tomó la dirección o si venció', async () => {
  const sesion = await loginAs('nuevo.perfil@prueba.test', NUEVA);
  sentInTests.length = 0;
  assert.equal((await sesion.post('/me/email', { currentPassword: NUEVA, newEmail: 'disputado.perfil@prueba.test' })).status, 200);
  const token = tokenFrom(sentInTests.find((m) => m.to === 'disputado.perfil@prueba.test'));
  // Otra cuenta queda con esa dirección antes de que se confirme.
  await User.update({ email: 'disputado.perfil@prueba.test' }, { where: { id: ctx.org.teacher.user.id } });
  const choque = await request(app).post('/api/v1/auth/email/confirm').send({ token });
  assert.equal(choque.status, 409);
  assert.equal((await User.findByPk(ctx.companera.user.id)).email, 'nuevo.perfil@prueba.test');
  await User.update({ email: ctx.org.teacher.user.email }, { where: { id: ctx.org.teacher.user.id } });

  sentInTests.length = 0;
  assert.equal((await sesion.post('/me/email', { currentPassword: NUEVA, newEmail: 'tarde.perfil@prueba.test' })).status, 200);
  const tarde = tokenFrom(sentInTests.find((m) => m.to === 'tarde.perfil@prueba.test'));
  await EmailChange.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { userId: ctx.companera.user.id, usedAt: null } });
  assert.equal((await request(app).post('/api/v1/auth/email/confirm').send({ token: tarde })).status, 422);
  assert.equal((await User.findByPk(ctx.companera.user.id)).email, 'nuevo.perfil@prueba.test');
});
