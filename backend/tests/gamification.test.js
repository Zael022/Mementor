import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, activate } from './helpers.js';
import { clock } from '../src/utils/clock.js';
import { GradeBonusEvent, DailyPractice } from '../src/models/index.js';
import { pointsFor } from '../src/services/quickQuizService.js';
import { combine } from '../src/services/gradeService.js';

// Prueba la nota del curso, los quizzes rápidos y la racha con datos temporales y un reloj simulado.
const ctx = {};
const realNow = clock.now;
const DIA = 24 * 3600 * 1000;
// Mediodía en Costa Rica para que sumar días no cruce la medianoche por accidente.
const BASE = new Date('2026-11-19T18:00:00Z').getTime();
const enDia = (dias, ms = 0) => { clock.now = () => new Date(BASE + dias * DIA + ms); };


async function inviteAndActivate(session, path, body) {
  const invited = await session.post(path, body);
  assert.equal(invited.status, 201, JSON.stringify(invited.body));
  assert.equal((await activate(invited.body.data.invitationToken)).status, 200);
  return loginAs(body.email);
}

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.juego@prueba.test');
  const platform = await loginAs('operador.juego@prueba.test');
  const a = await platform.post('/institutions', { name: 'Juego A de prueba' });
  const b = await platform.post('/institutions', { name: 'Juego B de prueba' });
  const adminA = await inviteAndActivate(platform, `/institutions/${a.body.data.id}/admins`, { email: 'admin.juego.a@prueba.test', displayName: 'Admin A' });
  const adminB = await inviteAndActivate(platform, `/institutions/${b.body.data.id}/admins`, { email: 'admin.juego.b@prueba.test', displayName: 'Admin B' });
  ctx.teacher = await inviteAndActivate(adminA, '/users', { email: 'docente.juego@prueba.test', displayName: 'Docente Juego', role: 'teacher' });
  ctx.student = await inviteAndActivate(adminA, '/users', { email: 'ana.juego@prueba.test', displayName: 'Ana', role: 'student' });
  ctx.student2 = await inviteAndActivate(adminA, '/users', { email: 'beto.juego@prueba.test', displayName: 'Beto', role: 'student' });
  ctx.outsider = await inviteAndActivate(adminA, '/users', { email: 'ajeno.juego@prueba.test', displayName: 'Ajeno', role: 'student' });
  ctx.teacherB = await inviteAndActivate(adminB, '/users', { email: 'docente.juego.b@prueba.test', displayName: 'Docente B', role: 'teacher' });

  const course = await ctx.teacher.post('/courses', { code: 'JUEGO-1', title: 'Curso temporal de juego' });
  ctx.courseId = course.body.data.id;
  const vacio = await ctx.teacher.post('/courses', { code: 'JUEGO-2', title: 'Curso sin banco' });
  ctx.emptyCourseId = vacio.body.data.id;
  for (const id of [ctx.courseId, ctx.emptyCourseId]) {
    await ctx.teacher.patch(`/courses/${id}`, { status: 'published' });
    await ctx.teacher.post(`/courses/${id}/enrollments`, { studentId: ctx.student.user.id });
  }
  await ctx.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.student2.user.id });
});

afterEach(() => { clock.now = realNow; });
after(async () => { clock.now = realNow; await closeDatabase(); });

test('los puntos bajan con el tiempo: 1000 al instante y nunca menos de 500 si es correcta', () => {
  assert.equal(pointsFor(0, 20000), 1000);
  assert.equal(pointsFor(10000, 20000), 750);
  assert.equal(pointsFor(25000, 20000), 500);
});

