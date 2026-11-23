import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase, createPlatformAdmin, loginAs, prepareDatabase, setupInstitution } from './helpers.js';
import { resetMetricsForTests } from '../src/utils/requestMetrics.js';

const ctx = {};

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.metricas@prueba.test');
  ctx.platform = await loginAs('operador.metricas@prueba.test');
  ctx.org = await setupInstitution(ctx.platform, 'Metricas');
});
after(closeDatabase);

test('las métricas de solicitudes muestran latencia y errores sin ids ni datos en las rutas', async () => {
  resetMetricsForTests();
  await ctx.org.student.get('/auth/me');
  await ctx.org.student.get('/courses/999999');
  const respuesta = await ctx.platform.get('/ops/metrics');
  assert.equal(respuesta.status, 200);
  const { requests, latencyMs, slowestRoutes } = respuesta.body.data;
  assert.ok(requests.total >= 2);
  assert.ok(requests.status4xx >= 1);
  assert.ok(latencyMs.p95 >= latencyMs.p50);
  const rutas = slowestRoutes.map((item) => item.route);
  assert.ok(rutas.includes('GET /api/v1/courses/:courseId'), rutas.join(', '));
  assert.equal(rutas.some((ruta) => /999999/.test(ruta)), false);
  assert.equal((await ctx.org.student.get('/ops/metrics')).status, 403);
});
