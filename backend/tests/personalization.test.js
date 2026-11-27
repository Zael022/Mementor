import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse } from './helpers.js';
import { clock, dayKey, addDays } from '../src/utils/clock.js';
import { TopicReview, TopicReviewLog } from '../src/models/index.js';

// Prueba preferencias, repaso espaciado y plan de estudio de punta a punta con datos temporales.
const ctx = {};
const realNow = clock.now;
const DIA = 24 * 3600 * 1000;
const ZONA = 'America/Costa_Rica';

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.personal@prueba.test');
  const platform = await loginAs('operador.personal@prueba.test');
  ctx.org = await setupInstitution(platform, 'Personal A');
  ctx.otra = await setupInstitution(platform, 'Personal B');
  const { courseId, topicId } = await setupCourse(ctx.org, 'PERS-1');
  Object.assign(ctx, { courseId, topic1: topicId });

  // Un segundo tema que depende del primero.
  const detalle = await ctx.org.teacher.get(`/courses/${courseId}`);
  const moduleId = detalle.body.data.modules[0].id;
  const tema2 = await ctx.org.teacher.post(`/modules/${moduleId}/topics`, { title: 'Tema 2' });
  ctx.topic2 = tema2.body.data.id;
  await ctx.org.teacher.put(`/topics/${ctx.topic2}/prerequisites`, { prerequisiteTopicIds: [ctx.topic1] });

  // Evaluación de tres preguntas del tema 1.
  const evaluacion = await ctx.org.teacher.post(`/courses/${courseId}/assessments`, { title: 'Diagnóstico', topicId: ctx.topic1, maxAttempts: 3 });
  ctx.assessmentId = evaluacion.body.data.id;
  ctx.questions = [];
  for (const stem of ['¿Uno?', '¿Dos?', '¿Tres?']) {
    const pregunta = await ctx.org.teacher.post(`/assessments/${ctx.assessmentId}/questions`, {
      stem, options: [{ body: 'Sí', isCorrect: true }, { body: 'No', isCorrect: false }],
    });
    ctx.questions.push(pregunta.body.data);
  }
  assert.equal((await ctx.org.teacher.post(`/assessments/${ctx.assessmentId}/publish`)).status, 200);
});

afterEach(() => { clock.now = realNow; });
after(async () => { clock.now = realNow; await closeDatabase(); });

test('las preferencias empiezan en los valores por defecto y solo cambia lo enviado', async () => {
  const inicial = await ctx.org.student.get('/me/preferences');
  assert.equal(inicial.status, 200);
  assert.deepEqual(inicial.body.data, {
    theme: 'system', textScale: 100, highContrast: false, reducedMotion: false, readingSpacing: false,
    underlineLinks: false, timeZone: null, dailyGoalMinutes: null, practiceSize: 5, emailReminders: true,
    showMascots: true, showBigCelebrations: true, pausaWalks: true, pausaHiddenToday: false,
  });

  const cambio = await ctx.org.student.patch('/me/preferences', { theme: 'dark', textScale: 130, highContrast: true, timeZone: ZONA, practiceSize: 10 });
  assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
  assert.equal(cambio.body.data.theme, 'dark');
  assert.equal(cambio.body.data.reducedMotion, false);

  // Son personales: otra cuenta conserva los suyos.
  assert.equal((await ctx.org.teacher.get('/me/preferences')).body.data.theme, 'system');
});

test('las preferencias rechazan valores fuera de la lista y campos desconocidos', async () => {
  assert.equal((await ctx.org.student.patch('/me/preferences', { textScale: 300 })).status, 422);
  assert.equal((await ctx.org.student.patch('/me/preferences', { theme: 'neon' })).status, 422);
  assert.equal((await ctx.org.student.patch('/me/preferences', { timeZone: 'Marte/Base_Alfa' })).status, 422);
  assert.equal((await ctx.org.student.patch('/me/preferences', { role: 'teacher' })).status, 422);
  assert.equal((await ctx.org.student.patch('/me/preferences', {})).status, 422);
});

test('enviar una evaluación programa el repaso del tema con la nota objetiva', async () => {
  clock.now = () => new Date('2026-11-20T15:00:00Z');
  const vacio = await ctx.org.student.get(`/me/reviews?courseId=${ctx.courseId}`);
  assert.deepEqual(vacio.body.data.map((tema) => tema.status), ['new', 'new']);

  const inicio = await ctx.org.student.post(`/assessments/${ctx.assessmentId}/attempts`);
  const correcta = (pregunta) => pregunta.options.find((opcion) => opcion.isCorrect).id;
  const envio = await ctx.org.student.post(`/attempts/${inicio.body.data.attemptId}/submit`, {
    answers: ctx.questions.map((pregunta) => ({ questionId: pregunta.id, selectedOptionId: correcta(pregunta) })),
  });
  assert.equal(envio.status, 200, JSON.stringify(envio.body));

  // 3 de 3 = «fácil» → estabilidad inicial 13,8 días → repaso en 14 días.
  const review = await TopicReview.findOne({ where: { studentId: ctx.org.student.user.id, topicId: ctx.topic1 } });
  assert.equal(review.lastGrade, 4);
  assert.equal(new Date(review.dueAt).getTime(), new Date('2026-11-20T15:00:00Z').getTime() + 14 * DIA);
  const logs = await TopicReviewLog.findAll({ where: { reviewId: review.id } });
  assert.deepEqual(logs.map((log) => log.source), ['assessment']);

  const lista = await ctx.org.student.get(`/me/reviews?courseId=${ctx.courseId}`);
  const tema1 = lista.body.data.find((tema) => tema.topicId === ctx.topic1);
  assert.equal(tema1.status, 'scheduled');
  assert.equal(tema1.recallPct, 100);
});

