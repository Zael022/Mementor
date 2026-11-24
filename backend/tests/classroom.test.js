import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, rmSync } from 'node:fs';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, activate } from './helpers.js';
import { uploadDir } from '../src/middlewares/upload.js';
import { toEmbedUrl } from '../src/utils/links.js';

// Prueba las funciones del aula con datos temporales.
const ctx = {};

async function inviteAndActivate(session, path, body) {
  const invited = await session.post(path, body);
  assert.equal(invited.status, 201, JSON.stringify(invited.body));
  assert.equal((await activate(invited.body.data.invitationToken)).status, 200);
  return loginAs(body.email);
}

before(async () => {
  process.env.UPLOAD_DIR = 'storage/test-uploads';
  await prepareDatabase();
  await createPlatformAdmin('operador.aula@prueba.test');
  const platform = await loginAs('operador.aula@prueba.test');
  const a = await platform.post('/institutions', { name: 'Aula A de prueba' });
  const b = await platform.post('/institutions', { name: 'Aula B de prueba' });
  const adminA = await inviteAndActivate(platform, `/institutions/${a.body.data.id}/admins`, { email: 'admin.aula.a@prueba.test', displayName: 'Admin A' });
  const adminB = await inviteAndActivate(platform, `/institutions/${b.body.data.id}/admins`, { email: 'admin.aula.b@prueba.test', displayName: 'Admin B' });
  ctx.teacher = await inviteAndActivate(adminA, '/users', { email: 'docente.aula@prueba.test', displayName: 'Docente Aula', role: 'teacher' });
  ctx.student = await inviteAndActivate(adminA, '/users', { email: 'alumno.aula@prueba.test', displayName: 'Alumno Aula', role: 'student' });
  ctx.outsider = await inviteAndActivate(adminA, '/users', { email: 'ajeno.aula@prueba.test', displayName: 'Alumno Ajeno', role: 'student' });
  ctx.teacherB = await inviteAndActivate(adminB, '/users', { email: 'docente.aula.b@prueba.test', displayName: 'Docente B', role: 'teacher' });

  const course = await ctx.teacher.post('/courses', { code: 'AULA-1', title: 'Curso temporal del aula' });
  ctx.courseId = course.body.data.id;
  const module = await ctx.teacher.post(`/courses/${ctx.courseId}/modules`, { title: 'Módulo' });
  const topic = await ctx.teacher.post(`/modules/${module.body.data.id}/topics`, { title: 'Tema' });
  ctx.topicId = topic.body.data.id;
  const first = await ctx.teacher.post(`/topics/${ctx.topicId}/lessons`, { title: 'Primera', bodyMd: 'Texto uno' });
  const second = await ctx.teacher.post(`/topics/${ctx.topicId}/lessons`, { title: 'Segunda', bodyMd: 'Texto dos' });
  const draft = await ctx.teacher.post(`/topics/${ctx.topicId}/lessons`, { title: 'Borrador', bodyMd: 'Texto oculto' });
  ctx.lessonId = first.body.data.id;
  ctx.secondLessonId = second.body.data.id;
  ctx.draftLessonId = draft.body.data.id;
  await ctx.teacher.patch(`/lessons/${ctx.lessonId}`, { status: 'published' });
  await ctx.teacher.patch(`/lessons/${ctx.secondLessonId}`, { status: 'published' });
  await ctx.teacher.patch(`/courses/${ctx.courseId}`, { status: 'published' });
  await ctx.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.student.user.id });
});

after(async () => {
  rmSync(uploadDir(), { recursive: true, force: true });
  await closeDatabase();
});

