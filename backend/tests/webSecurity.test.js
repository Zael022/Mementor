import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse, PASSWORD } from './helpers.js';

// Asignación de seguridad: inyección SQL, XSS, CSRF y CORS contra la API real (base de prueba efímera).
const ctx = {};
const PERMITIDO = 'http://127.0.0.1:5173';
const AJENO = 'https://sitio-malicioso.test';

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.web@prueba.test');
  const plataforma = await loginAs('operador.web@prueba.test');
  ctx.a = await setupInstitution(plataforma, 'Colegio Norte');
  ctx.b = await setupInstitution(plataforma, 'Colegio Sur');
  ctx.curso = await setupCourse(ctx.a, 'WEB-1');
});

after(closeDatabase);

// ---------- Inyección SQL ----------
test('SQL: el inicio de sesión no se salta con una inyección clásica', async () => {
  for (const email of ["' OR '1'='1' -- ", "admin@prueba.test' OR 1=1 #", "x' UNION SELECT 1,2,3 -- "]) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'cualquiera' });
    // La validación rechaza el formato antes de llegar a la base de datos.
    assert.equal(res.status, 422, email);
    assert.equal(res.headers['set-cookie'], undefined);
  }
  // Con un correo válido, la inyección en la contraseña no sirve: se compara con bcrypt, no en SQL.
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin.colegionorte@prueba.test', password: "' OR '1'='1" });
  assert.equal(res.status, 401);
});

test('SQL: la búsqueda de personas trata la inyección como texto y no cruza instituciones', async () => {
  const buscar = (q) => ctx.a.admin.get(`/users?q=${encodeURIComponent(q)}`);
  const normal = await buscar('Estudiante');
  assert.equal(normal.status, 200);
  assert.deepEqual(normal.body.data.map((row) => row.email), ['estudiante.colegionorte@prueba.test']);

  for (const ataque of ["' OR 1=1 -- ", "' OR '1'='1", "x' UNION SELECT email, password_hash FROM users -- ", '%', '_']) {
    const res = await buscar(ataque);
    assert.equal(res.status, 200, ataque);
    assert.equal(res.body.data.length, 0, `«${ataque}» no debe devolver filas`);
    assert.equal(JSON.stringify(res.body).includes('$2'), false, 'nunca aparece un hash de contraseña');
  }
  // Nadie de la otra institución aparece aunque se busque por su nombre.
  assert.equal((await buscar('Colegio Sur')).body.data.length, 0);
});

// ---------- XSS ----------
test('XSS: el contenido con etiquetas se guarda y devuelve como texto en JSON, nunca como HTML', async () => {
  const carga = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const creado = await ctx.a.teacher.post(`/courses/${ctx.curso.courseId}/announcements`, { title: 'Aviso <b>importante</b>', body: carga });
  assert.equal(creado.status, 201, JSON.stringify(creado.body));
  const lista = await ctx.a.student.get(`/courses/${ctx.curso.courseId}/announcements`);
  assert.match(lista.headers['content-type'], /application\/json/);
  assert.equal(lista.headers['x-content-type-options'], 'nosniff');
  assert.ok(lista.headers['content-security-policy'], 'la API envía una CSP');
  // El texto llega igual a como se escribió; React lo muestra como texto (ver Markdown.test.jsx).
  assert.equal(lista.body.data[0].body, carga);
});

// ---------- CSRF ----------
test('CSRF: una petición que cambia datos sin el token de la sesión se rechaza', async () => {
  const sinToken = await ctx.a.teacher.agent.post(`/api/v1/courses/${ctx.curso.courseId}/announcements`).send({ title: 'Falso', body: 'Desde otro sitio' });
  assert.equal(sinToken.status, 403);
  const tokenFalso = await ctx.a.teacher.agent.post(`/api/v1/courses/${ctx.curso.courseId}/announcements`).set('x-csrf-token', 'a'.repeat(64)).send({ title: 'Falso', body: 'Token inventado' });
  assert.equal(tokenFalso.status, 403);
  // El mismo envío con el token correcto sí funciona.
  assert.equal((await ctx.a.teacher.post(`/courses/${ctx.curso.courseId}/announcements`, { title: 'Real', body: 'Con token' })).status, 201);
});

test('CSRF: la cookie de sesión es HttpOnly y SameSite=Lax', async () => {
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'docente.colegionorte@prueba.test', password: PASSWORD });
  const cookie = res.headers['set-cookie'].find((value) => value.startsWith('mentor_session='));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

// ---------- CORS ----------
test('CORS: el origen autorizado recibe permiso con métodos y encabezados limitados', async () => {
  const res = await request(app).options('/api/v1/auth/me').set('Origin', PERMITIDO).set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,x-csrf-token');
  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], PERMITIDO);
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
  assert.equal(res.headers['access-control-allow-methods'], 'GET,POST,PUT,PATCH,DELETE');
  assert.equal(res.headers['access-control-allow-headers'], 'Content-Type,Accept,X-CSRF-Token');
});

test('CORS: un origen no autorizado se rechaza con 403 y sin encabezados de permiso', async () => {
  const preflight = await request(app).options('/api/v1/courses').set('Origin', AJENO).set('Access-Control-Request-Method', 'DELETE');
  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers['access-control-allow-origin'], undefined);
  const lectura = await ctx.a.student.agent.get('/api/v1/courses').set('Origin', AJENO);
  assert.equal(lectura.status, 403);
  assert.equal(lectura.body.error.code, 'ORIGIN_NOT_ALLOWED');
  const escritura = await ctx.a.teacher.agent.post(`/api/v1/courses/${ctx.curso.courseId}/announcements`)
    .set('Origin', AJENO).set('x-csrf-token', ctx.a.teacher.csrf).send({ title: 'Ajeno', body: 'Otro origen' });
  assert.equal(escritura.status, 403);
  // Sin el comodín «*»: el origen nunca se refleja si no está en la lista.
  assert.notEqual(lectura.headers['access-control-allow-origin'], '*');
});
