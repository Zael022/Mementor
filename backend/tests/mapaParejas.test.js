import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Sequelize } from 'sequelize';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, publishLesson } from './helpers.js';
import { clock } from '../src/utils/clock.js';
import { CourseStreak, GradeBonusEvent, sequelize } from '../src/models/index.js';
import { rankFor, rankWentUp } from '../src/services/progressRankService.js';

// Rango de avance, mascotas en preferencias y Parejas, con datos temporales que se borran al final.
const require = createRequire(import.meta.url);
const ctx = {};
const realNow = clock.now;

async function crearTarea(teacher, courseId, title, extra = {}) {
  const tarea = await teacher.post(`/courses/${courseId}/assignments`, { title, instructions: 'Entrega breve.', ...extra });
  assert.equal(tarea.status, 201, JSON.stringify(tarea.body));
  await teacher.patch(`/assignments/${tarea.body.data.id}`, { status: 'published' });
  return tarea.body.data.id;
}

async function crearEvaluacion(teacher, courseId, topicId, title, maxAttempts, preguntas) {
  const evaluacion = await teacher.post(`/courses/${courseId}/assessments`, { title, topicId, maxAttempts });
  assert.equal(evaluacion.status, 201, JSON.stringify(evaluacion.body));
  for (const [stem, correcta, otra] of preguntas) {
    const pregunta = await teacher.post(`/assessments/${evaluacion.body.data.id}/questions`, {
      stem, options: [{ body: correcta, isCorrect: true }, { body: otra, isCorrect: false }],
    });
    assert.equal(pregunta.status, 201, JSON.stringify(pregunta.body));
  }
  assert.equal((await teacher.post(`/assessments/${evaluacion.body.data.id}/publish`)).status, 200);
  return evaluacion.body.data.id;
}

async function enviarIntento(student, assessmentId) {
  const inicio = await student.post(`/assessments/${assessmentId}/attempts`);
  assert.equal(inicio.status, 201, JSON.stringify(inicio.body));
  const envio = await student.post(`/attempts/${inicio.body.data.attemptId}/submit`, { answers: [] });
  assert.equal(envio.status, 200, JSON.stringify(envio.body));
}

// Voltea todas las cartas y agrupa las que forman pareja según su texto conocido.
async function voltearTodo(student, game) {
  const textos = new Map();
  for (const carta of game.cards) {
    const vista = await student.post(`/memory-games/${game.id}/reveal`, { cardId: carta.id });
    assert.equal(vista.status, 200, JSON.stringify(vista.body));
    assert.deepEqual(Object.keys(vista.body.data).sort(), ['id', 'kind', 'position', 'text']);
    textos.set(carta.id, vista.body.data);
  }
  return textos;
}

