import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse } from './helpers.js';
import { uploadDir } from '../src/middlewares/upload.js';
import { setGoogleTransportForTests } from '../src/services/googleCloud.js';
import { reconcileUploads } from '../src/services/fileCleanup.js';
import { AuditLog, Material } from '../src/models/index.js';

// Originales duraderos (M01) y compensación de cargas (M03) con un Cloud Storage en memoria.
const ctx = {};
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');

// Doble binario de la API JSON de Cloud Storage: guarda bytes exactos y fecha de creación.
function storageFake() {
  const objects = new Map();
  const state = { objects, failReads: 0 };
  const fail = (status) => Object.assign(new Error(`fake ${status}`), { name: 'GoogleCallError', status });
  state.transport = async ({ method, url, body }) => {
    const { pathname, searchParams } = new URL(url);
    if (method === 'POST' && pathname.startsWith('/upload/storage/v1/b/')) {
      const name = searchParams.get('name');
      if (objects.has(name)) throw fail(412);
      objects.set(name, { bytes: Buffer.from(body), created: Date.now() });
      return {};
    }
    const single = pathname.match(/^\/storage\/v1\/b\/[^/]+\/o\/(.+)$/);
    if (single) {
      const name = decodeURIComponent(single[1]);
      if (method === 'DELETE') {
        if (!objects.delete(name)) throw fail(404);
        return null;
      }
      if (state.failReads > 0) { state.failReads -= 1; throw fail(503); }
      if (!objects.has(name)) throw fail(404);
      return Buffer.from(objects.get(name).bytes);
    }
    if (method === 'GET' && /^\/storage\/v1\/b\/[^/]+\/o$/.test(pathname)) {
      const prefix = searchParams.get('prefix') || '';
      return { items: [...objects].filter(([name]) => name.startsWith(prefix)).map(([name, item]) => ({ name, timeCreated: new Date(item.created).toISOString() })) };
    }
    throw new Error(`Llamada no prevista: ${method} ${url}`);
  };
  return state;
}

const fake = storageFake();
const managedFiles = () => (existsSync(uploadDir()) ? readdirSync(uploadDir()).filter((name) => /^[0-9a-f]{32}\./.test(name)) : []);
const upload = (buffer, filename, contentType) => ctx.org.teacher.agent.post(`/api/v1/courses/${ctx.courseId}/materials/upload`)
  .set('x-csrf-token', ctx.org.teacher.csrf).attach('file', buffer, { filename, contentType });

before(async () => {
  process.env.UPLOAD_DIR = 'storage/test-storage';
  process.env.STORAGE_DRIVER = 'gcs';
  process.env.STORAGE_GCS_BUCKET = 'bucket-de-prueba';
  setGoogleTransportForTests(fake.transport);
  await prepareDatabase();
  await createPlatformAdmin('operador.archivos@prueba.test');
  ctx.org = await setupInstitution(await loginAs('operador.archivos@prueba.test'), 'Archivos');
  ({ courseId: ctx.courseId } = await setupCourse(ctx.org, 'ARCH-1'));
});

after(async () => {
  setGoogleTransportForTests(null);
  delete process.env.STORAGE_DRIVER;
  delete process.env.STORAGE_GCS_BUCKET;
  rmSync(uploadDir(), { recursive: true, force: true });
  await closeDatabase();
});

test('M01: el original queda en Cloud Storage y sobrevive a la pérdida del disco con la misma huella', async () => {
  // Imagen con bytes binarios arbitrarios después de la firma PNG.
  const original = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(4096)]);
  const response = await upload(original, 'diagrama.png', 'image/png');
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(managedFiles().length, 0, 'el disco solo se usa como paso temporal');
  assert.equal(fake.objects.size, 1);
  const row = await Material.findByPk(response.body.data.id);
  assert.equal(row.contentSha256, sha(original));

  // Reinicio de la instancia: el disco local desaparece.
  rmSync(uploadDir(), { recursive: true, force: true });
  const download = await ctx.org.student.agent.get(`/api/v1/materials/${row.id}/download`).buffer(true).parse((res, done) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });
  assert.equal(download.status, 200);
  assert.equal(sha(download.body), sha(original));
  assert.equal(download.headers['x-content-sha256'], sha(original));

  assert.equal((await ctx.org.teacher.delete(`/materials/${row.id}`)).status, 204);
  assert.equal(fake.objects.size, 0);
});

test('M03: si la bitácora falla no queda fila ni original; si falla la indexación el material sigue descargable', async () => {
  const before = await Material.count();
  const create = AuditLog.create;
  AuditLog.create = async () => { throw new Error('bitácora caída'); };
  try {
    const failed = await upload(Buffer.from('Guía de fracciones para la prueba.'), 'guia.txt', 'text/plain');
    assert.equal(failed.status, 500);
  } finally {
    AuditLog.create = create;
  }
  assert.equal(await Material.count(), before, 'ninguna fila huérfana');
  assert.equal(fake.objects.size, 0, 'el original sin registro se descarta');
  assert.equal(managedFiles().length, 0);

  // La lectura para indexar falla una vez: el material ya está confirmado y conserva su original.
  fake.failReads = 1;
  const saved = await upload(Buffer.from('El denominador indica en cuántas partes se divide la unidad.'), 'fracciones.txt', 'text/plain');
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.data.knowledge.state, 'error');
  assert.equal(fake.objects.size, 1);
  const download = await ctx.org.student.get(`/materials/${saved.body.data.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(download.text, 'El denominador indica en cuántas partes se divide la unidad.');
});

test('la reconciliación borra solo originales huérfanos y antiguos del bucket', async () => {
  const kept = fake.objects.size;
  fake.objects.set('mentor-ai/originales/materials/0123456789abcdef0123456789abcdef.pdf', { bytes: Buffer.from('%PDF-huérfano'), created: Date.now() - 2 * 3600000 });
  fake.objects.set('mentor-ai/originales/materials/fedcba9876543210fedcba9876543210.pdf', { bytes: Buffer.from('%PDF-reciente'), created: Date.now() });
  const result = await reconcileUploads();
  assert.equal(result.removed, 1);
  assert.equal(fake.objects.size, kept + 1);
  fake.objects.delete('mentor-ai/originales/materials/fedcba9876543210fedcba9876543210.pdf');
});