test('la nota combina pesos, reparte el peso de lo que falta y respeta el tope del bono', () => {
  const policy = { assessmentsWeight: 40, assignmentsWeight: 30, classworkWeight: 30, bonusCap: 0.5 };
  const todo = combine({ assessmentsPct: 100, assignmentsPct: 50, classworkPct: 75, policy, bonus: { quiz: 0.3, streak: 0.45 } });
  assert.deepEqual([todo.base, todo.bonusEarned, todo.bonusApplied, todo.final], [7.75, 0.75, 0.5, 8.25]);
  const soloEvaluaciones = combine({ assessmentsPct: 80, assignmentsPct: null, classworkPct: null, policy, bonus: { quiz: 0, streak: 0 } });
  assert.equal(soloEvaluaciones.base, 8);
  const nada = combine({ assessmentsPct: null, assignmentsPct: null, policy, bonus: { quiz: 0.1, streak: 0 } });
  assert.equal(nada.final, null);
  const tope = combine({ assessmentsPct: 100, assignmentsPct: 100, classworkPct: 100, policy, bonus: { quiz: 1, streak: 0 } });
  assert.equal(tope.final, 10);
});

test('el docente arma y publica un quiz; nadie más puede editarlo', async () => {
  assert.equal((await ctx.student.post(`/courses/${ctx.courseId}/quick-quizzes`, { title: 'No' })).status, 403);
  assert.equal((await ctx.teacherB.get(`/courses/${ctx.courseId}/quick-quizzes`)).status, 404);

  const quiz = await ctx.teacher.post(`/courses/${ctx.courseId}/quick-quizzes`, { title: 'Repaso relámpago', secondsPerQuestion: 10 });
  assert.equal(quiz.status, 201, JSON.stringify(quiz.body));
  ctx.quizId = quiz.body.data.id;

  assert.equal((await ctx.teacher.post(`/quick-quizzes/${ctx.quizId}/publish`)).status, 422);
  const dosCorrectas = await ctx.teacher.post(`/quick-quizzes/${ctx.quizId}/questions`, {
    prompt: '¿2 + 2?', options: [{ body: '4', isCorrect: true }, { body: 'Cuatro', isCorrect: true }],
  });
  assert.equal(dosCorrectas.status, 422);

  ctx.questions = [];
  for (const [prompt, correcta] of [['¿Capital de Costa Rica?', 'San José'], ['¿3 × 3?', '9']]) {
    const created = await ctx.teacher.post(`/quick-quizzes/${ctx.quizId}/questions`, {
      prompt, options: [{ body: correcta, isCorrect: true }, { body: 'Otra', isCorrect: false }, { body: 'Ninguna', isCorrect: false }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ctx.questions.push(created.body.data);
  }
  assert.equal((await ctx.student.get(`/courses/${ctx.courseId}/quick-quizzes`)).body.data.length, 0);
  assert.equal((await ctx.teacher.post(`/quick-quizzes/${ctx.quizId}/publish`)).status, 200);
  const bloqueado = await ctx.teacher.post(`/quick-quizzes/${ctx.quizId}/questions`, { prompt: 'Tarde', options: [{ body: 'a', isCorrect: true }, { body: 'b', isCorrect: false }] });
  assert.equal(bloqueado.status, 409);
  assert.equal((await ctx.student.get(`/quick-quizzes/${ctx.quizId}`)).status, 403);
  assert.equal((await ctx.student.get(`/courses/${ctx.courseId}/quick-quizzes`)).body.data.length, 1);
});

const correctaDe = (questionId) => ctx.questions.find((q) => q.id === questionId).options.find((o) => o.isCorrect).id;
const incorrectaDe = (questionId) => ctx.questions.find((q) => q.id === questionId).options.find((o) => !o.isCorrect).id;

test('el servidor mide el tiempo, no revela la clave antes de responder y una respuesta tardía vale 0', async () => {
  enDia(0);
  assert.equal((await ctx.outsider.post(`/quick-quizzes/${ctx.quizId}/plays`)).status, 403);
  const play = await ctx.student.post(`/quick-quizzes/${ctx.quizId}/plays`);
  assert.equal(play.status, 201, JSON.stringify(play.body));
  const playId = play.body.data.playId;

  const primera = await ctx.student.post(`/quiz-plays/${playId}/next`);
  assert.equal(primera.status, 200, JSON.stringify(primera.body));
  assert.equal(JSON.stringify(primera.body).includes('isCorrect'), false);
  const q1 = primera.body.data.question.id;

  enDia(0, 2000);
  // Recargar la página no reinicia el reloj.
  assert.equal((await ctx.student.post(`/quiz-plays/${playId}/next`)).body.data.secondsLeft, 8);
  const bien = await ctx.student.post(`/quiz-plays/${playId}/answers`, { questionId: q1, optionId: correctaDe(q1) });
  assert.equal(bien.body.data.isCorrect, true);
  assert.equal(bien.body.data.points, 900);
  assert.equal(bien.body.data.correctOptionId, correctaDe(q1));
  assert.equal((await ctx.student.post(`/quiz-plays/${playId}/answers`, { questionId: q1, optionId: correctaDe(q1) })).status, 409);

  const segunda = await ctx.student.post(`/quiz-plays/${playId}/next`);
  const q2 = segunda.body.data.question.id;
  enDia(0, 2000 + 15000);
  const tarde = await ctx.student.post(`/quiz-plays/${playId}/answers`, { questionId: q2, optionId: correctaDe(q2) });
  assert.equal(tarde.body.data.timedOut, true);
  assert.equal(tarde.body.data.points, 0);
  assert.equal(tarde.body.data.isLast, true);
  assert.equal(tarde.body.data.summary.perfect, false);
  assert.equal(tarde.body.data.summary.bonus.awarded, false);
  assert.equal((await ctx.student.post(`/quiz-plays/${playId}/next`)).status, 409);
});

test('una pregunta sin responder vence sola y la siguiente partida cierra la anterior', async () => {
  enDia(0);
  const play = (await ctx.student2.post(`/quick-quizzes/${ctx.quizId}/plays`)).body.data.playId;
  await ctx.student2.post(`/quiz-plays/${play}/next`);
  enDia(0, 30000);
  const siguiente = await ctx.student2.post(`/quiz-plays/${play}/next`);
  assert.equal(siguiente.body.data.index, 2);
  const otra = (await ctx.student2.post(`/quick-quizzes/${ctx.quizId}/plays`)).body.data.playId;
  assert.notEqual(otra, play);
  assert.equal((await ctx.student2.post(`/quiz-plays/${play}/next`)).status, 409);
});

async function jugarPerfecto(sesion) {
  const playId = (await sesion.post(`/quick-quizzes/${ctx.quizId}/plays`)).body.data.playId;
  let ultimo;
  for (;;) {
    const next = await sesion.post(`/quiz-plays/${playId}/next`);
    if (next.body.data.finished) break;
    const q = next.body.data.question.id;
    ultimo = (await sesion.post(`/quiz-plays/${playId}/answers`, { questionId: q, optionId: correctaDe(q) })).body.data;
    if (ultimo.isLast) break;
  }
  return { playId, ultimo };
}

test('un quiz perfecto da el bono una sola vez, aunque se repita', async () => {
  enDia(0);
  const primero = await jugarPerfecto(ctx.student);
  assert.equal(primero.ultimo.summary.perfect, true);
  assert.deepEqual(primero.ultimo.summary.bonus, { awarded: true, amount: 0.1 });
  const segundo = await jugarPerfecto(ctx.student);
  assert.equal(segundo.ultimo.summary.bonus.awarded, false);
  assert.equal(await GradeBonusEvent.count({ where: { studentId: ctx.student.user.id, kind: 'quiz' } }), 1);

  const resultado = await ctx.student.get(`/quiz-plays/${primero.playId}`);
  assert.equal(resultado.body.data.leaderboard[0].displayName, 'Ana');
  assert.equal(resultado.body.data.leaderboard[0].isMe, true);
  assert.equal((await ctx.student2.get(`/quiz-plays/${primero.playId}`)).status, 404);
  const lista = await ctx.student.get(`/courses/${ctx.courseId}/quick-quizzes`);
  assert.equal(lista.body.data[0].perfect, true);
});

async function completarPractica(sesion, courseId) {
  const hoy = await sesion.get(`/courses/${courseId}/daily-practice`);
  assert.equal(hoy.status, 200, JSON.stringify(hoy.body));
  let ultimo;
  for (const pregunta of hoy.body.data.questions.filter((q) => !q.answer)) {
    ultimo = await sesion.post(`/courses/${courseId}/daily-practice/answers`, { questionId: pregunta.id, optionId: incorrectaDe(pregunta.id) });
    assert.equal(ultimo.status, 200, JSON.stringify(ultimo.body));
  }
  return { hoy: hoy.body.data, ultimo: ultimo?.body.data };
}

test('dos aperturas simultáneas de práctica crean una sola selección de preguntas', async () => {
  enDia(30);
  const replies = await Promise.all([ctx.student.get(`/courses/${ctx.courseId}/daily-practice`), ctx.student.get(`/courses/${ctx.courseId}/daily-practice`)]);
  replies.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.body)));
  assert.deepEqual(replies[0].body.data.questions.map((q) => q.id), replies[1].body.data.questions.map((q) => q.id));
  assert.equal(await DailyPractice.count({ where: { courseId: ctx.courseId, studentId: ctx.student.user.id, practiceDay: '2026-12-19' } }), 1);
});

