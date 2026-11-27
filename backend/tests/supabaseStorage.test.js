import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse } from './helpers.js';
import { uploadDir } from '../src/middlewares/upload.js';
import { setSupabaseTransportForTests, readSupabaseConfig } from '../src/services/supabaseStorage.js';
import { readStorageConfig } from '../src/services/fileStore.js';
import { reconcileUploads } from '../src/services/fileCleanup.js';
import { Material } from '../src/models/index.js';

// Originales en Supabase Storage (despliegue en la nube) con un bucket en memoria que imita la API REST.
const ctx = {};
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');
const CLAVE = 'sb_secret_clave-de-prueba';

function supabaseFake() {
  const objects = new Map();
  const state = { objects, calls: [] };
  const reply = (status, data) => ({ status, buffer: Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data ?? {})) });
  state.transport = async ({ method, url, headers, body }) => {
    state.calls.push({ method, url, headers });
    if (headers.apikey !== CLAVE) return reply(401, { statusCode: '401', error: 'Unauthorized' });
    const { pathname } = new URL(url);
    const ruta = decodeURIComponent(pathname.replace(/^\/storage\/v1\//, ''));
    let match = ruta.match(/^object\/list\/([^/]+)$/);
    if (method === 'POST' && match) {
      const { prefix } = JSON.parse(body);
      const list = [...objects].filter(([name]) => name.startsWith(`${prefix}/`) && !name.slice(prefix.length + 1).includes('/'))
        .map(([name, item]) => ({ id: name, name: name.slice(prefix.length + 1), created_at: new Date(item.created).toISOString() }));
      return reply(200, list);
    }
    match = ruta.match(/^object\/authenticated\/([^/]+)\/(.+)$/);
    if (method === 'GET' && match) {
      return objects.has(match[2]) ? reply(200, Buffer.from(objects.get(match[2]).bytes)) : reply(400, { statusCode: '404', error: 'not_found' });
    }
    match = ruta.match(/^object\/([^/]+)\/(.+)$/);
    if (method === 'POST' && match) {
      if (objects.has(match[2]) && headers['x-upsert'] === 'false') return reply(400, { statusCode: '409', error: 'Duplicate' });
      objects.set(match[2], { bytes: Buffer.from(body), created: Date.now() });
      return reply(200, { Key: `${match[1]}/${match[2]}` });
    }
    match = ruta.match(/^object\/([^/]+)$/);
    if (method === 'DELETE' && match) {
      const { prefixes } = JSON.parse(body);
      return reply(200, prefixes.filter((name) => objects.delete(name)).map((name) => ({ name })));
    }
    throw new Error(`Llamada no prevista: ${method} ${url}`);
  };
  return state;
}

const fake = supabaseFake();
const managedFiles = () => (existsSync(uploadDir()) ? readdirSync(uploadDir()).filter((name) => /^[0-9a-f]{32}\./.test(name)) : []);
const upload = (buffer, filename, contentType) => ctx.org.teacher.agent.post(`/api/v1/courses/${ctx.courseId}/materials/upload`)
  .set('x-csrf-token', ctx.org.teacher.csrf).attach('file', buffer, { filename, contentType });

before(async () => {
  process.env.UPLOAD_DIR = 'storage/test-supabase';
  process.env.STORAGE_DRIVER = 'supabase';
  process.env.SUPABASE_URL = 'https://proyecto-de-prueba.supabase.co';
  process.env.SUPABASE_SECRET_KEY = CLAVE;
  process.env.SUPABASE_BUCKET = 'mentor-originales';
  setSupabaseTransportForTests(fake.transport);
  await prepareDatabase();
  await createPlatformAdmin('operador.supabase@prueba.test');
  ctx.org = await setupInstitution(await loginAs('operador.supabase@prueba.test'), 'Supabase');
  ({ courseId: ctx.courseId } = await setupCourse(ctx.org, 'SUPA-1'));
});

after(async () => {
  setSupabaseTransportForTests(null);
  for (const name of ['STORAGE_DRIVER', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_BUCKET']) delete process.env[name];
  rmSync(uploadDir(), { recursive: true, force: true });
  await closeDatabase();
});

test('sin URL, clave o bucket el almacén de Supabase se informa como no configurado', () => {
  const guardado = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  try {
    const config = readStorageConfig();
    assert.equal(config.configured, false);
    assert.match(config.reason, /SUPABASE_SECRET_KEY/);
  } finally {
    process.env.SUPABASE_SECRET_KEY = guardado;
  }
  process.env.SUPABASE_URL = 'http://proyecto.supabase.co';
  try {
    assert.equal(readSupabaseConfig().configured, false, 'sin https la clave viajaría sin cifrar');
  } finally {
    process.env.SUPABASE_URL = 'https://proyecto-de-prueba.supabase.co';
  }
});

test('el original queda en Supabase Storage, sobrevive a la pérdida del disco y se borra con el material', async () => {
  const original = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(4096)]);
  const response = await upload(original, 'diagrama.png', 'image/png');
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(managedFiles().length, 0, 'el disco solo se usa como paso temporal');
  assert.equal(fake.objects.size, 1);
  const [nombre] = fake.objects.keys();
  assert.match(nombre, /^originales\/materials\/[0-9a-f]{32}\.png$/);
  // La clave nueva va solo en «apikey» y nunca en la URL.
  assert.ok(fake.calls.every((call) => !call.headers.Authorization && !call.url.includes(CLAVE)));

  rmSync(uploadDir(), { recursive: true, force: true });
  const row = await Material.findByPk(response.body.data.id);
  const download = await ctx.org.student.agent.get(`/api/v1/materials/${row.id}/download`).buffer(true).parse((res, done) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });
  assert.equal(download.status, 200);
  assert.equal(sha(download.body), sha(original));

  assert.equal((await ctx.org.teacher.delete(`/materials/${row.id}`)).status, 204);
  assert.equal(fake.objects.size, 0);
  assert.equal((await ctx.org.student.get(`/materials/${row.id}/download`)).status, 404);
});

test('la reconciliación borra solo originales huérfanos y antiguos del bucket de Supabase', async () => {
  const guardado = await upload(Buffer.from('El numerador cuenta las partes tomadas.'), 'numerador.txt', 'text/plain');
  assert.equal(guardado.status, 201);
  fake.objects.set('originales/materials/0123456789abcdef0123456789abcdef.pdf', { bytes: Buffer.from('%PDF-huérfano'), created: Date.now() - 2 * 3600000 });
  fake.objects.set('originales/materials/fedcba9876543210fedcba9876543210.pdf', { bytes: Buffer.from('%PDF-reciente'), created: Date.now() });
  const result = await reconcileUploads();
  assert.equal(result.removed, 1);
  assert.ok(!fake.objects.has('originales/materials/0123456789abcdef0123456789abcdef.pdf'));
  assert.ok(fake.objects.has('originales/materials/fedcba9876543210fedcba9876543210.pdf'), 'lo reciente puede ser una carga en curso');
  assert.equal(fake.objects.size, 2);
});