const PREGUNTAS_A1 = [
  ['¿Cuánto es 1/2 + 1/4?', '3/4', '2/6'],
  ['¿Qué parte de un entero es 1/3?', 'Una de tres partes iguales', 'Tres enteros'],
  ['¿Cómo se llama el número de abajo en una fracción?', 'Denominador', 'Numerador'],
  ['¿1/2 es igual a 2/4?', 'Verdadero', 'Falso'],
  // Misma respuesta que la anterior: se descarta para no tener dos cartas idénticas.
  ['¿3/3 es un entero?', 'Verdadero', 'Falso'],
];
const PREGUNTAS_A2 = [
  ['Pregunta abierta uno sobre decimales', 'Respuesta oculta uno', 'Distractor uno'],
  ['Pregunta abierta dos sobre decimales', 'Respuesta oculta dos', 'Distractor dos'],
  ['Pregunta abierta tres sobre decimales', 'Respuesta oculta tres', 'Distractor tres'],
];
const ESPERADAS = new Map(PREGUNTAS_A1.slice(0, 4).map(([stem, correcta]) => [stem, correcta]));

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.mapa@prueba.test');
  const platform = await loginAs('operador.mapa@prueba.test');
  ctx.a = await setupInstitution(platform, 'Mapa A');
  ctx.b = await setupInstitution(platform, 'Mapa B');
  ctx.beto = await ctx.a.invite(ctx.a.admin, '/users', { email: 'beto.mapa@prueba.test', displayName: 'Beto Mapa', role: 'student' });

  // Curso con dos módulos: 4 lecciones y 1 tarea publicadas (5 pasos en total).
  const curso = await ctx.a.teacher.post('/courses', { code: 'MAPA-1', title: 'Curso temporal del mapa' });
  ctx.courseId = curso.body.data.id;
  const m1 = await ctx.a.teacher.post(`/courses/${ctx.courseId}/modules`, { title: 'Fracciones' });
  const m2 = await ctx.a.teacher.post(`/courses/${ctx.courseId}/modules`, { title: 'Decimales' });
  ctx.module1 = m1.body.data.id;
  ctx.module2 = m2.body.data.id;
  ctx.topic1 = (await ctx.a.teacher.post(`/modules/${ctx.module1}/topics`, { title: 'Sumar fracciones' })).body.data.id;
  ctx.topic2 = (await ctx.a.teacher.post(`/modules/${ctx.module2}/topics`, { title: 'Leer decimales' })).body.data.id;
  ctx.lessons = [];
  for (const [topic, title] of [[ctx.topic1, 'L1'], [ctx.topic1, 'L2'], [ctx.topic2, 'L3'], [ctx.topic2, 'L4']]) {
    ctx.lessons.push(await publishLesson(ctx.a.teacher, topic, `Lección ${title}`, 'Contenido temporal.'));
  }
  ctx.taskId = await crearTarea(ctx.a.teacher, ctx.courseId, 'Tarea del tema 1', { topicId: ctx.topic1 });
  await ctx.a.teacher.patch(`/courses/${ctx.courseId}`, { status: 'published' });
  for (const student of [ctx.a.student, ctx.beto]) {
    await ctx.a.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: student.user.id });
  }

  // Curso publicado sin contenido publicado.
  const vacio = await ctx.a.teacher.post('/courses', { code: 'MAPA-0', title: 'Curso sin contenido' });
  ctx.emptyCourseId = vacio.body.data.id;
  await ctx.a.teacher.post(`/courses/${ctx.emptyCourseId}/modules`, { title: 'Módulo vacío' });
  await ctx.a.teacher.patch(`/courses/${ctx.emptyCourseId}`, { status: 'published' });
  await ctx.a.teacher.post(`/courses/${ctx.emptyCourseId}/enrollments`, { studentId: ctx.a.student.user.id });

  // Curso de otra institución.
  const ajeno = await ctx.b.teacher.post('/courses', { code: 'MAPA-B', title: 'Curso de otra institución' });
  ctx.foreignCourseId = ajeno.body.data.id;
  ctx.foreignModule = (await ctx.b.teacher.post(`/courses/${ctx.foreignCourseId}/modules`, { title: 'Ajeno' })).body.data.id;

  // Evaluación con clave visible al agotar el único intento, y otra abierta con intentos de sobra.
  ctx.a1 = await crearEvaluacion(ctx.a.teacher, ctx.courseId, ctx.topic1, 'Cuestionario visible', 1, PREGUNTAS_A1);
  ctx.a2 = await crearEvaluacion(ctx.a.teacher, ctx.courseId, ctx.topic1, 'Cuestionario abierto', 3, PREGUNTAS_A2);
});

afterEach(() => { clock.now = realNow; });
after(async () => { clock.now = realNow; await closeDatabase(); });

