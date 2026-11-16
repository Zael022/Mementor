import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse } from './helpers.js';
import { createGoogleFake, makePdf } from './fakes/googleFake.js';
import { setGoogleTransportForTests } from '../src/services/googleCloud.js';
import { setAiProviderForTests } from '../src/services/aiProvider.js';
import { waitForKnowledgeQueue } from '../src/services/knowledgeService.js';
import { syncLink } from '../src/services/driveSyncService.js';
import { CourseDriveLink, KnowledgeSource, SourceVersion } from '../src/models/index.js';

// Entrega 3: sincronización de Drive con dobles de Google; los originales nunca se modifican.
const ctx = {};
const fake = createGoogleFake();
const FOLDER = 'carpetaDePrueba_0123456789';
const DOC = 'application/vnd.google-apps.document';

function addFile(id, name, mimeType, content, modifiedTime = '2026-11-01T10:00:00Z') {
  fake.state.drive.files.set(id, { id, name, mimeType, content, modifiedTime, parent: FOLDER, size: String(Buffer.byteLength(content)) });
}

async function sync() {
  const link = await CourseDriveLink.findOne({ where: { courseId: ctx.course.courseId, status: 'active' } });
  const stats = await syncLink(link.id);
  await waitForKnowledgeQueue();
  return stats;
}

const activeDriveSources = () => KnowledgeSource.findAll({ where: { courseId: ctx.course.courseId, origin: 'drive', status: 'active' }, order: [['id', 'ASC']] });

before(async () => {
  Object.assign(process.env, { RAG_PROVIDER: 'vertex', GOOGLE_CLOUD_PROJECT: 'proyecto-de-prueba', GOOGLE_CLOUD_LOCATION: 'us-central1', RAG_GCS_BUCKET: 'bucket-de-prueba' });
  setGoogleTransportForTests(fake.transport);
  setAiProviderForTests({
    complete: async ({ messages }) => {
      const ids = [...messages.at(-1).content.matchAll(/<fuente id="(S\d+)"/g)].map((match) => match[1]);
      return { text: JSON.stringify({ answer: 'Según el documento.', citedSourceIds: ids.slice(0, 3), grounded: true }), model: 'modelo-de-prueba', provider: 'prueba' };
    },
  });
  fake.state.drive.folders.set(FOLDER, { name: 'Reglamentos' });
  addFile('doc1', 'Reglamento de asistencia', DOC, 'El plazo para justificar una ausencia es de 3 días hábiles.');
  addFile('txt1', 'Calendario.txt', 'text/plain', 'El plazo de matrícula vence el viernes de la primera semana.');
  addFile('pdf1', 'Normas.pdf', 'application/pdf', makePdf(['Normas generales del laboratorio de ciencias']).toString('latin1'));
  addFile('img1', 'logo.png', 'image/png', 'binario');
  await prepareDatabase();
  await createPlatformAdmin('operador.drive@prueba.test');
  ctx.org = await setupInstitution(await loginAs('operador.drive@prueba.test'), 'Drive');
  ctx.course = await setupCourse(ctx.org, 'DRV-1');
});
after(async () => {
  setAiProviderForTests(null);
  await closeDatabase();
});

test('solo la administración habilita carpetas y se comprueba el acceso', async () => {
  assert.equal((await ctx.org.teacher.post('/institution/drive-folders', { folderId: FOLDER, label: 'Reglamentos' })).status, 403);
  const denied = await ctx.org.admin.post('/institution/drive-folders', { folderId: 'carpetaSinPermiso_999', label: 'Otra' });
  assert.equal(denied.status, 422);
  const invalidId = await ctx.org.admin.post('/institution/drive-folders', { folderId: "x' or '1'='1", label: 'Inyección' });
  assert.equal(invalidId.status, 422);
  const enabled = await ctx.org.admin.post('/institution/drive-folders', { folderId: FOLDER, label: 'Reglamentos' });
  assert.equal(enabled.status, 201);
  ctx.folderId = enabled.body.data.id;
  const linked = await ctx.org.teacher.put(`/courses/${ctx.course.courseId}/drive`, { driveFolderId: ctx.folderId });
  assert.equal(linked.status, 201);
});

