import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { AgentRun, DataDeletionRequest, ExchangeRate, IntegrationRun, ReminderDelivery, User, sequelize } from '../src/models/index.js';
import { reconcilePendingDeletions } from '../src/services/governanceService.js';
import { sentInTests } from '../src/services/mailService.js';
import { parseHacienda } from '../src/services/external/exchangeRateService.js';
import { setExternalFetchForTests } from '../src/services/external/httpClient.js';
import { clearHolidayCache } from '../src/services/external/holidayService.js';
import { clock, dayKey } from '../src/utils/clock.js';
import { closeDatabase, createPlatformAdmin, loginAs, PASSWORD, prepareDatabase, setupCourse, setupInstitution } from './helpers.js';

// Prueba las APIs externas (simuladas) y los endpoints de n8n.
const ctx = {};
const KEY = 'clave-de-integracion-para-pruebas-0123456789';
const hoy = () => dayKey();
const respuesta = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });

before(async () => {
  await prepareDatabase();
  process.env.N8N_INTEGRATION_KEY = KEY;
  await createPlatformAdmin('operador.int@prueba.test');
  ctx.platform = await loginAs('operador.int@prueba.test');
  ctx.org = await setupInstitution(ctx.platform, 'Integra');
  ctx.course = await setupCourse(ctx.org, 'INT-1');
});

afterEach(() => { setExternalFetchForTests(null); clearHolidayCache(); clock.now = () => new Date(); });
after(async () => { delete process.env.N8N_INTEGRATION_KEY; await closeDatabase(); });

test('interpreta las dos formas de respuesta de Hacienda y rechaza un formato extraño', () => {
  const venta = { fecha: '2026-11-20 00:00:00', valor: 462.29 };
  const compra = { fecha: '2026-11-20 00:00:00', valor: 456.56 };
  assert.deepEqual(parseHacienda({ dolar: { venta, compra } }), { date: '2026-11-20', buy: 456.56, sell: 462.29 });
  assert.deepEqual(parseHacienda({ venta, compra }), { date: '2026-11-20', buy: 456.56, sell: 462.29 });
  assert.throws(() => parseHacienda({ precio: 1 }), /cambió de formato/);
});

test('el tipo de cambio se consulta una vez al día, se guarda y, si la API falla, se usa el último marcado como desactualizado', async () => {
  let llamadas = 0;
  setExternalFetchForTests(async (url) => {
    llamadas += 1;
    assert.match(url, /hacienda/);
    return respuesta({ venta: { fecha: hoy(), valor: 470.1 }, compra: { fecha: hoy(), valor: 464.2 } });
  });
  const primera = await ctx.org.student.get('/indicators/exchange-rate');
  assert.equal(primera.status, 200, JSON.stringify(primera.body));
  assert.deepEqual([primera.body.data.buy, primera.body.data.sell, primera.body.data.stale], [464.2, 470.1, false]);
  await ctx.org.student.get('/indicators/exchange-rate');
  assert.equal(llamadas, 1);

  // Al día siguiente la API no responde: se devuelve el último guardado.
  clock.now = () => new Date(Date.now() + 2 * 24 * 3600000);
  setExternalFetchForTests(async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); });
  const vieja = await ctx.org.student.get('/indicators/exchange-rate');
  assert.equal(vieja.body.data.stale, true);
  assert.ok(await IntegrationRun.count({ where: { integration: 'api:hacienda', status: 'error', detail: 'Tiempo de espera agotado' } }));
  assert.equal((await request(app).get('/api/v1/indicators/exchange-rate')).status, 401);
});

test('los feriados vienen de Nager.Date, se filtran y se guardan en memoria', async () => {
  let llamadas = 0;
  setExternalFetchForTests(async (url) => {
    llamadas += 1;
    assert.match(url, /\/2026\/CR$/);
    return respuesta([{ date: '2026-12-25', localName: 'Navidad', name: 'Christmas' }, { fecha: 'mal' }]);
  });
  const lista = await ctx.org.teacher.get('/indicators/holidays?year=2026');
  assert.deepEqual(lista.body.data, [{ date: '2026-12-25', name: 'Navidad' }]);
  await ctx.org.teacher.get('/indicators/holidays?year=2026');
  assert.equal(llamadas, 1);
  assert.equal((await ctx.org.teacher.get('/indicators/holidays?year=1800')).status, 422);
  setExternalFetchForTests(async () => respuesta({}, 500));
  clearHolidayCache();
  const caida = await ctx.org.teacher.get('/indicators/holidays?year=2027');
  assert.equal(caida.status, 503);
  assert.equal(caida.body.error.code, 'EXTERNAL_UNAVAILABLE');
});