test('la práctica diaria mantiene la racha, suma 0,09 por día y se reinicia si falta un día', async () => {
  assert.equal((await ctx.teacher.get(`/courses/${ctx.courseId}/daily-practice`)).status, 403);
  const sinBanco = await ctx.student.get(`/courses/${ctx.emptyCourseId}/daily-practice`);
  assert.equal(sinBanco.body.data.available, false);

  enDia(0);
  const dia1 = await completarPractica(ctx.student, ctx.courseId);
  assert.equal(dia1.hoy.required, 2);
  assert.equal(JSON.stringify(dia1.hoy.questions).includes('correctOptionId'), false);
  // Cuenta haber respondido, no acertar.
  assert.equal(dia1.ultimo.isCorrect, false);
  assert.equal(dia1.ultimo.completed, true);
  assert.deepEqual(dia1.ultimo.bonus, { awarded: true, amount: 0.09 });
  assert.equal(dia1.ultimo.streak.current, 1);
  const repetida = await ctx.student.get(`/courses/${ctx.courseId}/daily-practice`);
  assert.equal(repetida.body.data.completed, true);
  assert.ok(repetida.body.data.questions.every((q) => q.answer.correctOptionId));

  enDia(1);
  const enRiesgo = await ctx.student.get(`/courses/${ctx.courseId}/daily-practice`);
  assert.equal(enRiesgo.body.data.streak.atRisk, true);
  const dia2 = await completarPractica(ctx.student, ctx.courseId);
  assert.equal(dia2.ultimo.streak.current, 2);

  enDia(3);
  const perdida = await ctx.student.get(`/courses/${ctx.courseId}/daily-practice`);
  assert.equal(perdida.body.data.streak.current, 0);
  const dia4 = await completarPractica(ctx.student, ctx.courseId);
  assert.equal(dia4.ultimo.streak.current, 1);
  assert.equal(dia4.ultimo.streak.best, 2);
  assert.equal(await GradeBonusEvent.count({ where: { studentId: ctx.student.user.id, kind: 'streak_day' } }), 3);
});