test('convierte enlaces de video solo de sitios permitidos', () => {
  assert.equal(toEmbedUrl('https://www.youtube.com/watch?v=abcdefghijk'), 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(toEmbedUrl('https://youtu.be/abcdefghijk'), 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(toEmbedUrl('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
  assert.equal(toEmbedUrl('http://www.youtube.com/watch?v=abcdefghijk'), null);
  assert.equal(toEmbedUrl('https://ejemplo.test/video'), null);
  assert.equal(toEmbedUrl('javascript:alert(1)'), null);
});

test('la lección acepta video válido y ofrece anterior y siguiente', async () => {
  assert.equal((await ctx.teacher.patch(`/lessons/${ctx.lessonId}`, { videoUrl: 'https://ejemplo.test/video' })).status, 422);
  const saved = await ctx.teacher.patch(`/lessons/${ctx.lessonId}`, { videoUrl: 'https://youtu.be/abcdefghijk' });
  assert.equal(saved.body.data.videoEmbedUrl, 'https://www.youtube-nocookie.com/embed/abcdefghijk');

  const lesson = await ctx.student.get(`/lessons/${ctx.lessonId}`);
  assert.equal(lesson.body.data.previous, null);
  assert.equal(lesson.body.data.next.id, ctx.secondLessonId);
  const last = await ctx.student.get(`/lessons/${ctx.secondLessonId}`);
  assert.equal(last.body.data.next, null);
  assert.equal((await ctx.teacher.get(`/lessons/${ctx.secondLessonId}`)).body.data.next.id, ctx.draftLessonId);
});

test('clases en vivo: el enlace se entrega al entrar y queda la asistencia', async () => {
  const soon = new Date(Date.now() + 5 * 60000).toISOString();
  const later = new Date(Date.now() + 3 * 24 * 3600000).toISOString();
  const insegura = await ctx.teacher.post(`/courses/${ctx.courseId}/sessions`, { title: 'Clase', startsAt: soon, meetingUrl: 'http://reunion.test/sala' });
  assert.equal(insegura.status, 422);
  assert.equal((await ctx.student.post(`/courses/${ctx.courseId}/sessions`, { title: 'Clase', startsAt: soon, meetingUrl: 'https://reunion.test/sala' })).status, 403);

  const open = await ctx.teacher.post(`/courses/${ctx.courseId}/sessions`, { title: 'Clase de hoy', startsAt: soon, durationMinutes: 45, meetingUrl: 'https://reunion.test/sala-1' });
  const future = await ctx.teacher.post(`/courses/${ctx.courseId}/sessions`, { title: 'Clase futura', startsAt: later, meetingUrl: 'https://reunion.test/sala-2' });
  assert.equal(open.status, 201, JSON.stringify(open.body));
  ctx.sessionId = open.body.data.id;

  const list = await ctx.student.get(`/courses/${ctx.courseId}/sessions`);
  assert.equal(list.body.data.length, 2);
  assert.equal(JSON.stringify(list.body).includes('reunion.test'), false);
  assert.equal(list.body.data[0].canJoin, true);
  assert.equal(list.body.data[1].canJoin, false);

  const tooEarly = await ctx.student.post(`/sessions/${future.body.data.id}/join`);
  assert.equal(tooEarly.body.error.code, 'SESSION_NOT_OPEN');
  const joined = await ctx.student.post(`/sessions/${ctx.sessionId}/join`);
  assert.equal(joined.body.data.meetingUrl, 'https://reunion.test/sala-1');
  await ctx.student.post(`/sessions/${ctx.sessionId}/join`);

  assert.equal((await ctx.outsider.post(`/sessions/${ctx.sessionId}/join`)).status, 403);
  assert.equal((await ctx.teacherB.post(`/sessions/${ctx.sessionId}/join`)).status, 404);

  const attendance = await ctx.teacher.get(`/sessions/${ctx.sessionId}/attendance`);
  assert.equal(attendance.body.data.students.length, 1);
  assert.notEqual(attendance.body.data.students[0].joinedAt, null);
  assert.equal(attendance.body.data.session.attendanceCount, 1);
  assert.equal((await ctx.student.get(`/sessions/${ctx.sessionId}/attendance`)).status, 403);

  const cancelled = await ctx.teacher.patch(`/sessions/${future.body.data.id}`, { status: 'cancelled' });
  assert.equal(cancelled.body.data.state, 'cancelled');
});

test('anuncios: publica el docente y los lee el estudiante matriculado', async () => {
  assert.equal((await ctx.student.post(`/courses/${ctx.courseId}/announcements`, { title: 'No', body: 'No' })).status, 403);
  const created = await ctx.teacher.post(`/courses/${ctx.courseId}/announcements`, { title: 'Aviso', body: 'Mañana hay clase.' });
  assert.equal(created.status, 201);
  assert.equal((await ctx.student.get(`/courses/${ctx.courseId}/announcements`)).body.data[0].title, 'Aviso');
  assert.equal((await ctx.outsider.get(`/courses/${ctx.courseId}/announcements`)).status, 403);
});

test('materiales: enlaces y archivos con descarga protegida', async () => {
  const link = await ctx.teacher.post(`/courses/${ctx.courseId}/materials`, { title: 'Lectura', url: 'https://ejemplo.test/lectura', lessonId: ctx.lessonId });
  assert.equal(link.status, 201);

  const upload = await ctx.teacher.agent.post(`/api/v1/courses/${ctx.courseId}/materials/upload`).set('x-csrf-token', ctx.teacher.csrf)
    .field('title', 'Guía').field('lessonId', String(ctx.lessonId)).attach('file', Buffer.from('contenido de la guía'), { filename: 'guia.txt', contentType: 'text/plain' });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));
  assert.equal(upload.body.data.storedName, undefined);

  const prohibido = await ctx.teacher.agent.post(`/api/v1/courses/${ctx.courseId}/materials/upload`).set('x-csrf-token', ctx.teacher.csrf)
    .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'pagina.html', contentType: 'text/html' });
  assert.equal(prohibido.status, 422);
  const deEstudiante = await ctx.student.agent.post(`/api/v1/courses/${ctx.courseId}/materials/upload`).set('x-csrf-token', ctx.student.csrf)
    .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
  assert.equal(deEstudiante.status, 403);
  assert.equal(readdirSync(uploadDir()).length, 1);

  const oculto = await ctx.teacher.post(`/courses/${ctx.courseId}/materials`, { title: 'Oculto', url: 'https://ejemplo.test/oculto', lessonId: ctx.draftLessonId });
  const visible = await ctx.student.get(`/courses/${ctx.courseId}/materials`);
  assert.deepEqual(visible.body.data.map((row) => row.title), ['Lectura', 'Guía']);
  assert.equal(oculto.status, 201);

  const download = await ctx.student.get(`/materials/${upload.body.data.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(download.text, 'contenido de la guía');
  assert.match(download.headers['content-disposition'], /^attachment; filename="?guia\.txt"?/);
  assert.equal((await ctx.outsider.get(`/materials/${upload.body.data.id}/download`)).status, 403);
  assert.equal((await ctx.teacherB.get(`/materials/${upload.body.data.id}/download`)).status, 404);

  assert.equal((await ctx.teacher.delete(`/materials/${upload.body.data.id}`)).status, 204);
  assert.equal(readdirSync(uploadDir()).length, 0);
});

test('un archivo renombrado no se acepta aunque la extensión y el tipo parezcan válidos', async () => {
  const subir = (buffer, filename, contentType) => ctx.teacher.agent.post(`/api/v1/courses/${ctx.courseId}/materials/upload`)
    .set('x-csrf-token', ctx.teacher.csrf).attach('file', buffer, { filename, contentType });
  const antes = readdirSync(uploadDir()).length;
  const casos = [
    [Buffer.from('<html><script>alert(1)</script></html>'), 'falso.pdf', 'application/pdf'],
    [Buffer.from('texto plano'), 'falso.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    [Buffer.from('GIF89a'), 'falso.png', 'image/png'],
    [Buffer.from([0x4d, 0x5a, 0x00, 0x00, 0x90, 0x00]), 'programa.txt', 'text/plain'],
  ];
  for (const [buffer, filename, contentType] of casos) {
    const respuesta = await subir(buffer, filename, contentType);
    assert.equal(respuesta.status, 422, filename);
    assert.match(respuesta.body.error.message, /no corresponde a su formato/);
  }
  // Ningún archivo rechazado queda en disco.
  assert.equal(readdirSync(uploadDir()).length, antes);
  // Los formatos reales sí se aceptan.
  const png = await subir(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), 'imagen.png', 'image/png');
  assert.equal(png.status, 201);
  assert.equal((await ctx.teacher.delete(`/materials/${png.body.data.id}`)).status, 204);
});

test('preguntas y respuestas en la lección', async () => {
  const question = await ctx.student.post(`/lessons/${ctx.lessonId}/comments`, { body: '¿Pueden explicar el paso 2?' });
  assert.equal(question.status, 201);
  const reply = await ctx.teacher.post(`/lessons/${ctx.lessonId}/comments`, { body: 'Claro, revisa el ejemplo.', parentId: question.body.data.id });
  assert.equal(reply.body.data.parentId, question.body.data.id);
  assert.equal(reply.body.data.author.isStaff, true);

  assert.equal((await ctx.student.post(`/lessons/${ctx.draftLessonId}/comments`, { body: 'Hola' })).status, 404);
  assert.equal((await ctx.outsider.get(`/lessons/${ctx.lessonId}/comments`)).status, 403);
  assert.equal((await ctx.student.delete(`/comments/${reply.body.data.id}`)).status, 403);

  const list = await ctx.student.get(`/lessons/${ctx.lessonId}/comments`);
  assert.equal(list.body.data.length, 2);
  assert.equal((await ctx.student.delete(`/comments/${question.body.data.id}`)).status, 204);
  assert.equal((await ctx.student.get(`/lessons/${ctx.lessonId}/comments`)).body.data.length, 0);
});

test('tareas: entrega del estudiante y calificación del docente', async () => {
  const due = new Date(Date.now() + 2 * 24 * 3600000).toISOString();
  const created = await ctx.teacher.post(`/courses/${ctx.courseId}/assignments`, { title: 'Tarea 1', instructions: 'Resuelve los ejercicios.', dueAt: due, maxPoints: 20 });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  ctx.assignmentId = created.body.data.id;

  assert.equal((await ctx.student.get(`/assignments/${ctx.assignmentId}`)).status, 404);
  assert.equal((await ctx.teacher.patch(`/assignments/${ctx.assignmentId}`, { status: 'published' })).status, 200);
  assert.equal((await ctx.outsider.get(`/assignments/${ctx.assignmentId}`)).status, 403);

  const first = await ctx.student.post(`/assignments/${ctx.assignmentId}/submission`, { body: 'Primera versión' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.late, false);
  const second = await ctx.student.post(`/assignments/${ctx.assignmentId}/submission`, { body: 'Versión final', linkUrl: 'https://ejemplo.test/mi-trabajo' });
  assert.equal(second.body.data.id, first.body.data.id);

  const detail = await ctx.teacher.get(`/assignments/${ctx.assignmentId}`);
  assert.equal(detail.body.data.students[0].submission.body, 'Versión final');
  const submissionId = detail.body.data.students[0].submission.id;

  assert.equal((await ctx.student.patch(`/submissions/${submissionId}/grade`, { gradePoints: 20 })).status, 403);
  assert.equal((await ctx.teacher.patch(`/submissions/${submissionId}/grade`, { gradePoints: 25 })).status, 422);
  const graded = await ctx.teacher.patch(`/submissions/${submissionId}/grade`, { gradePoints: 18, feedback: 'Buen trabajo.' });
  assert.equal(graded.body.data.gradePoints, 18);

  const mine = await ctx.student.get(`/assignments/${ctx.assignmentId}`);
  assert.equal(mine.body.data.submission.feedback, 'Buen trabajo.');
  const locked = await ctx.student.post(`/assignments/${ctx.assignmentId}/submission`, { body: 'Otro intento' });
  assert.equal(locked.body.error.code, 'ALREADY_GRADED');

  const list = await ctx.student.get(`/courses/${ctx.courseId}/assignments`);
  assert.deepEqual([list.body.data[0].submitted, list.body.data[0].gradePoints], [true, 18]);

  // M04: con una nota emitida (18/20) el máximo ya no cambia; la nota del curso queda intacta.
  const antes = await ctx.student.get(`/courses/${ctx.courseId}/my-grade`);
  assert.equal(antes.status, 200);
  const cambio = await ctx.teacher.patch(`/assignments/${ctx.assignmentId}`, { maxPoints: 10 });
  assert.equal(cambio.status, 409);
  assert.equal(cambio.body.error.code, 'GRADED_MAX_LOCKED');
  assert.equal((await ctx.teacher.get(`/assignments/${ctx.assignmentId}`)).body.data.maxPoints, 20);
  assert.deepEqual((await ctx.student.get(`/courses/${ctx.courseId}/my-grade`)).body, antes.body);
  // Otros cambios de la tarea siguen permitidos.
  assert.equal((await ctx.teacher.patch(`/assignments/${ctx.assignmentId}`, { title: 'Tarea 1 (revisada)' })).status, 200);
});

test('el inicio del estudiante resume clases, tareas, anuncios y avance', async () => {
  await ctx.teacher.post(`/courses/${ctx.courseId}/assignments`, { title: 'Tarea 2', instructions: 'Pendiente.' });
  const draftList = await ctx.teacher.get(`/courses/${ctx.courseId}/assignments`);
  const pending = draftList.body.data.find((row) => row.title === 'Tarea 2');
  await ctx.teacher.patch(`/assignments/${pending.id}`, { status: 'published' });
  await ctx.student.post(`/lessons/${ctx.lessonId}/complete`);

  const home = await ctx.student.get('/me/home');
  assert.equal(home.status, 200, JSON.stringify(home.body));
  assert.deepEqual(home.body.data.assignments.map((row) => row.title), ['Tarea 2']);
  assert.deepEqual(home.body.data.sessions.map((row) => row.title), ['Clase de hoy']);
  assert.equal(home.body.data.sessions[0].attended, true);
  assert.equal(home.body.data.announcements[0].title, 'Aviso');
  assert.deepEqual([home.body.data.courses[0].completedLessons, home.body.data.courses[0].totalLessons], [1, 2]);
  assert.equal(JSON.stringify(home.body).includes('reunion.test'), false);

  const empty = await ctx.outsider.get('/me/home');
  assert.deepEqual(empty.body.data.courses, []);
  assert.equal((await ctx.teacher.get('/me/home')).status, 403);
});

test('el inicio cuenta solo progreso publicado y no duplica clases con varios asistentes', async () => {
  await ctx.teacher.post(`/courses/${ctx.courseId}/enrollments`, { studentId: ctx.outsider.user.id });
  await ctx.outsider.post(`/sessions/${ctx.sessionId}/join`);
  await ctx.student.post(`/lessons/${ctx.lessonId}/complete`);
  await ctx.outsider.post(`/lessons/${ctx.secondLessonId}/complete`);
  const first = await ctx.student.get('/me/home');
  assert.equal(first.body.data.sessions.length, 1);
  assert.equal(first.body.data.sessions[0].attended, true);
  assert.equal(first.body.data.courses[0].totalLessons, 2);
  assert.equal(first.body.data.courses[0].completedLessons, 1);
  await ctx.teacher.patch(`/lessons/${ctx.secondLessonId}`, { status: 'draft' });
  const other = await ctx.outsider.get('/me/home');
  assert.equal(other.body.data.courses[0].totalLessons, 1);
  assert.equal(other.body.data.courses[0].completedLessons, 0);
  assert.equal(other.body.data.sessions.length, 1);
});

test('las lecciones grandes se comprimen al negociar gzip y conservan su contenido', async () => {
  const bodyMd = 'Esta lección explica los requisitos para presentar la documentación del curso.\n\n'.repeat(100).trim();
  await ctx.teacher.patch(`/lessons/${ctx.lessonId}`, { bodyMd });
  const lesson = await ctx.student.agent.get(`/api/v1/lessons/${ctx.lessonId}`).set('Accept-Encoding', 'gzip');
  assert.equal(lesson.status, 200);
  assert.equal(lesson.headers['content-encoding'], 'gzip');
  assert.equal(lesson.body.data.bodyMd, bodyMd);
});