test('el costo estimado no inventa tarifas y usa el tipo de cambio de venta', async () => {
  await AgentRun.create({ institutionId: ctx.org.institutionId, userId: ctx.org.teacher.user.id, agent: 'course_analyst', status: 'completed', provider: 'prueba', model: 'modelo-con-tarifa', inputTokens: 1_000_000, outputTokens: 200_000 });
  const sinPrecio = await ctx.org.admin.get('/institution/ai-cost');
  assert.equal(sinPrecio.body.data.priceConfigured, false);
  assert.equal(sinPrecio.body.data.crc, null);
  process.env.AI_PRICE_INPUT_USD_PER_MTOK = '3';
  process.env.AI_PRICE_OUTPUT_USD_PER_MTOK = '15';
  process.env.AI_MODEL_PRICES_JSON = '[{"provider":"prueba","model":"modelo-con-tarifa","input":3,"output":15}]';
  const conPrecio = await ctx.org.admin.get('/institution/ai-cost');
  delete process.env.AI_PRICE_INPUT_USD_PER_MTOK;
  delete process.env.AI_PRICE_OUTPUT_USD_PER_MTOK;
  delete process.env.AI_MODEL_PRICES_JSON;
  // 1 M de entrada × 3 + 0,2 M de salida × 15 = 6 USD.
  assert.equal(conPrecio.body.data.usd, 6);
  assert.equal(conPrecio.body.data.crc, Math.round(6 * conPrecio.body.data.rate.sell * 100) / 100);
  assert.equal((await ctx.org.student.get('/institution/ai-cost')).status, 403);
});

test('n8n necesita la clave de integración y valida lo que envía', async () => {
  const sinClave = await request(app).post('/api/v1/integrations/exchange-rates').send({ date: '2026-11-20', buy: 450, sell: 455 });
  assert.equal(sinClave.status, 401);
  const mala = await request(app).post('/api/v1/integrations/exchange-rates').set('x-integration-key', 'otra').send({ date: '2026-11-20', buy: 450, sell: 455 });
  assert.equal(mala.status, 401);
  const invalida = await request(app).post('/api/v1/integrations/exchange-rates').set('x-integration-key', KEY).send({ date: 'ayer', buy: -1 });
  assert.equal(invalida.status, 422);
  const ok = await request(app).post('/api/v1/integrations/exchange-rates').set('x-integration-key', KEY).send({ date: '2026-11-19', buy: 450.5, sell: 455.75 });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(await ExchangeRate.count({ where: { source: 'n8n-hacienda' } }), 1);

  const guardada = process.env.N8N_INTEGRATION_KEY;
  process.env.N8N_INTEGRATION_KEY = 'corta';
  assert.equal((await request(app).get('/api/v1/integrations/daily-reminders').set('x-integration-key', 'corta')).status, 503);
  process.env.N8N_INTEGRATION_KEY = guardada;
});

test('recordatorios diarios: solo estudiantes con tareas próximas sin entregar', async () => {
  const tarea = await ctx.org.teacher.post(`/courses/${ctx.course.courseId}/assignments`, {
    title: 'Mapa conceptual', instructions: 'Entregar.', dueAt: new Date(Date.now() + 10 * 3600000).toISOString(),
  });
  await ctx.org.teacher.patch(`/assignments/${tarea.body.data.id}`, { status: 'published' });
  const lista = await request(app).get('/api/v1/integrations/daily-reminders').set('x-integration-key', KEY);
  assert.equal(lista.status, 200);
  const mia = lista.body.data.find((item) => item.email === ctx.org.student.user.email);
  assert.equal(mia.items[0].title, 'Mapa conceptual');
  await ctx.org.student.post(`/assignments/${tarea.body.data.id}/submission`, { body: 'Listo' });
  const despues = await request(app).get('/api/v1/integrations/daily-reminders').set('x-integration-key', KEY);
  assert.equal(despues.body.data.some((item) => item.email === ctx.org.student.user.email), false);

  // H-05: la copia de datos incluye lo académico propio y nada de otras personas.
  const copia = (await ctx.org.student.get('/me/data-export')).body.data;
  assert.match(copia.scope, /datos de aprendizaje/);
  assert.deepEqual(copia.learning.assignmentSubmissions.map((row) => [row.assignment, row.body]), [['Mapa conceptual', 'Listo']]);
  assert.ok(copia.learning.courses.length >= 1);
  assert.equal('gradedBy' in copia.learning.assignmentSubmissions[0], false);
  const docente = (await ctx.org.teacher.get('/me/data-export')).body.data;
  assert.deepEqual(docente.learning.assignmentSubmissions, []);
});

