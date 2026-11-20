import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse } from './helpers.js';
import { AuditLog } from '../src/models/index.js';

// Retiro y reintegración de un estudiante con datos temporales.
const ctx = {};

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.matriculas@prueba.test');
  const platform = await loginAs('operador.matriculas@prueba.test');
  ctx.org = await setupInstitution(platform, 'Matriculas A');
  ctx.otra = await setupInstitution(platform, 'Matriculas B');
  const { courseId } = await setupCourse(ctx.org, 'MATR-1');
  ctx.courseId = courseId;
  const lista = await ctx.org.teacher.get(`/courses/${courseId}/enrollments`);
  ctx.enrollmentId = lista.body.data[0].id;
});

after(closeDatabase);

test('al retirarlo pierde el acceso y al reintegrarlo lo recupera con la misma matrícula', async () => {
  assert.equal((await ctx.org.student.get(`/courses/${ctx.courseId}`)).status, 200);

  assert.equal((await ctx.org.teacher.delete(`/courses/${ctx.courseId}/enrollments/${ctx.enrollmentId}`)).status, 204);
  assert.equal((await ctx.org.student.get(`/courses/${ctx.courseId}`)).status, 403);
  const retirada = await ctx.org.teacher.get(`/courses/${ctx.courseId}/enrollments`);
  assert.equal(retirada.body.data[0].status, 'withdrawn');

  const reintegro = await ctx.org.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.org.student.user.id });
  assert.equal(reintegro.status, 201, JSON.stringify(reintegro.body));
  assert.equal(reintegro.body.data.reinstated, true);
  // Es la misma fila: el historial ligado a la matrícula se conserva.
  assert.equal(reintegro.body.data.id, ctx.enrollmentId);
  assert.equal((await ctx.org.student.get(`/courses/${ctx.courseId}`)).status, 200);

  const acciones = (await AuditLog.findAll({ where: { resourceType: 'course', resourceId: ctx.courseId }, order: [['id', 'ASC']] }))
    .map((row) => row.action).filter((action) => action.startsWith('enrollment.'));
  assert.deepEqual(acciones, ['enrollment.created', 'enrollment.withdrawn', 'enrollment.reinstated']);
});

test('no se reintegra a quien ya está activo ni desde otra institución o rol', async () => {
  const repetida = await ctx.org.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.org.student.user.id });
  assert.equal(repetida.status, 409);
  assert.equal(repetida.body.error.code, 'ALREADY_ENROLLED');
  assert.equal((await ctx.otra.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.org.student.user.id })).status, 404);
  assert.equal((await ctx.org.student.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.org.student.user.id })).status, 403);
});
