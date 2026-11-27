import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import app from '../src/app.js';
import { sequelize, User } from '../src/models/index.js';
import { hashPassword } from '../src/utils/security.js';

const require = createRequire(import.meta.url);
export const PASSWORD = 'ClaveTemporal2026';

// Aplica las migraciones en la base de pruebas aislada.
export async function prepareDatabase() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Las pruebas solo corren con NODE_ENV=test.');
  const umzug = new Umzug({
    migrations: {
      glob: ['../database/migrations/*.js', { cwd: fileURLToPath(new URL('.', import.meta.url)) }],
      resolve: ({ name, path }) => {
        const migration = require(path);
        return {
          name,
          up: () => migration.up(sequelize.getQueryInterface(), Sequelize),
          down: () => migration.down(sequelize.getQueryInterface(), Sequelize),
        };
      },
    },
    storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' }),
    logger: undefined,
  });
  await umzug.up();
  await cleanDatabase();
}

// Borra los registros temporales creados por las pruebas.
export async function cleanDatabase() {
  if (process.env.NODE_ENV !== 'test' || !/_(test|e2e)$/.test(process.env.TEST_DB_NAME || '') || process.env.TEST_DB_NAME === process.env.DB_NAME) throw new Error('La limpieza requiere una base aislada terminada en _test o _e2e.');
  const tables = await sequelize.getQueryInterface().showAllTables();
  // En Windows MySQL guarda los nombres en minúsculas: se compara sin distinguir mayúsculas.
  // El catálogo de roles es dato de referencia creado por la migración: no se borra.
  const borrables = tables.map((table) => (typeof table === 'string' ? table : table.tableName))
    .filter((table) => !['sequelizemeta', 'roles'].includes(table.toLowerCase()));
  if (sequelize.getDialect() === 'postgres') {
    // PostgreSQL vacía todo de una vez y reinicia los contadores de id.
    if (borrables.length) await sequelize.query(`TRUNCATE TABLE ${borrables.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`);
    return;
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of borrables) await sequelize.query(`TRUNCATE TABLE \`${table}\``);
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function closeDatabase() {
  await cleanDatabase();
  await sequelize.close();
}

// Crea un administrador de plataforma efímero, como lo haría el comando de instalación.
export async function createPlatformAdmin(email) {
  return User.create({
    email, displayName: 'Operador de prueba', role: 'platform_admin', status: 'active', passwordHash: await hashPassword(PASSWORD),
  });
}

// Inicia sesión y devuelve un cliente que envía cookie y token CSRF.
// Como haría la persona en el diálogo, acepta los documentos pendientes salvo que se pida lo contrario.
export async function loginAs(email, password = PASSWORD, { acceptPending = true } = {}) {
  const agent = request.agent(app);
  const response = await agent.post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`Login falló para ${email}: ${response.status}`);
  const csrf = response.body.data.csrfToken;
  const pending = response.body.data.pendingConsents || [];
  if (acceptPending && pending.length) {
    await agent.post('/api/v1/me/consents').set('x-csrf-token', csrf).send({ documents: pending.map((item) => item.document) });
  }
  const send = (method, path, body) => {
    const call = agent[method](`/api/v1${path}`).set('x-csrf-token', csrf);
    return body === undefined ? call : call.send(body);
  };
  return {
    agent,
    csrf,
    user: response.body.data.user,
    get: (path) => agent.get(`/api/v1${path}`),
    post: (path, body = {}) => send('post', path, body),
    patch: (path, body = {}) => send('patch', path, body),
    put: (path, body = {}) => send('put', path, body),
    delete: (path) => send('delete', path),
  };
}

// Activa una cuenta invitada usando su enlace de un solo uso.
export async function activate(invitationToken) {
  return request(app).post('/api/v1/auth/activate').send({ token: invitationToken, password: PASSWORD, acceptTerms: true, acceptPrivacy: true });
}

export { app, request };

// Crea una institución con administración, docente, estudiante y un curso publicado, todo efímero.
export async function setupInstitution(platform, label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const institution = await platform.post('/institutions', { name: `Institución ${label}` });
  if (institution.status !== 201) throw new Error(`No se creó la institución: ${JSON.stringify(institution.body)}`);
  const invite = async (session, path, body) => {
    const invited = await session.post(path, body);
    if (invited.status !== 201) throw new Error(`Invitación falló: ${JSON.stringify(invited.body)}`);
    await activate(invited.body.data.invitationToken);
    return loginAs(body.email);
  };
  const admin = await invite(platform, `/institutions/${institution.body.data.id}/admins`, { email: `admin.${slug}@prueba.test`, displayName: `Admin ${label}` });
  const teacher = await invite(admin, '/users', { email: `docente.${slug}@prueba.test`, displayName: `Docente ${label}`, role: 'teacher' });
  const student = await invite(admin, '/users', { email: `estudiante.${slug}@prueba.test`, displayName: `Estudiante ${label}`, role: 'student' });
  return { institutionId: institution.body.data.id, admin, teacher, student, invite };
}

// Crea un curso publicado con un tema y matricula al estudiante.
export async function setupCourse(org, code) {
  const course = await org.teacher.post('/courses', { code, title: `Curso ${code}` });
  const courseId = course.body.data.id;
  const module = await org.teacher.post(`/courses/${courseId}/modules`, { title: 'Módulo 1' });
  const topic = await org.teacher.post(`/modules/${module.body.data.id}/topics`, { title: 'Tema 1' });
  await org.teacher.patch(`/courses/${courseId}`, { status: 'published' });
  await org.teacher.post(`/courses/${courseId}/enrollments`, { studentId: org.student.user.id });
  return { courseId, topicId: topic.body.data.id };
}

// Publica una lección en un tema y devuelve su id.
export async function publishLesson(teacher, topicId, title, bodyMd) {
  const lesson = await teacher.post(`/topics/${topicId}/lessons`, { title, bodyMd });
  if (lesson.status !== 201) throw new Error(`No se creó la lección: ${JSON.stringify(lesson.body)}`);
  await teacher.patch(`/lessons/${lesson.body.data.id}`, { status: 'published' });
  return lesson.body.data.id;
}
