import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse, publishLesson,
} from './helpers.js';
import { createGoogleFake, makeDocx, makePdf } from './fakes/googleFake.js';
import { setGoogleTransportForTests } from '../src/services/googleCloud.js';
import { setAiProviderForTests } from '../src/services/aiProvider.js';
import { runMaintenance, runRemoteCleanup, waitForKnowledgeQueue } from '../src/services/knowledgeService.js';
import { AiUsageEvent, KnowledgeSource, Material, SourceVersion } from '../src/models/index.js';
import { uploadDir } from '../src/middlewares/upload.js';

// Entrega 2: RAG Engine de extremo a extremo con dobles de Google Cloud y del generador.
const ctx = {};
const fake = createGoogleFake();
const generator = { calls: [] };

const REGLAMENTO = (dias) => `Reglamento del curso.\n\nArtículo 4. El plazo para presentar la justificación de ausencias es de ${dias} días hábiles desde la fecha de la ausencia. Pasado ese plazo la falta queda registrada sin justificación.`;
const PREGUNTA = '¿Cuánto tiempo tengo para justificar una inasistencia?';

// Sube un archivo como lo hace la pantalla docente.
async function upload(session, courseId, { name, type, buffer, title, lessonId }) {
  const call = session.agent.post(`/api/v1/courses/${courseId}/materials/upload`).set('x-csrf-token', session.csrf);
  if (title) call.field('title', title);
  if (lessonId) call.field('lessonId', String(lessonId));
  const response = await call.attach('file', buffer, { filename: name, contentType: type });
  await waitForKnowledgeQueue();
  // En modo Vertex la respuesta llega «pendiente»; el estado final se consulta al terminar la importación.
  if (response.status === 201) {
    const list = await session.get(`/courses/${courseId}/materials`);
    response.body.data = list.body.data.find((item) => item.id === response.body.data.id);
  }
  return response;
}

async function ask(session, threadId, question) {
  return session.post(`/tutor/threads/${threadId}/messages`, { question });
}

