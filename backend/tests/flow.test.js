import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  app, request, prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, activate, PASSWORD,
} from './helpers.js';
import { AiMessage, User } from '../src/models/index.js';
import { askTutor } from '../src/services/tutorService.js';

// Recorre la historia principal con datos temporales en la base de pruebas.
const ctx = {};

before(async () => {
  for (const key of ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL']) delete process.env[key];
  await prepareDatabase();
});
after(closeDatabase);

// Invita a una persona y activa su cuenta.
async function inviteAndActivate(session, path, body) {
  const invited = await session.post(path, body);
  assert.equal(invited.status, 201, JSON.stringify(invited.body));
  assert.equal((await activate(invited.body.data.invitationToken)).status, 200);
  return loginAs(body.email);
}

test('la API responde y la base inicia sin registros', async () => {
  const health = await request(app).get('/api/v1/health');
  assert.equal(health.status, 200);
  // Informa qué está configurado sin exponer claves, proyectos ni proveedores.
  assert.deepEqual(health.body.data, {
    status: 'ok', database: 'connected', tutor: { configured: false }, retrieval: { mode: 'local', configured: true }, googleCloud: { required: false, configured: null },
  });
  assert.equal(await User.count(), 0);
});

test('rechaza solicitudes sin sesión y credenciales inválidas', async () => {
  assert.equal((await request(app).get('/api/v1/courses')).status, 401);
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'nadie@prueba.test', password: 'incorrecta123' });
  assert.equal(login.status, 401);
  assert.equal(login.body.error.code, 'UNAUTHENTICATED');
});

test('el administrador de plataforma crea instituciones e invita administradores', async () => {
  await createPlatformAdmin('operador@prueba.test');
  ctx.platform = await loginAs('operador@prueba.test');

  const sinCsrf = await ctx.platform.agent.post('/api/v1/institutions').send({ name: 'Sin token' });
  assert.equal(sinCsrf.status, 403);

  const a = await ctx.platform.post('/institutions', { name: 'Institución A de prueba' });
  const b = await ctx.platform.post('/institutions', { name: 'Institución B de prueba' });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  ctx.adminA = await inviteAndActivate(ctx.platform, `/institutions/${a.body.data.id}/admins`, { email: 'admin.a@prueba.test', displayName: 'Admin A' });
  ctx.adminB = await inviteAndActivate(ctx.platform, `/institutions/${b.body.data.id}/admins`, { email: 'admin.b@prueba.test', displayName: 'Admin B' });

  assert.equal((await ctx.platform.get('/courses')).body.data.length, 0);
});

test('la invitación exige contraseña segura y es de un solo uso', async () => {
  const invited = await ctx.adminA.post('/users', { email: 'docente.a@prueba.test', displayName: 'Docente A', role: 'teacher' });
  assert.equal(invited.status, 201);
  assert.equal(invited.body.data.user.passwordHash, undefined);
  const token = invited.body.data.invitationToken;

  const weak = await request(app).post('/api/v1/auth/activate').send({ token, password: 'corta' });
  assert.equal(weak.status, 422);
  assert.equal((await activate(token)).status, 200);
  assert.equal((await activate(token)).status, 422);
  ctx.teacher = await loginAs('docente.a@prueba.test');

  ctx.student = await inviteAndActivate(ctx.adminA, '/users', { email: 'estudiante1@prueba.test', displayName: 'Estudiante Uno', role: 'student' });
  ctx.other = await inviteAndActivate(ctx.adminA, '/users', { email: 'estudiante2@prueba.test', displayName: 'Estudiante Dos', role: 'student' });
  ctx.teacherB = await inviteAndActivate(ctx.adminB, '/users', { email: 'docente.b@prueba.test', displayName: 'Docente B', role: 'teacher' });
});

