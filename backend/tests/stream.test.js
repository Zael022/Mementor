import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  app, prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse, publishLesson, PASSWORD,
} from './helpers.js';
import { setAiProviderForTests } from '../src/services/aiProvider.js';
import { AiMessage, AiUsageEvent, sequelize } from '../src/models/index.js';
import { AppError } from '../src/utils/AppError.js';

// Entrega 3: streaming SSE, cancelación, cuota concurrente, tope institucional y registro de consumo.
const ctx = {};
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const provider = { streamCalls: 0, aborted: 0, completeDelay: 0 };

// Doble del proveedor: emite palabras con pausa y respeta la cancelación.
const doubles = {
  stream: async ({ messages, onText, signal }) => {
    provider.streamCalls += 1;
    const ids = [...messages.at(-1).content.matchAll(/<fuente id="(S\d+)"/g)].map((match) => match[1]);
    const words = `Una fracción representa partes iguales de un entero [${ids[0]}] y el denominador no puede ser cero.`.split(' ');
    let text = '';
    for (const word of words) {
      if (signal?.aborted) { provider.aborted += 1; throw new AppError(499, 'CANCELLED', 'cancelada'); }
      text += `${word} `;
      onText(`${word} `);
      await sleep(provider.streamDelay ?? 15);
    }
    return { text, model: 'modelo-de-prueba', provider: 'prueba', stopReason: 'end_turn', usage: { inputTokens: 321, outputTokens: 45 } };
  },
  complete: async ({ messages }) => {
    await sleep(provider.completeDelay);
    const ids = [...messages.at(-1).content.matchAll(/<fuente id="(S\d+)"/g)].map((match) => match[1]);
    return { text: JSON.stringify({ answer: 'Respuesta.', citedSourceIds: ids.slice(0, 1), grounded: true }), model: 'modelo-de-prueba', provider: 'prueba', usage: { inputTokens: 10, outputTokens: 5 } };
  },
};

// Inicia sesión con fetch para leer el flujo SSE real.
async function fetchSession(email) {
  const response = await fetch(`${ctx.base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const body = await response.json();
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: body.data.csrfToken };
}

function openStream(session, threadId, question, signal) {
  return fetch(`${ctx.base}/api/v1/tutor/threads/${threadId}/messages/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie, 'x-csrf-token': session.csrf },
    body: JSON.stringify({ question }),
    signal,
  });
}

// Lee eventos SSE hasta el final o hasta que se pida parar.
async function readEvents(response, { stopAfterDeltas = Infinity } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';
  let deltas = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    for (const part of parts) {
      const event = part.match(/^event: (.+)$/m)?.[1];
      const data = JSON.parse(part.match(/^data: (.+)$/m)?.[1] || 'null');
      events.push({ event, data });
      if (event === 'delta') deltas += 1;
    }
    if (deltas >= stopAfterDeltas) {
      await reader.cancel();
      break;
    }
  }
  return events;
}