test('rango: 0 %, cada umbral exacto, 100 % y sin contenido', () => {
  assert.equal(rankFor().name, 'Sin rango todavía');
  assert.equal(rankFor().percent, null);
  assert.equal(rankFor({ lessonsTotal: 10 }).name, 'Destello');
  assert.equal(rankFor({ lessonsTotal: 10 }).percent, 0);
  assert.deepEqual(rankFor({ lessonsTotal: 10 }).next, { key: 'brillo', name: 'Brillo', threshold: 20, remaining: 2 });
  const casos = [
    [1, 10, 'Destello'], [2, 10, 'Brillo'], [8, 20, 'Brillo'], [9, 20, 'Luz'],
    [13, 20, 'Luz'], [14, 20, 'Estrella'], [19, 20, 'Estrella'], [20, 20, 'Constelación'],
  ];
  for (const [hechas, total, nombre] of casos) assert.equal(rankFor({ lessonsDone: hechas, lessonsTotal: total }).name, nombre, `${hechas}/${total}`);
  // 20 % de 7 es 1,4: hacen falta 2 pasos, y 99,5 % todavía no se muestra como 100 %.
  assert.equal(rankFor({ lessonsTotal: 7 }).next.remaining, 2);
  assert.equal(rankFor({ lessonsDone: 199, lessonsTotal: 200 }).percent, 99);
  const completo = rankFor({ lessonsDone: 3, lessonsTotal: 3, assignmentsDone: 2, assignmentsTotal: 2 });
  assert.equal(completo.percent, 100);
  assert.equal(completo.next, null);
  assert.equal(rankWentUp(rankFor({ lessonsTotal: 5 }), rankFor({ lessonsDone: 1, lessonsTotal: 5 })), true);
  assert.equal(rankWentUp(rankFor({ lessonsDone: 1, lessonsTotal: 5 }), rankFor({ lessonsDone: 1, lessonsTotal: 5 })), false);
});

test('rango del curso: sube al completar y entregar, sin duplicar ni contar lo despublicado', async () => {
  const student = ctx.a.student;
  const inicial = await student.get(`/courses/${ctx.courseId}`);
  assert.equal(inicial.status, 200);
  assert.equal(inicial.body.data.rank.name, 'Destello');
  assert.equal(inicial.body.data.rank.total, 5);
  assert.equal(inicial.body.data.rank.next.remaining, 1);

  const primera = await student.post(`/lessons/${ctx.lessons[0]}/complete`);
  assert.equal(primera.status, 200);
  assert.equal(primera.body.data.rank.before.name, 'Destello');
  assert.equal(primera.body.data.rank.after.name, 'Brillo');
  assert.equal(primera.body.data.rank.rankedUp, true);

  const repetida = await student.post(`/lessons/${ctx.lessons[0]}/complete`);
  assert.equal(repetida.body.data.rank.after.done, 1);
  assert.equal(repetida.body.data.rank.rankedUp, false);

  const entrega = await student.post(`/assignments/${ctx.taskId}/submission`, { body: 'Mi entrega temporal.' });
  assert.equal(entrega.status, 200, JSON.stringify(entrega.body));
  assert.equal(entrega.body.data.rank.after.percent, 40);
  assert.equal(entrega.body.data.rank.rankedUp, false);
  assert.deepEqual([entrega.body.data.module.done, entrega.body.data.module.total, entrega.body.data.module.justCompleted], [2, 3, false]);
  // Corregir la entrega no suma otro paso.
  const correccion = await student.post(`/assignments/${ctx.taskId}/submission`, { body: 'Mi entrega corregida.' });
  assert.equal(correccion.body.data.rank.after.done, 2);

  // Despublicar una lección ya completada la saca del numerador y del denominador.
  await ctx.a.teacher.patch(`/lessons/${ctx.lessons[0]}`, { status: 'draft' });
  const despublicada = (await student.get(`/courses/${ctx.courseId}`)).body.data.rank;
  assert.equal(despublicada.total, 4);
  assert.equal(despublicada.done, 1);
  assert.equal(despublicada.percent, 25);
  await ctx.a.teacher.patch(`/lessons/${ctx.lessons[0]}`, { status: 'published' });

  // La última parada pendiente del módulo (lección 2) lo cierra: se celebra una sola vez.
  const cierre = await student.post(`/lessons/${ctx.lessons[1]}/complete`);
  assert.equal(cierre.body.data.module.title, 'Fracciones');
  assert.equal(cierre.body.data.module.completed, true);
  assert.equal(cierre.body.data.module.justCompleted, true);
  assert.equal(cierre.body.data.rank.after.name, 'Luz');
  assert.equal(cierre.body.data.rank.rankedUp, true);
  assert.equal((await student.post(`/lessons/${ctx.lessons[1]}/complete`)).body.data.module.justCompleted, false);

  // Cada estudiante ve solo su propio avance.
  assert.equal((await ctx.beto.get(`/courses/${ctx.courseId}`)).body.data.rank.done, 0);
  // El docente no recibe un rango propio en el detalle.
  assert.equal((await ctx.a.teacher.get(`/courses/${ctx.courseId}`)).body.data.rank, undefined);

  const vacio = await student.get(`/courses/${ctx.emptyCourseId}`);
  assert.equal(vacio.body.data.rank.name, 'Sin rango todavía');
  assert.equal(vacio.body.data.rank.key, null);
});