test('recorre todas las páginas, exporta Google Docs y descarga archivos compatibles', async () => {
  const stats = await sync();
  assert.equal(stats.completed, true);
  assert.ok(stats.pages >= 2);
  const sources = await activeDriveSources();
  assert.deepEqual(sources.map((source) => source.title).sort(), ['Calendario.txt', 'Normas.pdf', 'Reglamento de asistencia']);
  for (const source of sources) {
    const version = await SourceVersion.findByPk(source.activeVersionId);
    assert.equal(version.state, 'ready');
    assert.ok(fake.state.objects.has(version.gcsUri));
  }
  // MENTOR solo lee Drive.
  assert.equal(fake.state.calls.filter((call) => call.includes('/drive/') && !call.startsWith('GET')).length, 0);
});

test('dos sincronizaciones sin cambios dejan una sola versión activa por archivo', async () => {
  await sync();
  await sync();
  for (const source of await activeDriveSources()) {
    assert.equal(await SourceVersion.count({ where: { sourceId: source.id } }), 1);
  }
});

test('al modificar un documento, la cita lleva a la versión nueva cuando termina la indexación', async () => {
  addFile('doc1', 'Reglamento de asistencia', DOC, 'Desde noviembre, el plazo para justificar una ausencia es de 5 días hábiles.', '2026-11-10T10:00:00Z');
  await sync();
  const source = await KnowledgeSource.findOne({ where: { driveFileId: 'doc1' } });
  const versions = await SourceVersion.findAll({ where: { sourceId: source.id }, order: [['versionNo', 'ASC']] });
  assert.deepEqual(versions.map((version) => version.state), ['superseded', 'ready']);

  const thread = await ctx.org.student.post(`/courses/${ctx.course.courseId}/tutor/threads`, {});
  const reply = await ctx.org.student.post(`/tutor/threads/${thread.body.data.id}/messages`, { question: '¿Cuántos días tengo para justificar una falta?' });
  assert.equal(reply.body.data.status, 'answer', JSON.stringify(reply.body));
  const cited = reply.body.data.citations.find((item) => item.title === 'Reglamento de asistencia');
  assert.equal(cited.versionNo, 2);
  const citation = await ctx.org.student.get(`/tutor/messages/${reply.body.data.messageId}/citations/${cited.position}`);
  assert.match(citation.body.data.passage, /5 días hábiles/);
});

test('una sincronización incompleta se reanuda sin declarar borrados los archivos sin listar', async () => {
  // Se quita un archivo y la lista falla en la segunda página.
  fake.state.drive.files.get('txt1').trashed = true;
  fake.state.drive.failListOnPage = 1;
  const partial = await sync();
  assert.equal(partial.completed, false);
  assert.equal((await activeDriveSources()).length, 3);
  const link = await CourseDriveLink.findOne({ where: { courseId: ctx.course.courseId, status: 'active' } });
  assert.equal(link.syncState, 'interrupted');
  assert.ok(link.syncRunId);

  const resumed = await sync();
  assert.equal(resumed.completed, true);
  const titles = (await activeDriveSources()).map((source) => source.title);
  assert.equal(titles.includes('Calendario.txt'), false);
  const retired = await KnowledgeSource.findOne({ where: { driveFileId: 'txt1' } });
  assert.equal(retired.retireReason, 'drive_removed');
});

test('al perder el acceso a la carpeta se desactivan sus fuentes y se conservan los originales', async () => {
  fake.state.drive.deniedFolders.add(FOLDER);
  const stats = await sync();
  assert.equal(stats.accessLost, true);
  assert.equal((await activeDriveSources()).length, 0);
  assert.ok(fake.state.drive.files.has('doc1'));
  const status = await ctx.org.teacher.get(`/courses/${ctx.course.courseId}/drive`);
  assert.equal(status.body.data.link.syncState, 'error');
});