test('recordatorios por páginas: nadie queda fuera, no se repiten al reintentar y se pueden desactivar', async () => {
  const otros = [];
  for (const n of [1, 2, 3]) {
    const persona = await ctx.org.invite(ctx.org.admin, '/users', { email: `recordar${n}@prueba.test`, displayName: `Recordar ${n}`, role: 'student' });
    await ctx.org.teacher.post(`/courses/${ctx.course.courseId}/enrollments`, { studentId: persona.user.id });
    otros.push(persona);
  }
  const tarea = await ctx.org.teacher.post(`/courses/${ctx.course.courseId}/assignments`, {
    title: 'Ensayo corto', instructions: 'Entregar.', dueAt: new Date(Date.now() + 5 * 3600000).toISOString(),
  });
  await ctx.org.teacher.patch(`/assignments/${tarea.body.data.id}`, { status: 'published' });
  // La tercera persona apaga los recordatorios desde su configuración.
  assert.equal((await otros[2].patch('/me/preferences', { emailReminders: false })).status, 200);

  const pedir = (query) => request(app).get(`/api/v1/integrations/daily-reminders${query}`).set('x-integration-key', KEY);
  assert.equal((await pedir('?limit=0')).status, 422);
  assert.equal((await pedir('?after=-1')).status, 422);
  const correos = [];
  let cursor = 0;
  let paginas = 0;
  do {
    const pagina = await pedir(`?after=${cursor}&limit=1`);
    assert.equal(pagina.status, 200);
    correos.push(...pagina.body.data.map((item) => item.email));
    cursor = pagina.body.meta.nextCursor;
    paginas += 1;
  } while (cursor && paginas < 20);
  assert.ok(paginas >= 3);
  assert.ok(correos.includes('recordar1@prueba.test') && correos.includes('recordar2@prueba.test'));
  assert.equal(correos.includes('recordar3@prueba.test'), false);
  assert.equal(new Set(correos).size, correos.length);

  // n8n informa: uno salió y otro falló. El que salió no vuelve a aparecer hoy; el fallido sí, para reintentar.
  const todos = (await pedir('?limit=500')).body;
  const dia = todos.meta.day;
  const [uno, dos] = [otros[0].user.id, otros[1].user.id];
  const registro = await request(app).post('/api/v1/integrations/daily-reminders/deliveries').set('x-integration-key', KEY)
    .send({ day: dia, results: [{ userId: uno, status: 'sent' }, { userId: dos, status: 'failed' }] });
  assert.equal(registro.status, 200, JSON.stringify(registro.body));
  assert.deepEqual(registro.body.data, { recorded: 2, sent: 1, failed: 1 });
  const reintento = (await pedir('?limit=500')).body.data.map((item) => item.userId);
  assert.equal(reintento.includes(uno), false);
  assert.equal(reintento.includes(dos), true);
  // Repetir el aviso no convierte un envío en fallo.
  await request(app).post('/api/v1/integrations/daily-reminders/deliveries').set('x-integration-key', KEY)
    .send({ day: dia, results: [{ userId: uno, status: 'failed' }] });
  const fila = await ReminderDelivery.findOne({ where: { userId: uno, reminderDay: dia } });
  assert.deepEqual([fila.status, fila.attempts], ['sent', 2]);
  assert.equal((await request(app).post('/api/v1/integrations/daily-reminders/deliveries').set('x-integration-key', KEY)
    .send({ day: '2026-02-31', results: [{ userId: uno, status: 'sent' }] })).status, 422);
});