test('rango en inicio y analítica, con permisos por curso e institución', async () => {
  const inicio = await ctx.a.student.get('/me/home');
  assert.equal(inicio.status, 200);
  const tarjeta = inicio.body.data.courses.find((curso) => curso.id === ctx.courseId);
  assert.equal(tarjeta.rank.name, 'Luz');
  assert.equal(inicio.body.data.courses.find((curso) => curso.id === ctx.emptyCourseId).rank.name, 'Sin rango todavía');
  // La actividad real (lección completada hoy) define los días sin actividad.
  assert.ok(inicio.body.data.activity.lastActivityAt);
  assert.equal(inicio.body.data.activity.daysAway, 0);
  clock.now = () => new Date(Date.now() + 10 * 24 * 3600 * 1000);
  assert.equal((await ctx.a.student.get('/me/home')).body.data.activity.daysAway, 10);
  clock.now = realNow;
  // Quien nunca tuvo actividad no recibe un «regreso».
  assert.equal((await ctx.beto.get('/me/home')).body.data.activity.lastActivityAt, null);

  const analitica = await ctx.a.teacher.get(`/teacher/courses/${ctx.courseId}/analytics`);
  assert.equal(analitica.status, 200);
  const nombres = analitica.body.data.students.map((fila) => fila.displayName);
  assert.deepEqual(nombres, [...nombres].sort((x, y) => x.localeCompare(y)));
  assert.equal(analitica.body.data.students.find((fila) => fila.id === ctx.a.student.user.id).rank.name, 'Luz');
  assert.equal((await ctx.a.student.get(`/teacher/courses/${ctx.courseId}/analytics`)).status, 403);
  assert.equal((await ctx.b.teacher.get(`/teacher/courses/${ctx.courseId}/analytics`)).status, 404);
  assert.equal((await ctx.b.student.get(`/courses/${ctx.courseId}`)).status, 404);
});

test('preferencias de mascotas: encendidas por defecto y se guardan', async () => {
  const inicial = await ctx.beto.get('/me/preferences');
  assert.equal(inicial.body.data.showMascots, true);
  assert.equal(inicial.body.data.showBigCelebrations, true);
  const cambio = await ctx.beto.patch('/me/preferences', { showMascots: false, showBigCelebrations: false });
  assert.equal(cambio.status, 200);
  assert.equal(cambio.body.data.showMascots, false);
  assert.equal((await ctx.beto.get('/me/preferences')).body.data.showBigCelebrations, false);
  assert.equal((await ctx.beto.patch('/me/preferences', { showMascots: 'no' })).status, 422);
});

test('Parejas: sin preguntas con clave visible no hay tablero', async () => {
  const detalle = await ctx.a.student.get(`/courses/${ctx.courseId}`);
  assert.equal(detalle.body.data.modules.find((modulo) => modulo.id === ctx.module1).practicePairs, 0);
  const intento = await ctx.a.student.post(`/modules/${ctx.module1}/memory-games`, {});
  assert.equal(intento.status, 409);
  assert.equal(intento.body.error.code, 'NOT_ENOUGH_QUESTIONS');
});

