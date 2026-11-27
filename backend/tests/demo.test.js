import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabase, closeDatabase, request, app } from './helpers.js';
import { User } from '../src/models/index.js';
import { DEMO_ACCOUNTS, ensureDemoAccounts } from '../src/services/demoService.js';
import { ensureDemoCourse } from '../src/services/demoCourseService.js';
import { DEMO_CLASSMATES, DEMO_COURSE } from '../src/services/demoContent.js';
import { Course } from '../src/models/index.js';
import { hashPassword } from '../src/utils/security.js';

// Modo de prueba: cuentas por rol y acceso rápido, solo con DEMO_MODE encendido.
const API = '/api/v1';
const encender = () => { process.env.DEMO_MODE = 'on'; };
const apagar = () => { delete process.env.DEMO_MODE; };

before(prepareDatabase);
afterEach(apagar);
after(closeDatabase);

test('con DEMO_MODE apagado no hay acceso rápido ni cuentas de prueba', async () => {
  const info = await request(app).get(`${API}/auth/demo`);
  assert.equal(info.status, 200);
  assert.deepEqual(info.body.data, { enabled: false, accounts: [] });
  const entrar = await request(app).post(`${API}/auth/demo`).send({ role: 'student' });
  assert.equal(entrar.status, 404);
  await assert.rejects(ensureDemoAccounts(), /DEMO_MODE/);
});

test('con DEMO_MODE encendido se crea una cuenta por rol, sin duplicar al repetir', async () => {
  encender();
  const primera = await ensureDemoAccounts();
  await ensureDemoAccounts();
  assert.equal(primera.accounts.length, DEMO_ACCOUNTS.length);
  const usuarios = await User.findAll({ where: { isDemo: true } });
  // Una cuenta por rol más los compañeros simulados.
  assert.equal(usuarios.length, DEMO_ACCOUNTS.length + DEMO_CLASSMATES.length);
  for (const cuenta of DEMO_ACCOUNTS) {
    const usuario = usuarios.find((item) => item.email === cuenta.email);
    assert.equal(usuario.role, cuenta.role);
    assert.equal(usuario.status, 'active');
    assert.equal(usuario.institutionId === null, cuenta.role === 'platform_admin');
  }
  const info = await request(app).get(`${API}/auth/demo`);
  assert.equal(info.body.data.enabled, true);
  assert.deepEqual(info.body.data.accounts.map((item) => item.role), DEMO_ACCOUNTS.map((item) => item.role));
});

test('el acceso rápido entra con cada rol, sin documentos pendientes', async () => {
  encender();
  for (const cuenta of DEMO_ACCOUNTS) {
    const agente = request.agent(app);
    const entrar = await agente.post(`${API}/auth/demo`).send({ role: cuenta.role });
    assert.equal(entrar.status, 200, cuenta.role);
    assert.equal(entrar.body.data.user.role, cuenta.role);
    assert.deepEqual(entrar.body.data.pendingConsents, []);
    const yo = await agente.get(`${API}/auth/me`);
    assert.equal(yo.body.data.user.email, cuenta.email);
  }
  const malo = await request(app).post(`${API}/auth/demo`).send({ role: 'superusuario' });
  assert.equal(malo.status, 422);
});

test('con contraseña también entran, y al apagar el modo dejan de entrar y sus sesiones caen', async () => {
  encender();
  const agente = request.agent(app);
  const entrar = await agente.post(`${API}/auth/login`).send({ email: `docente@prueba.mentorai.test`, password: 'MentorPrueba2026' });
  assert.equal(entrar.status, 200);
  apagar();
  assert.equal((await agente.get(`${API}/auth/me`)).status, 401);
  const otraVez = await request(app).post(`${API}/auth/login`).send({ email: `docente@prueba.mentorai.test`, password: 'MentorPrueba2026' });
  assert.equal(otraVez.status, 401);
});

test('nunca toma una cuenta real que use el mismo correo', async () => {
  encender();
  const real = await User.findOne({ where: { email: `auditoria@prueba.mentorai.test` } });
  await real.update({ isDemo: false, passwordHash: await hashPassword('ClaveReal2026segura') });
  await assert.rejects(ensureDemoAccounts(), /cuenta real/);
  const sigue = await User.findByPk(real.id);
  assert.equal(sigue.isDemo, false);
  await sigue.update({ isDemo: true });
});

test('el curso de prueba trae actividad simulada calculada por los servicios reales', async () => {
  encender();
  await ensureDemoAccounts();
  const resultado = await ensureDemoCourse();
  assert.equal(resultado.created, true);
  const ana = request.agent(app);
  await ana.post(`${API}/auth/demo`).send({ role: 'student' });
  const inicio = await ana.get(`${API}/me/home`);
  const curso = inicio.body.data.courses.find((item) => item.id === resultado.courseId);
  // 4 de 8 lecciones y 1 de 3 tareas: 5 de 11 = 45 % → Luz.
  assert.equal(curso.rank.percent, 45);
  assert.equal(curso.rank.name, 'Luz');
  const detalle = await ana.get(`${API}/courses/${resultado.courseId}`);
  const numeros = detalle.body.data.modules.find((modulo) => modulo.title === 'Números');
  assert.equal(numeros.practicePairs, 6);
  const practica = await ana.get(`${API}/courses/${resultado.courseId}/daily-practice`);
  // Cuatro días seguidos hasta ayer: hoy le toca mantener la racha.
  assert.equal(practica.body.data.streak.current, 4);
  assert.equal(practica.body.data.streak.atRisk, true);
  const tareas = await ana.get(`${API}/courses/${resultado.courseId}/assignments`);
  const ejercicios = tareas.body.data.find((item) => item.title === 'Ejercicios de fracciones');
  assert.equal(ejercicios.submitted, true);
  assert.equal(ejercicios.gradePoints, 88);
  // El docente ve a los tres estudiantes con su rango en la analítica.
  const docente = request.agent(app);
  await docente.post(`${API}/auth/demo`).send({ role: 'teacher' });
  const analitica = await docente.get(`${API}/teacher/courses/${resultado.courseId}/analytics`);
  assert.equal(analitica.body.data.students.length, 3);
});

test('el curso de prueba no se duplica y con reiniciar se archiva el anterior', async () => {
  encender();
  const antes = await Course.findOne({ where: { code: DEMO_COURSE.code } });
  assert.equal((await ensureDemoCourse()).created, false);
  const nuevo = await ensureDemoCourse({ reiniciar: true });
  assert.equal(nuevo.created, true);
  assert.notEqual(nuevo.courseId, antes.id);
  const viejo = await Course.findByPk(antes.id);
  assert.equal(viejo.status, 'archived');
  assert.notEqual(viejo.code, DEMO_COURSE.code);
});