test('el docente crea curso, módulo, temas, lección y evaluación', async () => {
  assert.equal((await ctx.student.post('/courses', { code: 'X1', title: 'No permitido' })).status, 403);

  const course = await ctx.teacher.post('/courses', { code: 'MAT-101', title: 'Curso temporal de prueba' });
  assert.equal(course.status, 201);
  ctx.courseId = course.body.data.id;

  const module = await ctx.teacher.post(`/courses/${ctx.courseId}/modules`, { title: 'Módulo 1' });
  const topic1 = await ctx.teacher.post(`/modules/${module.body.data.id}/topics`, { title: 'Tema 1', learningObjective: 'Objetivo 1' });
  const topic2 = await ctx.teacher.post(`/modules/${module.body.data.id}/topics`, { title: 'Tema 2' });
  ctx.topic1 = topic1.body.data.id;
  ctx.topic2 = topic2.body.data.id;
  assert.equal((await ctx.teacher.put(`/topics/${ctx.topic2}/prerequisites`, { prerequisiteTopicIds: [ctx.topic1] })).status, 200);
  assert.equal((await ctx.teacher.put(`/topics/${ctx.topic1}/prerequisites`, { prerequisiteTopicIds: [ctx.topic2] })).status, 422);

  const published = await ctx.teacher.post(`/topics/${ctx.topic1}/lessons`, { title: 'Lección publicada', bodyMd: '# Fracciones\n\nUna fracción representa partes de un entero.' });
  const draft = await ctx.teacher.post(`/topics/${ctx.topic1}/lessons`, { title: 'Lección en borrador', bodyMd: 'Contenido aún no publicado.' });
  ctx.lessonId = published.body.data.id;
  ctx.draftLessonId = draft.body.data.id;
  assert.equal((await ctx.teacher.patch(`/lessons/${ctx.lessonId}`, { status: 'published' })).status, 200);

  const assessment = await ctx.teacher.post(`/courses/${ctx.courseId}/assessments`, { title: 'Cuestionario 1', topicId: ctx.topic1, maxAttempts: 2 });
  ctx.assessmentId = assessment.body.data.id;
  assert.equal((await ctx.teacher.post(`/assessments/${ctx.assessmentId}/publish`)).status, 422);

  const dosCorrectas = await ctx.teacher.post(`/assessments/${ctx.assessmentId}/questions`, {
    stem: 'Pregunta inválida', options: [{ body: 'A', isCorrect: true }, { body: 'B', isCorrect: true }],
  });
  assert.equal(dosCorrectas.status, 422);

  ctx.questions = [];
  for (const stem of ['Pregunta uno', 'Pregunta dos']) {
    const question = await ctx.teacher.post(`/assessments/${ctx.assessmentId}/questions`, {
      stem, explanation: 'Explicación de prueba', options: [{ body: 'Correcta', isCorrect: true }, { body: 'Incorrecta', isCorrect: false }],
    });
    assert.equal(question.status, 201);
    ctx.questions.push(question.body.data);
  }
  assert.equal((await ctx.teacher.post(`/assessments/${ctx.assessmentId}/publish`)).status, 200);
  const bloqueada = await ctx.teacher.post(`/assessments/${ctx.assessmentId}/questions`, {
    stem: 'Pregunta tardía', options: [{ body: 'A', isCorrect: true }, { body: 'B', isCorrect: false }],
  });
  assert.equal(bloqueada.body.error.code, 'ASSESSMENT_LOCKED');

  assert.equal((await ctx.teacher.patch(`/courses/${ctx.courseId}`, { status: 'published' })).status, 200);
});

test('solo el estudiante matriculado accede al curso y nunca recibe la clave', async () => {
  assert.equal((await ctx.student.get(`/courses/${ctx.courseId}`)).status, 403);
  assert.equal((await ctx.student.get('/courses')).body.data.length, 0);

  const enroll = await ctx.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.student.user.id });
  assert.equal(enroll.status, 201);

  const detail = await ctx.student.get(`/courses/${ctx.courseId}`);
  assert.equal(detail.status, 200);
  const lessons = detail.body.data.modules[0].topics[0].lessons;
  assert.deepEqual(lessons.map((lesson) => lesson.id), [ctx.lessonId]);
  assert.equal((await ctx.student.get(`/lessons/${ctx.draftLessonId}`)).status, 404);
  assert.equal((await ctx.student.post(`/lessons/${ctx.lessonId}/complete`)).status, 200);

  const assessment = await ctx.student.get(`/assessments/${ctx.assessmentId}`);
  assert.equal(assessment.status, 200);
  assert.equal(JSON.stringify(assessment.body).includes('isCorrect'), false);
  assert.equal(JSON.stringify(assessment.body).includes('Explicación de prueba'), false);
});