test('Parejas: el tablero usa solo claves visibles y no revela las parejas', async () => {
  const student = ctx.a.student;
  await enviarIntento(student, ctx.a1);
  // Un intento en una evaluación abierta con intentos de sobra no libera su clave.
  await enviarIntento(student, ctx.a2);

  const detalle = await student.get(`/courses/${ctx.courseId}`);
  assert.equal(detalle.body.data.modules.find((modulo) => modulo.id === ctx.module1).practicePairs, 4);
  assert.equal(detalle.body.data.modules.find((modulo) => modulo.id === ctx.module2).practicePairs, 0);
  // Beto no respondió: para él la clave sigue oculta.
  assert.equal((await ctx.beto.get(`/courses/${ctx.courseId}`)).body.data.modules[0].practicePairs, 0);

  clock.now = () => new Date('2026-11-25T15:00:00.000Z');
  const inicio = await student.post(`/modules/${ctx.module1}/memory-games`, { pairs: 8 });
  assert.equal(inicio.status, 201, JSON.stringify(inicio.body));
  const game = inicio.body.data;
  assert.equal(game.pairCount, 4);
  assert.equal(game.cards.length, 8);
  for (const carta of game.cards) assert.deepEqual(Object.keys(carta).sort(), ['id', 'matched', 'position']);
  const crudo = JSON.stringify(inicio.body);
  for (const [stem, correcta] of PREGUNTAS_A1) {
    assert.ok(!crudo.includes(stem) && !crudo.includes(correcta), 'El tablero no debe traer textos antes de voltear.');
  }
  // El estado guardado tampoco expone parejas.
  const estado = await student.get(`/memory-games/${game.id}`);
  assert.ok(!/"(pair|questionId|kind|text)"\s*:/.test(JSON.stringify(estado.body)));

  const textos = await voltearTodo(student, game);
  const vistos = [...textos.values()];
  for (const { text } of vistos) {
    assert.ok(!PREGUNTAS_A2.flat().includes(text), 'Nunca aparecen preguntas de evaluaciones con clave oculta.');
  }
  assert.equal(vistos.filter((carta) => carta.text === 'Verdadero').length, 1);

  // Una pareja incorrecta suma un intento y no empareja.
  const preguntas = vistos.filter((carta) => carta.kind === 'question');
  const respuestaDe = (pregunta) => vistos.find((carta) => carta.kind === 'answer' && carta.text === ESPERADAS.get(pregunta.text));
  const otraRespuesta = (pregunta) => vistos.find((carta) => carta.kind === 'answer' && carta.text !== ESPERADAS.get(pregunta.text));
  const fallo = await student.post(`/memory-games/${game.id}/match`, { cardIds: [preguntas[0].id, otraRespuesta(preguntas[0]).id] });
  assert.equal(fallo.status, 200, JSON.stringify(fallo.body));
  assert.equal(fallo.body.data.match, false);
  assert.equal(fallo.body.data.attempts, 1);

  const acierto = await student.post(`/memory-games/${game.id}/match`, { cardIds: [preguntas[0].id, respuestaDe(preguntas[0]).id] });
  assert.equal(acierto.body.data.match, true);
  assert.equal(acierto.body.data.matchedPairs, 1);
  const repetida = await student.post(`/memory-games/${game.id}/match`, { cardIds: [preguntas[0].id, respuestaDe(preguntas[1]).id] });
  assert.equal(repetida.status, 409);
  assert.equal((await student.post(`/memory-games/${game.id}/match`, { cardIds: [preguntas[1].id, preguntas[1].id] })).status, 422);
  assert.equal((await student.post(`/memory-games/${game.id}/reveal`, { cardId: 'CartaInventada123' })).status, 422);

  // Otros no ven ni juegan la partida.
  assert.equal((await ctx.beto.get(`/memory-games/${game.id}`)).status, 404);
  assert.equal((await ctx.beto.post(`/memory-games/${game.id}/reveal`, { cardId: preguntas[1].id })).status, 404);
  assert.equal((await ctx.b.student.get(`/memory-games/${game.id}`)).status, 404);
  assert.equal((await ctx.a.teacher.get(`/memory-games/${game.id}`)).status, 403);

  const bonosAntes = await GradeBonusEvent.count({ where: { studentId: student.user.id } });
  clock.now = () => new Date('2026-11-25T15:01:05.000Z');
  let final;
  for (const pregunta of preguntas.slice(1)) {
    final = await student.post(`/memory-games/${game.id}/match`, { cardIds: [pregunta.id, respuestaDe(pregunta).id] });
    assert.equal(final.body.data.match, true);
  }
  assert.equal(final.body.data.finished, true);
  assert.equal(final.body.data.attempts, 5);
  assert.equal(final.body.data.elapsedSeconds, 65);
  assert.equal((await student.post(`/memory-games/${game.id}/reveal`, { cardId: preguntas[0].id })).status, 409);
  const terminado = (await student.get(`/memory-games/${game.id}`)).body.data;
  assert.equal(terminado.status, 'finished');
  assert.ok(terminado.cards.every((carta) => carta.matched && carta.text));

  // Práctica pura: sin bono y sin racha.
  assert.equal(await GradeBonusEvent.count({ where: { studentId: student.user.id } }), bonosAntes);
  assert.equal(await CourseStreak.count({ where: { studentId: student.user.id } }), 0);

  // Una carta de otra partida no sirve en un tablero nuevo.
  const nuevo = await student.post(`/modules/${ctx.module1}/memory-games`, {});
  assert.equal(nuevo.status, 201);
  assert.equal(nuevo.body.data.pairCount, 4);
  assert.equal((await student.post(`/memory-games/${nuevo.body.data.id}/reveal`, { cardId: preguntas[0].id })).status, 422);
  ctx.openGame = nuevo.body.data.id;
});