before(async () => {
  for (const key of ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL']) delete process.env[key];
  Object.assign(process.env, {
    RAG_PROVIDER: 'vertex', GOOGLE_CLOUD_PROJECT: 'proyecto-de-prueba', GOOGLE_CLOUD_LOCATION: 'us-central1', RAG_GCS_BUCKET: 'bucket-de-prueba',
  });
  setGoogleTransportForTests(fake.transport);
  // El generador de prueba cita la primera fuente recibida y repite su texto.
  setAiProviderForTests({
    complete: async ({ messages }) => {
      generator.calls.push(messages);
      const last = messages.at(-1).content;
      const ids = [...last.matchAll(/<fuente id="(S\d+)"/g)].map((match) => match[1]);
      return { text: JSON.stringify({ answer: 'Respuesta basada en el reglamento.', citedSourceIds: ids.slice(0, 2), grounded: true }), model: 'modelo-de-prueba', provider: 'prueba', usage: { inputTokens: 100, outputTokens: 20 } };
    },
  });
  await prepareDatabase();
  await createPlatformAdmin('operador.rag@prueba.test');
  ctx.platform = await loginAs('operador.rag@prueba.test');
  ctx.a = await setupInstitution(ctx.platform, 'RagA');
  ctx.b = await setupInstitution(ctx.platform, 'RagB');
  ctx.c1 = await setupCourse(ctx.a, 'REG-A1');
  ctx.c2 = await setupCourse(ctx.a, 'REG-A2');
  ctx.c3 = await setupCourse(ctx.b, 'REG-B1');
});
after(async () => {
  setAiProviderForTests(null);
  await closeDatabase();
});

test('el estudiante no puede subir materiales', async () => {
  const response = await ctx.a.student.agent.post(`/api/v1/courses/${ctx.c1.courseId}/materials/upload`)
    .set('x-csrf-token', ctx.a.student.csrf).attach('file', Buffer.from('texto'), { filename: 'x.txt', contentType: 'text/plain' });
  assert.equal(response.status, 403);
});

test('sin fuentes autorizadas responde «material insuficiente» sin consultar Google Cloud ni al generador', async () => {
  const thread = await ctx.a.student.post(`/courses/${ctx.c1.courseId}/tutor/threads`, { title: 'Vacío' });
  const reply = await ask(ctx.a.student, thread.body.data.id, PREGUNTA);
  assert.equal(reply.status, 201);
  assert.equal(reply.body.data.status, 'notice');
  assert.equal(fake.state.retrieveCalls, 0);
  assert.equal(generator.calls.length, 0);
});

test('cada versión se escribe en Cloud Storage, se importa y se confirma por archivo antes de quedar lista', async () => {
  for (const [org, course, dias] of [[ctx.a, ctx.c1, 3], [ctx.a, ctx.c2, 5], [ctx.b, ctx.c3, 10]]) {
    const response = await upload(org.teacher, course.courseId, { name: 'reglamento.txt', type: 'text/plain', buffer: Buffer.from(REGLAMENTO(dias)), title: 'Reglamento' });
    assert.equal(response.status, 201, JSON.stringify(response.body));
  }
  const versions = await SourceVersion.findAll({ order: [['id', 'ASC']] });
  assert.equal(versions.length, 3);
  for (const version of versions) {
    assert.equal(version.state, 'ready');
    assert.match(version.gcsUri, /^gs:\/\/bucket-de-prueba\/mentor-ai\/i\d+\/c\d+\/s\d+\/v\d+\.txt$/);
    assert.ok(version.ragFileName);
  }
  // Un corpus por curso.
  assert.equal(fake.state.corpora.size, 3);
  const panel = await ctx.a.teacher.get(`/courses/${ctx.c1.courseId}/materials`);
  assert.equal(panel.body.data[0].knowledge.state, 'ready');
  const studentView = await ctx.a.student.get(`/courses/${ctx.c1.courseId}/materials`);
  assert.equal(studentView.body.data[0].knowledge, undefined);
});

test('cada estudiante obtiene el plazo de su curso y nunca el de otro curso o institución', async () => {
  for (const [org, course, dias, otros] of [[ctx.a, ctx.c1, 3, [5, 10]], [ctx.a, ctx.c2, 5, [3, 10]], [ctx.b, ctx.c3, 10, [3, 5]]]) {
    const before = generator.calls.length;
    const thread = await org.student.post(`/courses/${course.courseId}/tutor/threads`, {});
    const reply = await ask(org.student, thread.body.data.id, PREGUNTA);
    assert.equal(reply.body.data.status, 'answer', JSON.stringify(reply.body));
    assert.equal(reply.body.data.citations.length, 1);
    const sent = JSON.stringify(generator.calls.slice(before));
    assert.ok(sent.includes(`es de ${dias} días hábiles`));
    for (const otro of otros) assert.equal(sent.includes(`es de ${otro} días hábiles`), false);

    // La cita abre un recurso protegido de MENTOR con el pasaje, el título y la versión.
    const citation = await org.student.get(`/tutor/messages/${reply.body.data.messageId}/citations/1`);
    assert.equal(citation.status, 200);
    assert.match(citation.body.data.passage, new RegExp(`es de ${dias} días hábiles`));
    assert.equal(citation.body.data.title, 'Reglamento');
    assert.equal(JSON.stringify(citation.body).includes('gs://'), false);
    course.messageId = reply.body.data.messageId;
    course.threadId = thread.body.data.id;
  }
  // Otro estudiante u otra institución no pueden abrir la cita.
  assert.equal((await ctx.b.student.get(`/tutor/messages/${ctx.c1.messageId}/citations/1`)).status, 404);
});

test('el docente ve qué versión respaldó las respuestas', async () => {
  const panel = await ctx.a.teacher.get(`/courses/${ctx.c1.courseId}/knowledge`);
  assert.equal(panel.status, 200);
  assert.equal(panel.body.data.mode, 'vertex');
  const [source] = panel.body.data.sources;
  assert.equal(source.versions[0].usedInAnswers, 1);
  assert.equal(source.versions[0].active, true);
  assert.equal((await ctx.a.student.get(`/courses/${ctx.c1.courseId}/knowledge`)).status, 403);
});

test('una consulta sin respaldo no invoca al generador', async () => {
  const before = generator.calls.length;
  const reply = await ask(ctx.a.student, ctx.c1.threadId, '¿Cuál es la capital de Mongolia?');
  assert.equal(reply.body.data.status, 'notice');
  assert.equal(generator.calls.length, before);
  const usage = await AiUsageEvent.findOne({ order: [['id', 'DESC']] });
  assert.equal(usage.outcome, 'no_evidence');
});

test('una falla de Google Cloud se distingue de una búsqueda sin coincidencias', async () => {
  fake.state.failRetrieve = true;
  const before = generator.calls.length;
  const reply = await ask(ctx.a.student, ctx.c1.threadId, PREGUNTA);
  fake.state.failRetrieve = false;
  assert.equal(reply.status, 503);
  assert.equal(reply.body.error.code, 'RAG_UNAVAILABLE');
  assert.equal(generator.calls.length, before);
});

test('repetir la importación deja una sola versión activa; un cambio crea otra y retira la anterior', async () => {
  const lessonId = await publishLesson(ctx.a.teacher, ctx.c2.topicId, 'Fracciones', '# Fracciones\n\nEl denominador indica en cuántas partes iguales se divide el entero.');
  await waitForKnowledgeQueue();
  await ctx.a.teacher.post(`/courses/${ctx.c2.courseId}/knowledge/index-existing`);
  await ctx.a.teacher.post(`/courses/${ctx.c2.courseId}/knowledge/index-existing`);
  await waitForKnowledgeQueue();
  const source = await KnowledgeSource.findOne({ where: { lessonId } });
  assert.equal(await SourceVersion.count({ where: { sourceId: source.id } }), 1);

  await ctx.a.teacher.patch(`/lessons/${lessonId}`, { bodyMd: 'El numerador indica cuántas partes se toman del entero dividido.' });
  await waitForKnowledgeQueue();
  await runRemoteCleanup();
  const versions = await SourceVersion.findAll({ where: { sourceId: source.id }, order: [['versionNo', 'ASC']] });
  assert.deepEqual(versions.map((version) => version.state), ['superseded', 'ready']);
  assert.equal(versions[0].remoteCleanup, 'done');
  assert.equal(fake.state.objects.has(versions[0].gcsUri), false);
  await source.reload();
  assert.equal(source.activeVersionId, versions[1].id);
});

test('al retirar una fuente queda fuera de inmediato aunque la limpieza remota siga pendiente', async () => {
  const source = await KnowledgeSource.findOne({ where: { courseId: ctx.c1.courseId, origin: 'material' } });
  fake.state.failDeleteRagFile = true;
  const retired = await ctx.a.teacher.post(`/knowledge/sources/${source.id}/retire`);
  assert.equal(retired.status, 200);
  await waitForKnowledgeQueue();
  await source.reload();
  assert.equal(source.status, 'retired');
  assert.equal(source.cleanupStatus, 'error');

  const before = generator.calls.length;
  const reply = await ask(ctx.a.student, ctx.c1.threadId, PREGUNTA);
  assert.equal(reply.body.data.status, 'notice');
  assert.equal(generator.calls.length, before);

  // El historial marca la cita como no disponible y la cita ya no se abre.
  const history = await ctx.a.student.get(`/tutor/threads/${ctx.c1.threadId}/messages`);
  const answered = history.body.data.find((message) => message.id === ctx.c1.messageId);
  assert.equal(answered.citations[0].available, false);
  assert.equal((await ctx.a.student.get(`/tutor/messages/${ctx.c1.messageId}/citations/1`)).status, 410);

  // La limpieza se reintenta con seguridad hasta completarse.
  fake.state.failDeleteRagFile = false;
  await runRemoteCleanup();
  await source.reload();
  assert.equal(source.cleanupStatus, 'done');
});

test('PDF con texto queda listo con su página; PDF sin texto se identifica; DOCX se indexa', async () => {
  const pdf = await upload(ctx.a.teacher, ctx.c2.courseId, { name: 'guia.pdf', type: 'application/pdf', buffer: makePdf(['Portada del curso', 'El plazo de entrega del proyecto es de dos semanas']) });
  assert.equal(pdf.body.data.knowledge.state, 'ready', JSON.stringify(pdf.body));
  const version = await SourceVersion.findOne({ where: { id: (await KnowledgeSource.findOne({ where: { materialId: pdf.body.data.id } })).activeVersionId } });
  assert.equal(version.pagesJson.length, 2);

  const scanned = await upload(ctx.a.teacher, ctx.c2.courseId, { name: 'escaneado.pdf', type: 'application/pdf', buffer: makePdf(['']) });
  assert.equal(scanned.status, 201);
  assert.equal(scanned.body.data.knowledge.state, 'error');
  assert.equal(scanned.body.data.knowledge.errorCode, 'PDF_NO_TEXT');

  const docx = await upload(ctx.a.teacher, ctx.c2.courseId, { name: 'normas.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await makeDocx(['Normas del laboratorio.', 'Siempre usar bata y lentes de seguridad.']) });
  assert.equal(docx.body.data.knowledge.state, 'ready');
});

test('al eliminar una lección se reconcilian archivo local, objeto privado y archivo del corpus', async () => {
  const lessonId = await publishLesson(ctx.b.teacher, ctx.c3.topicId, 'Lección con anexo', 'Contenido de la lección con anexo sobre la membrana de la célula.');
  const material = await upload(ctx.b.teacher, ctx.c3.courseId, { name: 'anexo.txt', type: 'text/plain', buffer: Buffer.from('Anexo: la célula tiene membrana, citoplasma y núcleo.'), lessonId });
  await waitForKnowledgeQueue();
  const row = await Material.findByPk(material.body.data.id);
  const filePath = path.join(uploadDir(), row.storedName);
  assert.equal(existsSync(filePath), true);
  const versions = await SourceVersion.findAll({ include: [{ model: KnowledgeSource, as: 'source', where: { courseId: ctx.c3.courseId, status: 'active' } }] });
  const uris = versions.map((version) => version.gcsUri);
  assert.ok(uris.length >= 2);

  assert.equal((await ctx.b.teacher.delete(`/lessons/${lessonId}`)).status, 204);
  await waitForKnowledgeQueue();
  assert.equal(existsSync(filePath), false);
  for (const uri of uris.filter((uri) => uri.includes(`/s${versions.find((version) => version.gcsUri === uri).sourceId}/`))) {
    const version = versions.find((item) => item.gcsUri === uri);
    if (version.source.lessonId === lessonId || version.source.materialId === row.id) assert.equal(fake.state.objects.has(uri), false);
  }
  const remaining = await KnowledgeSource.count({ where: { courseId: ctx.c3.courseId, status: 'active', origin: 'material', materialId: row.id } });
  assert.equal(remaining, 0);
});

test('el revisor confirma varias importaciones del mismo curso leyendo el corpus una sola vez', async () => {
  fake.state.deferImports = true;
  try {
    for (const nombre of ['uno', 'dos', 'tres']) {
      await upload(ctx.a.teacher, ctx.c1.courseId, { name: `anexo-${nombre}.txt`, type: 'text/plain', buffer: Buffer.from(`Anexo ${nombre}: la justificación de ausencias se entrega en secretaría.`) });
    }
    const pendientes = await SourceVersion.findAll({ where: { courseId: ctx.c1.courseId, state: 'processing' } });
    assert.equal(pendientes.length, 3);
    fake.state.completeOperations();
    const lecturas = () => fake.state.calls.filter((call) => call.startsWith('GET') && call.endsWith('/ragFiles')).length;
    const antes = lecturas();
    await runMaintenance();
    // Una lectura del corpus para las tres versiones (antes era una por versión).
    assert.equal(lecturas() - antes, 1);
    for (const version of pendientes) {
      await version.reload();
      assert.equal(version.state, 'ready');
      assert.ok(version.ragFileName);
    }
  } finally {
    fake.state.deferImports = false;
  }
});
