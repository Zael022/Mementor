import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { prepareDatabase, closeDatabase, createPlatformAdmin, loginAs, setupInstitution, setupCourse, publishLesson } from './helpers.js';
import { AiMessage, AiUsageEvent, SourceVersion, User } from '../src/models/index.js';
import { askTutor } from '../src/services/tutorService.js';
import { sequelize } from '../src/config/database.js';
import { holdLease, releaseLease } from '../src/services/coordination.js';
import { MysqlRateLimitStore, purgeExpiredRateLimits } from '../src/services/rateLimitStore.js';
import { limiter } from '../src/middlewares/common.js';
import { purgeOldAgentRuns, purgeOldConversations, purgeUncitedVersionText, rollupUsage } from '../src/services/retentionService.js';

// Coordinación entre instancias y retención, sobre la base de pruebas.
before(prepareDatabase);
after(closeDatabase);

test('solo una instancia tiene el turno de tareas; otra lo toma al liberarse o vencer', async () => {
  assert.equal(await holdLease('prueba', 60000, 'instancia-a'), true);
  assert.equal(await holdLease('prueba', 60000, 'instancia-b'), false);
  assert.equal(await holdLease('prueba', 60000, 'instancia-a'), true);
  await releaseLease('prueba', 'instancia-a');
  assert.equal(await holdLease('prueba', 60000, 'instancia-b'), true);
  // Un turno vencido lo puede tomar otra instancia.
  await sequelize.query("UPDATE job_leases SET expires_at = NOW(3) - INTERVAL 1 SECOND WHERE name = 'prueba'");
  assert.equal(await holdLease('prueba', 60000, 'instancia-a'), true);
});

test('dos instancias con RATE_LIMIT_STORE=mysql comparten el mismo conteo', async () => {
  process.env.RATE_LIMIT_STORE = 'mysql';
  process.env.RATE_LIMIT_TEST_MAX = '3';
  // Dos aplicaciones independientes simulan dos instancias del backend detrás del mismo balanceador.
  const instancia = () => {
    const app = express();
    app.get('/limitada', limiter({ name: 'prueba-compartida', windowMinutes: 1, max: 3 }), (req, res) => res.json({ ok: true }));
    return app;
  };
  const a = instancia();
  const b = instancia();
  delete process.env.RATE_LIMIT_STORE;
  delete process.env.RATE_LIMIT_TEST_MAX;
  const estados = [];
  for (const app of [a, b, a, b, a]) estados.push((await request(app).get('/limitada')).status);
  assert.deepEqual(estados, [200, 200, 200, 429, 429]);
  const store = new MysqlRateLimitStore('prueba-compartida');
  await store.resetKey('::ffff:127.0.0.1');
  await sequelize.query("UPDATE rate_limit_hits SET reset_at = NOW(3) - INTERVAL 2 HOUR");
  assert.ok(await purgeExpiredRateLimits() >= 0);
});

test('la retención resume el consumo antiguo y borra chats y textos vencidos sin tocar lo citado', async () => {
  await createPlatformAdmin('operador.retencion@prueba.test');
  const org = await setupInstitution(await loginAs('operador.retencion@prueba.test'), 'Retencion');
  const course = await setupCourse(org, 'RET-1');
  const lessonId = await publishLesson(org.teacher, course.topicId, 'Fracciones', 'Una fracción representa partes iguales de un entero.');
  const student = await User.findByPk(org.student.user.id);
  const thread = (await org.student.post(`/courses/${course.courseId}/tutor/threads`, {})).body.data.id;
  const complete = async () => ({ text: JSON.stringify({ answer: 'Respuesta.', citedSourceIds: ['S1'], grounded: true }), model: 'modelo-de-prueba', provider: 'prueba', usage: { inputTokens: 100, outputTokens: 10 } });
  await askTutor(student, thread, '¿Qué representa una fracción?', { complete });

  // v1 queda citada; v2 se reemplaza sin que nadie la cite; v3 es la vigente.
  await org.teacher.patch(`/lessons/${lessonId}`, { bodyMd: 'Una fracción representa partes iguales de un entero dividido.' });
  await org.teacher.patch(`/lessons/${lessonId}`, { bodyMd: 'Una fracción indica partes iguales de un entero dividido en partes.' });
  const versions = await SourceVersion.findAll({ where: { courseId: course.courseId }, order: [['versionNo', 'ASC']] });
  assert.deepEqual(versions.map((version) => version.state), ['superseded', 'superseded', 'ready']);
  await sequelize.query('UPDATE source_versions SET updated_at = NOW() - INTERVAL 60 DAY WHERE course_id = :courseId', { replacements: { courseId: course.courseId } });

  assert.equal(await purgeUncitedVersionText(), 1);
  await Promise.all(versions.map((version) => version.reload()));
  assert.ok(versions[0].textContent.length > 0, 'la versión citada conserva su texto');
  assert.equal(versions[1].textContent, '');
  assert.ok(versions[1].textPurgedAt);
  assert.ok(versions[2].textContent.length > 0, 'la versión vigente no se toca');

  // Consumo con más de 90 días: pasa al resumen mensual y se borra el detalle.
  await sequelize.query('UPDATE ai_usage_events SET created_at = NOW() - INTERVAL 100 DAY WHERE institution_id = :id', { replacements: { id: org.institutionId } });
  assert.equal(await rollupUsage(), 1);
  const [resumen] = await sequelize.query('SELECT events, input_tokens AS inputTokens FROM ai_usage_monthly WHERE institution_id = :id', { replacements: { id: org.institutionId }, type: 'SELECT' });
  assert.equal(Number(resumen.events), 1);
  assert.equal(Number(resumen.inputTokens), 100);
  assert.equal(await AiUsageEvent.count({ where: { institutionId: org.institutionId } }), 0);

  // Conversación sin actividad por más de 365 días: se borra con sus mensajes y citas.
  await sequelize.query('UPDATE ai_threads SET created_at = NOW() - INTERVAL 400 DAY WHERE id = :thread', { replacements: { thread } });
  await sequelize.query('UPDATE ai_messages SET created_at = NOW() - INTERVAL 400 DAY WHERE thread_id = :thread', { replacements: { thread } });
  assert.equal(await purgeOldConversations(), 1);
  assert.equal(await AiMessage.count({ where: { threadId: thread } }), 0);
  // Sin la cita, la primera versión ya puede liberar su texto.
  assert.equal(await purgeUncitedVersionText(), 1);

  // M10: el registro detallado de los asistentes también vence a los 90 días.
  const contar = async () => Number((await sequelize.query('SELECT COUNT(*) AS n FROM agent_runs WHERE course_id = :course', { replacements: { course: course.courseId }, type: 'SELECT' }))[0].n);
  const antes = await contar();
  await sequelize.query("INSERT INTO agent_runs (institution_id, user_id, course_id, agent, input_chars, status, created_at, updated_at) VALUES (:inst, :user, :course, 'study_coach', 10, 'completed', NOW() - INTERVAL 100 DAY, NOW() - INTERVAL 100 DAY), (:inst, :user, :course, 'study_coach', 10, 'completed', NOW(), NOW())", {
    replacements: { inst: org.institutionId, user: student.id, course: course.courseId },
  });
  assert.equal(await contar(), antes + 2);
  assert.equal(await purgeOldAgentRuns(), 1);
  assert.equal(await contar(), antes + 1);
});