test('la evaluación se califica de forma determinista y actualiza el dominio', async () => {
  const start = await ctx.student.post(`/assessments/${ctx.assessmentId}/attempts`);
  assert.equal(start.status, 201);
  const again = await ctx.student.post(`/assessments/${ctx.assessmentId}/attempts`);
  assert.equal(again.body.data.attemptId, start.body.data.attemptId);
  ctx.attemptId = start.body.data.attemptId;

  const [q1, q2] = ctx.questions;
  const pick = (question, correct) => question.options.find((option) => option.isCorrect === correct).id;
  const ajena = await ctx.student.post(`/attempts/${ctx.attemptId}/submit`, { answers: [{ questionId: q1.id, selectedOptionId: pick(q2, true) }] });
  assert.equal(ajena.status, 422);

  const submit = await ctx.student.post(`/attempts/${ctx.attemptId}/submit`, {
    answers: [{ questionId: q1.id, selectedOptionId: pick(q1, true) }, { questionId: q2.id, selectedOptionId: pick(q2, false) }],
  });
  assert.equal(submit.status, 200, JSON.stringify(submit.body));
  assert.equal(submit.body.data.scorePct, 50);
  assert.equal(submit.body.data.passed, false);
  assert.deepEqual(submit.body.data.mastery[0], { topicId: ctx.topic1, masteryScore: 0.5, evidenceCount: 2, label: 'estimacion_inicial', recommendation: 'reinforce' });

  const repeated = await ctx.student.post(`/attempts/${ctx.attemptId}/submit`, { answers: [] });
  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.error.code, 'ALREADY_SUBMITTED');

  const result = await ctx.student.get(`/attempts/${ctx.attemptId}/result`);
  assert.equal(result.body.data.keyRevealed, false);
  assert.equal(JSON.stringify(result.body.data.questions).includes('"isCorrect":true,"earnedPoints"'), true);
  assert.equal(result.body.data.questions[0].options[0].isCorrect, undefined);

  const mastery = await ctx.student.get(`/me/mastery?courseId=${ctx.courseId}`);
  assert.equal(mastery.body.data.find((row) => row.topicId === ctx.topic2).label, 'sin_evidencia');
  const recommendations = await ctx.student.get(`/me/recommendations?courseId=${ctx.courseId}`);
  assert.equal(recommendations.body.data.length, 1);
  assert.match(recommendations.body.data[0].reason, /Acertaste 1 de tus últimas 2/);
});

test('respeta el máximo de intentos y revela la clave al agotarlos', async () => {
  const second = await ctx.student.post(`/assessments/${ctx.assessmentId}/attempts`);
  assert.equal(second.status, 201);
  const answers = ctx.questions.map((question) => ({ questionId: question.id, selectedOptionId: question.options.find((option) => option.isCorrect).id }));
  const submit = await ctx.student.post(`/attempts/${second.body.data.attemptId}/submit`, { answers });
  assert.equal(submit.body.data.scorePct, 100);
  assert.equal(submit.body.data.mastery[0].masteryScore, 0.667);

  const third = await ctx.student.post(`/assessments/${ctx.assessmentId}/attempts`);
  assert.equal(third.body.error.code, 'ATTEMPTS_EXHAUSTED');
  const result = await ctx.student.get(`/attempts/${ctx.attemptId}/result`);
  assert.equal(result.body.data.keyRevealed, true);
});