test('el docente califica trabajo en clase y tareas, define pesos y tope, y la nota final lo suma todo', async () => {
  // Trabajo en clase.
  const item = await ctx.teacher.post(`/courses/${ctx.courseId}/class-work`, { title: 'Participación semana 1', maxPoints: 20, workDate: '2026-11-18' });
  assert.equal(item.status, 201, JSON.stringify(item.body));
  const itemId = item.body.data.id;
  assert.equal((await ctx.student.put(`/class-work/${itemId}/grades`, { grades: [{ studentId: ctx.student.user.id, points: 20 }] })).status, 403);
  assert.equal((await ctx.teacher.put(`/class-work/${itemId}/grades`, { grades: [{ studentId: ctx.student.user.id, points: 25 }] })).status, 422);
  assert.equal((await ctx.teacher.put(`/class-work/${itemId}/grades`, { grades: [{ studentId: ctx.outsider.user.id, points: 10 }] })).status, 422);
  assert.equal((await ctx.teacherB.put(`/class-work/${itemId}/grades`, { grades: [{ studentId: ctx.student.user.id, points: 10 }] })).status, 404);
  const calificado = await ctx.teacher.put(`/class-work/${itemId}/grades`, {
    grades: [{ studentId: ctx.student.user.id, points: 15, feedback: 'Buen aporte' }, { studentId: ctx.student2.user.id, points: 18 }],
  });
  assert.equal(calificado.status, 200, JSON.stringify(calificado.body));
  // null borra la nota de Beto.
  await ctx.teacher.put(`/class-work/${itemId}/grades`, { grades: [{ studentId: ctx.student2.user.id, points: null }] });
  const vistaAna = await ctx.student.get(`/courses/${ctx.courseId}/class-work`);
  assert.deepEqual(vistaAna.body.data[0].grades, [{ studentId: ctx.student.user.id, points: 15, feedback: 'Buen aporte' }]);

  // Tarea calificada en 50 de 100.
  const tarea = await ctx.teacher.post(`/courses/${ctx.courseId}/assignments`, { title: 'Tarea 1', instructions: 'Resuelve.', maxPoints: 100 });
  await ctx.teacher.patch(`/assignments/${tarea.body.data.id}`, { status: 'published' });
  await ctx.student.post(`/assignments/${tarea.body.data.id}/submission`, { body: 'Mi trabajo' });
  const detalle = await ctx.teacher.get(`/assignments/${tarea.body.data.id}`);
  const entrega = detalle.body.data.students.find((s) => s.studentId === ctx.student.user.id || s.id === ctx.student.user.id)?.submission
    ?? detalle.body.data.students.find((s) => s.submission)?.submission;
  assert.equal((await ctx.teacher.patch(`/submissions/${entrega.id}/grade`, { gradePoints: 50 })).status, 200);

  // Evaluación con 100 %.
  const modulo = await ctx.teacher.post(`/courses/${ctx.courseId}/modules`, { title: 'Módulo' });
  const tema = await ctx.teacher.post(`/modules/${modulo.body.data.id}/topics`, { title: 'Tema' });
  const evaluacion = await ctx.teacher.post(`/courses/${ctx.courseId}/assessments`, { title: 'Parcial', topicId: tema.body.data.id, passingScore: 60, maxAttempts: 1 });
  const pregunta = await ctx.teacher.post(`/assessments/${evaluacion.body.data.id}/questions`, {
    stem: '¿5 - 2?', points: 1, options: [{ body: '3', isCorrect: true }, { body: '4', isCorrect: false }],
  });
  await ctx.teacher.post(`/assessments/${evaluacion.body.data.id}/publish`);
  const intento = await ctx.student.post(`/assessments/${evaluacion.body.data.id}/attempts`);
  const correcta = pregunta.body.data.options.find((o) => o.isCorrect).id;
  await ctx.student.post(`/attempts/${intento.body.data.attemptId}/submit`, { answers: [{ questionId: pregunta.body.data.id, selectedOptionId: correcta }] });

  // Pesos y tope.
  const malos = await ctx.teacher.put(`/courses/${ctx.courseId}/grade-policy`, { assessmentsWeight: 50, assignmentsWeight: 30, classworkWeight: 30, quizBonus: 0.1, streakDayBonus: 0.09, bonusCap: 0.3 });
  assert.equal(malos.status, 422);
  assert.equal((await ctx.student.put(`/courses/${ctx.courseId}/grade-policy`, { assessmentsWeight: 40, assignmentsWeight: 30, classworkWeight: 30, quizBonus: 0.1, streakDayBonus: 0.09, bonusCap: 0.3 })).status, 403);
  const politica = await ctx.teacher.put(`/courses/${ctx.courseId}/grade-policy`, { assessmentsWeight: 40, assignmentsWeight: 30, classworkWeight: 30, quizBonus: 0.1, streakDayBonus: 0.09, bonusCap: 0.3 });
  assert.equal(politica.status, 200, JSON.stringify(politica.body));

  // Ana: 0,4·100 + 0,3·50 + 0,3·75 = 77,5 % → 7,75; bono ganado 0,1 + 3·0,09 = 0,37, aplicado 0,3 → 8,05.
  const mia = await ctx.student.get(`/courses/${ctx.courseId}/my-grade`);
  assert.equal(mia.status, 200, JSON.stringify(mia.body));
  const nota = mia.body.data.grade;
  assert.deepEqual(
    [nota.assessmentsPct, nota.assignmentsPct, nota.classworkPct, nota.base, nota.bonusEarned, nota.bonusApplied, nota.final],
    [100, 50, 75, 7.75, 0.37, 0.3, 8.05],
  );
  assert.equal(nota.perfectQuizzes, 1);
  assert.equal(nota.streakDaysEarned, 3);

  assert.equal((await ctx.student.get(`/courses/${ctx.courseId}/grades`)).status, 403);
  assert.equal((await ctx.teacherB.get(`/courses/${ctx.courseId}/grades`)).status, 404);
  const tabla = await ctx.teacher.get(`/courses/${ctx.courseId}/grades`);
  assert.equal(tabla.body.data.students.length, 2);
  const beto = tabla.body.data.students.find((s) => s.displayName === 'Beto');
  // Beto no tiene nada calificado todavía: sin nota final, no un 0 inventado.
  assert.equal(beto.final, null);
  assert.equal(tabla.body.data.policy.saved, true);
});