test('workflow de baja: la baja se completa en el servidor y n8n solo confirma y avisa', async () => {
  const usuario = await ctx.org.invite(ctx.org.admin, '/users', { email: 'baja.n8n@prueba.test', displayName: 'Baja N8n', role: 'student' });
  process.env.DELETION_PROCESSOR = 'n8n';
  process.env.N8N_DELETION_WEBHOOK_URL = 'http://n8n.prueba.invalid/webhook/baja';
  const fetchReal = global.fetch;
  let aviso;
  // El webhook de n8n responde 200 al recibir, antes de ejecutar el resto del workflow.
  global.fetch = async (url, opciones) => { aviso = { url, body: JSON.parse(opciones.body), key: opciones.headers['x-integration-key'] }; return respuesta({ ok: true }); };
  try {
    const solicitud = await usuario.post('/me/deletion-request', { password: PASSWORD, confirm: true });
    assert.equal(solicitud.status, 202, JSON.stringify(solicitud.body));
    // Aunque el workflow fallara después de responder, la cuenta ya está anonimizada y la sesión cerrada.
    assert.equal(solicitud.body.data.status, 'completed');
    assert.equal(solicitud.body.data.notificationStatus, null);
    assert.deepEqual([aviso.body.email, aviso.key], ['baja.n8n@prueba.test', KEY]);
    assert.equal((await User.findByPk(usuario.user.id)).displayName, 'Usuario eliminado');
    assert.equal((await usuario.get('/auth/me')).status, 401);

    // n8n confirma (idempotente) y registra el correo enviado.
    const procesada = await request(app).post(`/api/v1/integrations/deletion-requests/${aviso.body.requestId}/process`).set('x-integration-key', KEY);
    assert.equal(procesada.body.data.status, 'completed');
    assert.equal(procesada.body.data.processedVia, 'app');
    const notificada = await request(app).post(`/api/v1/integrations/deletion-requests/${aviso.body.requestId}/notified`).set('x-integration-key', KEY).send({ status: 'sent' });
    assert.equal(notificada.body.data.notificationStatus, 'sent');
  } finally {
    global.fetch = fetchReal;
    delete process.env.DELETION_PROCESSOR;
    delete process.env.N8N_DELETION_WEBHOOK_URL;
  }
});

test('si n8n no responde, la baja igual se completa y el aviso sale desde el servidor', async () => {
  const usuario = await ctx.org.invite(ctx.org.admin, '/users', { email: 'baja.caida@prueba.test', displayName: 'Baja Caída', role: 'student' });
  process.env.DELETION_PROCESSOR = 'n8n';
  process.env.N8N_DELETION_WEBHOOK_URL = 'http://n8n.prueba.invalid/webhook/baja';
  const fetchReal = global.fetch;
  global.fetch = async () => { throw new Error('ECONNREFUSED'); };
  sentInTests.length = 0;
  try {
    const solicitud = await usuario.post('/me/deletion-request', { password: PASSWORD, confirm: true });
    assert.equal(solicitud.body.data.status, 'completed');
    assert.equal(solicitud.body.data.notificationStatus, 'sent');
    assert.ok(sentInTests.some((m) => m.to === 'baja.caida@prueba.test'));
  } finally {
    global.fetch = fetchReal;
    delete process.env.DELETION_PROCESSOR;
    delete process.env.N8N_DELETION_WEBHOOK_URL;
  }
});

test('una solicitud de baja que quedó pendiente se completa en la conciliación diaria', async () => {
  const usuario = await ctx.org.invite(ctx.org.admin, '/users', { email: 'baja.pendiente@prueba.test', displayName: 'Baja Pendiente', role: 'student' });
  // Simula una baja interrumpida: la solicitud existe, pero la cuenta sigue intacta.
  const fila = await DataDeletionRequest.create({ userId: usuario.user.id, institutionId: usuario.user.institutionId, identityConfirmedAt: new Date() });
  await sequelize.query('UPDATE data_deletion_requests SET created_at = NOW() - INTERVAL 1 HOUR WHERE id = :id', { replacements: { id: fila.id } });
  assert.equal(await reconcilePendingDeletions(), 1);
  assert.equal((await DataDeletionRequest.findByPk(fila.id)).status, 'completed');
  assert.equal((await User.findByPk(usuario.user.id)).displayName, 'Usuario eliminado');
  assert.equal(await reconcilePendingDeletions(), 0);
});