test('la autoevaluación solo se acepta cuando el repaso ya toca', async () => {
  clock.now = () => new Date('2026-11-25T15:00:00Z');
  const antes = await ctx.org.student.post(`/topics/${ctx.topic1}/reviews`, { grade: 3 });
  assert.equal(antes.status, 409);
  assert.equal(antes.body.error.code, 'REVIEW_NOT_DUE');

  clock.now = () => new Date('2026-12-05T15:00:00Z');
  const lista = await ctx.org.student.get(`/me/reviews?courseId=${ctx.courseId}`);
  assert.equal(lista.body.data[0].topicId, ctx.topic1);
  assert.equal(lista.body.data[0].status, 'due');
  assert.ok(lista.body.data[0].recallPct < 90);

  const repaso = await ctx.org.student.post(`/topics/${ctx.topic1}/reviews`, { grade: 3 });
  assert.equal(repaso.status, 200, JSON.stringify(repaso.body));
  assert.ok(repaso.body.data.scheduledDays > 14);
  assert.equal(repaso.body.data.status, 'scheduled');
  assert.equal((await ctx.org.student.post(`/topics/${ctx.topic1}/reviews`, { grade: 9 })).status, 422);
});

test('nadie más puede ver ni registrar los repasos de un curso ajeno', async () => {
  assert.equal((await ctx.org.teacher.get(`/me/reviews?courseId=${ctx.courseId}`)).status, 403);
  assert.equal((await ctx.otra.student.get(`/me/reviews?courseId=${ctx.courseId}`)).status, 404);
  assert.equal((await ctx.otra.student.post(`/topics/${ctx.topic1}/reviews`, { grade: 3 })).status, 404);
});

test('el plan prioriza lo pendiente, respeta prerrequisitos y no supera los minutos del día', async () => {
  const hoy = dayKey(undefined, ZONA);
  const sinPlan = await ctx.org.student.get(`/courses/${ctx.courseId}/study-plan`);
  assert.equal(sinPlan.status, 200);
  assert.equal(sinPlan.body.data, null);

  const plan = await ctx.org.student.post(`/courses/${ctx.courseId}/study-plan`, {
    targetDate: addDays(hoy, 13), minutesPerSession: 30, studyDays: [1, 2, 3, 4, 5, 6, 7],
  });
  assert.equal(plan.status, 201, JSON.stringify(plan.body));
  const datos = plan.body.data;
  // Usa la zona guardada en las preferencias, no la del servidor.
  assert.equal(datos.timeZone, ZONA);
  assert.equal(datos.startDate, hoy);
  // El tema 1 es «práctica» (3 evidencias, dominio 0,8) y va antes que el tema 2 nuevo, que depende de él.
  const temas = [...new Set(datos.items.map((item) => item.topicId))];
  assert.deepEqual(temas, [ctx.topic1, ctx.topic2]);
  assert.deepEqual([...new Set(datos.items.map((item) => item.kind))], ['practice', 'learn']);
  const porDia = new Map();
  for (const item of datos.items) porDia.set(item.scheduledDate, (porDia.get(item.scheduledDate) || 0) + item.minutes);
  for (const minutos of porDia.values()) assert.ok(minutos <= 30);
  assert.equal(datos.unscheduledMinutes, 0);
  ctx.plan = datos;
});

test('el estudiante edita sus sesiones, crear otro plan archiva el anterior y nadie más lo toca', async () => {
  const [primera] = ctx.plan.items;
  const hecha = await ctx.org.student.patch(`/study-plan-items/${primera.id}`, { status: 'done' });
  assert.equal(hecha.status, 200);
  assert.equal(hecha.body.data.doneMinutes, primera.minutes);

  const fueraDeRango = await ctx.org.student.patch(`/study-plan-items/${primera.id}`, { scheduledDate: addDays(ctx.plan.targetDate, 1) });
  assert.equal(fueraDeRango.status, 422);
  assert.equal((await ctx.otra.student.patch(`/study-plan-items/${primera.id}`, { status: 'done' })).status, 404);
  assert.equal((await ctx.org.teacher.patch(`/study-plan-items/${primera.id}`, { status: 'done' })).status, 403);

  const imposible = await ctx.org.student.post(`/courses/${ctx.courseId}/study-plan`, {
    targetDate: addDays(dayKey(undefined, ZONA), -1), minutesPerSession: 30, studyDays: [1],
  });
  assert.equal(imposible.status, 422);

  const nuevo = await ctx.org.student.post(`/courses/${ctx.courseId}/study-plan`, {
    targetDate: addDays(dayKey(undefined, ZONA), 1), minutesPerSession: 15, studyDays: [1, 2, 3, 4, 5, 6, 7],
  });
  assert.equal(nuevo.status, 201);
  // Dos días de 15 minutos no alcanzan: el plan lo dice en vez de amontonar sesiones.
  assert.ok(nuevo.body.data.unscheduledMinutes > 0);
  const vigente = await ctx.org.student.get(`/courses/${ctx.courseId}/study-plan`);
  assert.equal(vigente.body.data.id, nuevo.body.data.id);
  assert.equal((await ctx.org.student.patch(`/study-plan-items/${primera.id}`, { status: 'pending' })).status, 422);

  assert.equal((await ctx.org.student.delete(`/study-plans/${nuevo.body.data.id}`)).status, 204);
  assert.equal((await ctx.org.student.get(`/courses/${ctx.courseId}/study-plan`)).body.data, null);
});