before(async () => {
  for (const key of ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL', 'RAG_PROVIDER']) delete process.env[key];
  await prepareDatabase();
  await createPlatformAdmin('operador.stream@prueba.test');
  ctx.platform = await loginAs('operador.stream@prueba.test');
  ctx.org = await setupInstitution(ctx.platform, 'Stream');
  ctx.course = await setupCourse(ctx.org, 'STR-1');
  await publishLesson(ctx.org.teacher, ctx.course.topicId, 'Fracciones', '# Fracciones\n\nUna fracción representa partes iguales de un entero. El denominador no puede ser cero.');
  ctx.server = app.listen(0);
  ctx.base = `http://127.0.0.1:${ctx.server.address().port}`;
  ctx.session = await fetchSession(`estudiante.stream@prueba.test`);
  ctx.thread = (await ctx.org.student.post(`/courses/${ctx.course.courseId}/tutor/threads`, {})).body.data.id;
});
after(async () => {
  setAiProviderForTests(null);
  ctx.server.close();
  await closeDatabase();
});

test('sin credenciales el streaming informa AI_NOT_CONFIGURED antes de abrir el flujo', async () => {
  const response = await openStream(ctx.session, ctx.thread, '¿Qué es una fracción?');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED');
});

test('el streaming distingue el texto en curso de la respuesta final con citas validadas', async () => {
  setAiProviderForTests(doubles);
  const response = await openStream(ctx.session, ctx.thread, '¿Qué es una fracción?');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.equal(response.headers.get('content-encoding'), null);
  const events = await readEvents(response);
  assert.equal(events[0].event, 'start');
  assert.ok(events.filter((item) => item.event === 'delta').length > 3);
  const final = events.at(-1);
  assert.equal(final.event, 'final');
  assert.equal(final.data.status, 'answer');
  assert.equal(final.data.citations.length, 1);
  assert.equal(final.data.citations[0].title, 'Fracciones');
  const usage = await AiUsageEvent.findOne({ order: [['id', 'DESC']] });
  assert.equal(usage.outcome, 'completed');
  assert.equal(usage.streamed, true);
  assert.equal(usage.inputTokens, 321);
  assert.equal(usage.outputTokens, 45);
  assert.ok(usage.latencyMs >= 0);
  assert.equal(usage.model, 'modelo-de-prueba');
});

test('una pregunta sin respaldo llega como aviso final sin llamar al modelo', async () => {
  const before = provider.streamCalls;
  const events = await readEvents(await openStream(ctx.session, ctx.thread, '¿Qué es la tectónica volcánica?'));
  assert.equal(events.at(-1).event, 'final');
  assert.equal(events.at(-1).data.noticeCode, 'NO_EVIDENCE');
  assert.equal(provider.streamCalls, before);
});

test('al salir se cancela el proveedor y el texto interrumpido no queda como respuesta completa', async () => {
  provider.streamDelay = 60;
  const messagesBefore = await AiMessage.count();
  const controller = new AbortController();
  const response = await openStream(ctx.session, ctx.thread, '¿Qué representa el denominador de una fracción?', controller.signal);
  const events = await readEvents(response, { stopAfterDeltas: 2 });
  controller.abort();
  assert.equal(events.some((item) => item.event === 'final'), false);
  await sleep(400);
  provider.streamDelay = 15;
  assert.equal(provider.aborted, 1);
  assert.equal(await AiMessage.count(), messagesBefore);
  const usage = await AiUsageEvent.findOne({ order: [['id', 'DESC']] });
  assert.equal(usage.outcome, 'cancelled');
});

test('las consultas simultáneas respetan el límite diario por usuario', async () => {
  await AiUsageEvent.destroy({ where: {} });
  process.env.AI_DAILY_LIMIT_PER_USER = '3';
  provider.completeDelay = 150;
  const responses = await Promise.all(Array.from({ length: 6 }, () => ctx.org.student.post(`/tutor/threads/${ctx.thread}/messages`, { question: '¿Qué es una fracción?' })));
  provider.completeDelay = 0;
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [201, 201, 201, 429, 429, 429]);
  assert.equal(responses.find((response) => response.status === 429).body.error.code, 'RATE_LIMITED');
  delete process.env.AI_DAILY_LIMIT_PER_USER;
});

test('el tope diario de la institución responde 429', async () => {
  await AiUsageEvent.destroy({ where: {} });
  const set = await ctx.platform.patch(`/institutions/${ctx.org.institutionId}/limits`, { aiDailyQuestionLimit: 1 });
  assert.equal(set.status, 200);
  assert.equal((await ctx.org.student.post(`/tutor/threads/${ctx.thread}/messages`, { question: '¿Qué es una fracción?' })).status, 201);
  const blocked = await ctx.org.student.post(`/tutor/threads/${ctx.thread}/messages`, { question: '¿Qué es una fracción?' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'INSTITUTION_QUOTA');
  await ctx.platform.patch(`/institutions/${ctx.org.institutionId}/limits`, { aiDailyQuestionLimit: null });
});

test('el registro técnico no guarda contenido y solo la administración lo consulta', async () => {
  const [columns] = await sequelize.query('SHOW COLUMNS FROM ai_usage_events');
  const names = columns.map((column) => column.Field);
  for (const forbidden of ['question', 'answer', 'content', 'prompt', 'text']) assert.equal(names.includes(forbidden), false);
  const summary = await ctx.org.admin.get('/institution/ai-usage');
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.costs, null);
  assert.ok(summary.body.data.byModel[0].inputTokens > 0);
  assert.equal((await ctx.org.student.get('/institution/ai-usage')).status, 403);
  assert.equal((await ctx.org.teacher.get('/institution/ai-usage')).status, 403);
});

test('el streaming envía señales de vida mientras espera y la respuesta llega completa', async () => {
  setAiProviderForTests(doubles);
  process.env.SSE_PING_MS = '25';
  provider.streamDelay = 70;
  try {
    const response = await openStream(ctx.session, ctx.thread, '¿Qué representa una fracción?');
    assert.equal(response.status, 200);
    const events = await readEvents(response);
    // Los comentarios «: ping» no tienen nombre de evento y el cliente los ignora.
    assert.ok(events.filter((item) => item.event === undefined).length >= 2);
    assert.equal(events.at(-1).event, 'final');
    assert.equal(events.at(-1).data.status, 'answer');
  } finally {
    delete process.env.SSE_PING_MS;
    provider.streamDelay = 15;
  }
});