test('otros estudiantes, docentes e instituciones no ven registros ajenos', async () => {
  assert.equal((await ctx.other.get(`/courses/${ctx.courseId}`)).status, 403);
  assert.equal((await ctx.other.get(`/assessments/${ctx.assessmentId}`)).status, 403);
  assert.equal((await ctx.other.get(`/attempts/${ctx.attemptId}/result`)).status, 403);
  assert.equal((await ctx.other.post(`/attempts/${ctx.attemptId}/submit`, { answers: [] })).status, 404);

  assert.equal((await ctx.adminB.get(`/courses/${ctx.courseId}`)).status, 404);
  assert.equal((await ctx.teacherB.get(`/lessons/${ctx.lessonId}`)).status, 404);
  assert.equal((await ctx.teacherB.patch(`/courses/${ctx.courseId}`, { title: 'Cambio ajeno' })).status, 404);
  assert.equal((await ctx.adminB.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.other.user.id })).status, 404);
  assert.equal((await ctx.adminB.get('/users')).body.data.some((user) => user.email === 'estudiante1@prueba.test'), false);
  assert.equal((await ctx.platform.get(`/courses/${ctx.courseId}`)).status, 404);
});

test('el docente ve analítica calculada con registros reales', async () => {
  const analytics = await ctx.teacher.get(`/teacher/courses/${ctx.courseId}/analytics`);
  assert.equal(analytics.status, 200);
  assert.equal(analytics.body.data.enrolledStudents, 1);
  assert.equal(analytics.body.data.assessments[0].submittedAttempts, 2);
  assert.equal(analytics.body.data.assessments[0].averageScorePct, 75);
  assert.equal(analytics.body.data.topics[0].correctPct, 75);
  assert.equal(analytics.body.data.topics[1].correctPct, null);
  assert.equal((await ctx.student.get(`/teacher/courses/${ctx.courseId}/analytics`)).status, 403);
});

test('sin proveedor configurado el tutor informa AI_NOT_CONFIGURED y no guarda nada', async () => {
  const thread = await ctx.student.post(`/courses/${ctx.courseId}/tutor/threads`, { title: 'Dudas' });
  assert.equal(thread.status, 201);
  ctx.threadId = thread.body.data.id;
  const reply = await ctx.student.post(`/tutor/threads/${ctx.threadId}/messages`, { question: '¿Qué es una fracción?' });
  assert.equal(reply.status, 503);
  assert.equal(reply.body.error.code, 'AI_NOT_CONFIGURED');
  assert.equal(await AiMessage.count(), 0);
  assert.equal((await ctx.other.post(`/courses/${ctx.courseId}/tutor/threads`, {})).status, 403);
  assert.equal((await ctx.other.get(`/tutor/threads/${ctx.threadId}/messages`)).status, 404);
});

test('el tutor solo usa lecciones publicadas y descarta citas inexistentes', async () => {
  const student = await User.findByPk(ctx.student.user.id);
  let received;
  // Sustituye la llamada externa para revisar qué material se envía y cómo se validan las citas.
  const complete = async (payload) => {
    received = payload;
    return { text: JSON.stringify({ answer: 'Respuesta de prueba', citedSourceIds: ['S1', 'S99'], grounded: true }), model: 'modelo-de-prueba' };
  };
  const reply = await askTutor(student, ctx.threadId, '¿Qué es una fracción?', { complete });
  const sent = JSON.stringify(received.messages);
  assert.equal(sent.includes('Una fracción representa partes'), true);
  assert.equal(sent.includes('Contenido aún no publicado'), false);
  assert.equal(reply.citations.length, 1);
  assert.equal(reply.citations[0].lessonId, ctx.lessonId);
  assert.equal(reply.grounded, true);
  assert.equal(await AiMessage.count(), 2);
});

test('la auditoría es visible solo para administración', async () => {
  const logs = await ctx.adminA.get('/audit-logs');
  assert.equal(logs.status, 200);
  assert.equal(logs.body.data.some((row) => row.action === 'attempt.submitted'), true);
  assert.equal((await ctx.student.get('/audit-logs')).status, 403);
});

test('bloquea la cuenta tras varios intentos fallidos', async () => {
  for (let i = 0; i < 5; i += 1) {
    await request(app).post('/api/v1/auth/login').send({ email: 'estudiante2@prueba.test', password: 'equivocada123' });
  }
  const locked = await request(app).post('/api/v1/auth/login').send({ email: 'estudiante2@prueba.test', password: PASSWORD });
  assert.equal(locked.status, 429);
});

test('cerrar sesión invalida la cookie', async () => {
  assert.equal((await ctx.teacher.post('/auth/logout')).status, 200);
  assert.equal((await ctx.teacher.get('/auth/me')).status, 401);
});