test('vistas tipo aula: personas sin correos para el alumno, calendario, pendientes y perfil', async () => {
  const personas = await ctx.student.get(`/courses/${ctx.courseId}/people`);
  assert.equal(personas.status, 200, JSON.stringify(personas.body));
  assert.deepEqual(personas.body.data.teachers.map((p) => p.displayName), ['Docente Juego']);
  assert.deepEqual(personas.body.data.students.map((p) => p.displayName), ['Ana', 'Beto']);
  assert.equal(JSON.stringify(personas.body).includes('@'), false);
  assert.ok((await ctx.teacher.get(`/courses/${ctx.courseId}/people`)).body.data.students[0].email);
  assert.equal((await ctx.outsider.get(`/courses/${ctx.courseId}/people`)).status, 403);

  const due = new Date(Date.now() + 2 * DIA);
  const tarea = await ctx.teacher.post(`/courses/${ctx.courseId}/assignments`, { title: 'Tarea con fecha', instructions: 'Hazla.', dueAt: due.toISOString() });
  await ctx.teacher.patch(`/assignments/${tarea.body.data.id}`, { status: 'published' });
  const vencida = await ctx.teacher.post(`/courses/${ctx.courseId}/assignments`, { title: 'Tarea vencida', instructions: 'Tarde.', dueAt: new Date(Date.now() - DIA).toISOString() });
  await ctx.teacher.patch(`/assignments/${vencida.body.data.id}`, { status: 'published' });

  const desde = new Date(Date.now() - 3 * DIA).toISOString();
  const hasta = new Date(Date.now() + 7 * DIA).toISOString();
  const calendario = await ctx.student.get(`/me/calendar?from=${desde}&to=${hasta}`);
  assert.equal(calendario.status, 200, JSON.stringify(calendario.body));
  assert.deepEqual(calendario.body.data.items.map((i) => i.title), ['Tarea vencida', 'Tarea con fecha']);
  assert.equal((await ctx.student.get(`/me/calendar?from=${desde}&to=${new Date(Date.now() + 90 * DIA).toISOString()}`)).status, 422);

  const pendientes = await ctx.student.get('/me/todo');
  assert.ok(pendientes.body.data.assigned.some((t) => t.title === 'Tarea con fecha'));
  assert.ok(pendientes.body.data.missing.some((t) => t.title === 'Tarea vencida'));
  assert.ok(pendientes.body.data.done.some((t) => t.title === 'Tarea 1'));
  assert.equal(pendientes.body.data.streaks[0].courseId, ctx.courseId);
  // Ana entregó «Tarea 1» y ya está calificada: no queda nada por revisar.
  assert.deepEqual((await ctx.teacher.get('/me/todo')).body.data.toReview, []);
  await ctx.student2.post(`/assignments/${tarea.body.data.id}/submission`, { body: 'Lista' });
  assert.equal((await ctx.teacher.get('/me/todo')).body.data.toReview[0].studentName, 'Beto');

  const perfil = await ctx.student.patch('/me/profile', { displayName: 'Ana María' });
  assert.equal(perfil.body.data.displayName, 'Ana María');
  assert.equal((await ctx.student.get('/auth/me')).body.data.user?.displayName ?? (await ctx.student.get('/auth/me')).body.data.displayName, 'Ana María');
});