test('Parejas: módulos de otro curso o institución, otro rol y evaluación cerrada', async () => {
  assert.equal((await ctx.a.student.post(`/modules/${ctx.foreignModule}/memory-games`, {})).status, 404);
  assert.equal((await ctx.a.teacher.post(`/modules/${ctx.module1}/memory-games`, {})).status, 403);
  assert.equal((await ctx.beto.post(`/modules/${ctx.module1}/memory-games`, {})).status, 409);
  assert.equal((await ctx.a.student.post(`/modules/${ctx.module1}/memory-games`, { pairs: 5 })).status, 422);

  // Al cerrar la evaluación abierta, su clave queda visible para quien ya la respondió (y solo para esa persona).
  assert.equal((await ctx.a.teacher.post(`/assessments/${ctx.a2}/close`)).status, 200);
  const detalle = await ctx.a.student.get(`/courses/${ctx.courseId}`);
  assert.equal(detalle.body.data.modules.find((modulo) => modulo.id === ctx.module1).practicePairs, 7);
  assert.equal((await ctx.beto.get(`/courses/${ctx.courseId}`)).body.data.modules[0].practicePairs, 0);
  // Empezar otro tablero reemplaza el que quedó abierto.
  const otro = await ctx.a.student.post(`/modules/${ctx.module1}/memory-games`, {});
  assert.equal(otro.body.data.pairCount, 6);
  assert.equal((await ctx.a.student.get(`/memory-games/${ctx.openGame}`)).status, 404);
});

test('Parejas y preferencias van en la copia de datos propios', async () => {
  const copia = await ctx.a.student.get('/me/data-export');
  assert.equal(copia.status, 200);
  assert.ok(copia.body.data.learning.memoryGames.length >= 1);
  assert.ok('showMascots' in (copia.body.data.learning.preferences[0] || { showMascots: true }));
});

test('migración de mascotas y Parejas: up/down/up', async () => {
  const migration = require('../database/migrations/20261125000100-mascotas-y-parejas.js');
  const q = sequelize.getQueryInterface();
  await migration.down(q, Sequelize);
  assert.ok(!(await q.showAllTables()).includes('memory_games'));
  assert.equal((await q.describeTable('user_preferences')).show_mascots, undefined);
  await migration.up(q, Sequelize);
  assert.ok((await q.showAllTables()).includes('memory_games'));
  assert.ok((await q.describeTable('user_preferences')).show_big_celebrations);
});
