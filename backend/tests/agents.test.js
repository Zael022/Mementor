import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AgentRun } from '../src/models/index.js';
import { setAiProviderForTests } from '../src/services/aiProvider.js';
import { detectPersonalData } from '../src/services/agents/agentRegistry.js';
import { parseJson } from '../src/services/agents/agentRunner.js';
import { z } from 'zod';
import {
  closeDatabase, createPlatformAdmin, loginAs, prepareDatabase, publishLesson, setupCourse, setupInstitution,
} from './helpers.js';

// Prueba los 8 agentes de IA con un proveedor simulado: permisos, contexto, privacidad, validación y bitácora.
const ctx = {};
const LECCION = 'Las fracciones representan partes de un entero. El numerador indica cuántas partes se toman y el denominador en cuántas partes iguales se divide el entero. El denominador nunca puede ser cero porque no se puede dividir un entero en cero partes. Dos fracciones son equivalentes cuando representan la misma cantidad, por ejemplo un medio y dos cuartos.';

// Proveedor falso: guarda lo que recibe y responde lo que indique cada prueba.
function fakeProvider(reply) {
  const calls = [];
  setAiProviderForTests({
    complete: async (payload) => {
      calls.push(payload);
      return { text: typeof reply === 'function' ? reply(payload) : reply, model: 'modelo-de-prueba', provider: 'prueba', usage: { inputTokens: 120, outputTokens: 80 } };
    },
  });
  return calls;
}

before(async () => {
  await prepareDatabase();
  await createPlatformAdmin('operador.agentes@prueba.test');
  ctx.platform = await loginAs('operador.agentes@prueba.test');
  ctx.org = await setupInstitution(ctx.platform, 'Agentes');
  ctx.course = await setupCourse(ctx.org, 'AGE-1');
  ctx.lessonId = await publishLesson(ctx.org.teacher, ctx.course.topicId, 'Fracciones', LECCION);
  ctx.otherOrg = await setupInstitution(ctx.platform, 'Ajena');
});

afterEach(() => setAiProviderForTests(null));
after(async () => { setAiProviderForTests(null); await closeDatabase(); });

test('el catálogo muestra 8 agentes y cada rol ve solo los suyos', async () => {
  const docente = (await ctx.org.teacher.get('/agents')).body.data.map((agent) => agent.key);
  const estudiante = (await ctx.org.student.get('/agents')).body.data.map((agent) => agent.key);
  const todos = new Set([...docente, ...estudiante]);
  assert.equal(todos.size, 8);
  assert.ok(estudiante.includes('study_coach') && !estudiante.includes('feedback_assistant'));
  assert.ok(docente.includes('question_generator') && !docente.includes('study_coach'));
  for (const agent of (await ctx.org.teacher.get('/agents')).body.data) {
    assert.ok(agent.purpose && agent.inputs.length && agent.provider && agent.privacy, `documentación incompleta de ${agent.key}`);
  }
});

test('sin clave de IA el agente responde con un error claro y no inventa nada', async () => {
  const guardada = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  const sinClave = await ctx.org.teacher.post('/agents/announcement_writer/run', { courseId: ctx.course.courseId, brief: 'Recordar el examen del viernes' });
  assert.equal(sinClave.status, 503);
  if (guardada !== undefined) process.env.AI_API_KEY = guardada;
  assert.equal(sinClave.body.error.code, 'AI_NOT_CONFIGURED');
});

test('el generador de preguntas usa solo material del curso, exige citas y no llama al modelo sin evidencia', async () => {
  const calls = fakeProvider(JSON.stringify({ questions: [
    { prompt: '¿Puede el denominador ser cero?', options: ['Sí', 'No'], correctIndex: 1, explanation: 'No se divide en cero partes.', citations: ['S1'] },
    { prompt: 'Pregunta sin cita', options: ['a', 'b'], correctIndex: 0, citations: [] },
    { prompt: 'Cita inventada', options: ['a', 'b'], correctIndex: 0, citations: ['S9'] },
  ] }));
  const ok = await ctx.org.teacher.post('/agents/question_generator/run', { courseId: ctx.course.courseId, topic: 'denominador cero', count: 3 });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.result.questions.length, 1);
  assert.equal(ok.body.data.sources[0].title, 'Fracciones');
  assert.match(calls[0].messages[0].content, /nunca puede ser cero/);

  const sinMaterial = await ctx.org.teacher.post('/agents/question_generator/run', { courseId: ctx.course.courseId, topic: 'tectónica volcánica' });
  assert.equal(sinMaterial.body.data.status, 'no_evidence');
  assert.equal(calls.length, 1);
  assert.equal((await ctx.org.student.post('/agents/question_generator/run', { courseId: ctx.course.courseId, topic: 'fracciones' })).status, 403);
  assert.equal((await ctx.otherOrg.teacher.post('/agents/question_generator/run', { courseId: ctx.course.courseId, topic: 'fracciones' })).status, 404);
});

test('la retroalimentación no envía el nombre del estudiante y limita la nota sugerida', async () => {
  const tarea = await ctx.org.teacher.post(`/courses/${ctx.course.courseId}/assignments`, { title: 'Explica fracciones', instructions: 'Explica con un ejemplo.', maxPoints: 10 });
  await ctx.org.teacher.patch(`/assignments/${tarea.body.data.id}`, { status: 'published' });
  const entrega = await ctx.org.student.post(`/assignments/${tarea.body.data.id}/submission`, { body: 'Un medio es la mitad de una pizza.' });
  const calls = fakeProvider(JSON.stringify({ strengths: ['Ejemplo claro'], improvements: ['Mencionar el denominador'], feedback: 'Buen ejemplo, agrega el papel del denominador.', suggestedPoints: 50 }));
  const res = await ctx.org.teacher.post('/agents/feedback_assistant/run', { submissionId: entrega.body.data.id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.result.suggestedPoints, 10);
  const enviado = JSON.stringify(calls[0]);
  assert.equal(enviado.includes(ctx.org.student.user.displayName), false);
  assert.equal(enviado.includes('@prueba.test'), false);
});

test('el analista solo recibe datos agregados con etiquetas, no nombres', async () => {
  const calls = fakeProvider(JSON.stringify({ summary: 'El curso avanza bien.', highlights: ['Participación'], risks: [], recommendations: ['Repasar fracciones'] }));
  const res = await ctx.org.teacher.post('/agents/course_analyst/run', { courseId: ctx.course.courseId });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const enviado = calls[0].messages[0].content;
  assert.match(enviado, /Estudiante 1/);
  assert.equal(enviado.includes(ctx.org.student.user.displayName), false);
});

test('cumplimiento detecta datos personales en el servidor y la auditoría puede usarlo', async () => {
  const hallazgos = detectPersonalData('Contacto: 1-1234-5678, ana@correo.com, tel 8888-1234');
  assert.deepEqual(hallazgos.map((item) => item.type).sort(), ['correo', 'cédula', 'teléfono']);
  assert.equal(JSON.stringify(hallazgos).includes('ana@correo.com'), false);
  const auditor = await ctx.org.invite(ctx.org.admin, '/users', { email: 'auditor.agentes@prueba.test', displayName: 'Auditor', role: 'auditor' });
  fakeProvider(JSON.stringify({ riskLevel: 'alto', issues: [{ type: 'cédula', detail: 'Incluye una cédula', fix: 'Quitarla' }], summary: 'Hay datos personales.' }));
  const res = await auditor.post('/agents/compliance_checker/run', { text: 'Lista del grupo: Ana, cédula 1-1234-5678, correo ana@correo.com' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.result.riskLevel, 'alto');
  assert.ok(res.body.data.result.automaticFindings.length >= 2);
  assert.equal((await auditor.get('/governance/agent-runs')).status, 200);
});

test('redactor, coach y resumen responden con su formato; una respuesta mal formada queda como falla', async () => {
  fakeProvider(JSON.stringify({ title: 'Examen el viernes', body: 'Recuerden repasar fracciones.', hashtags: ['#mates'] }));
  const anuncio = await ctx.org.teacher.post('/agents/announcement_writer/run', { courseId: ctx.course.courseId, brief: 'Recordar el examen del viernes', format: 'redes' });
  assert.equal(anuncio.body.data.result.title, 'Examen el viernes');

  const calls = fakeProvider(JSON.stringify({ plan: [{ minutes: 15, activity: 'Repasar fracciones', why: 'Menor dominio' }], motivation: '¡Vas bien!' }));
  const coach = await ctx.org.student.post('/agents/study_coach/run', { courseId: ctx.course.courseId, minutes: 30 });
  assert.equal(coach.status, 200, JSON.stringify(coach.body));
  assert.equal(JSON.stringify(calls[0]).includes(ctx.org.student.user.displayName), false);

  fakeProvider(JSON.stringify({ summary: 'Las fracciones son partes de un entero.', keyPoints: ['Numerador', 'Denominador'], selfCheck: [{ question: '¿Puede el denominador ser cero?', answer: 'No' }] }));
  const resumen = await ctx.org.student.post('/agents/lesson_summarizer/run', { lessonId: ctx.lessonId });
  assert.equal(resumen.body.data.result.keyPoints.length, 2);

  fakeProvider('esto no es JSON');
  const mala = await ctx.org.student.post('/agents/lesson_summarizer/run', { lessonId: ctx.lessonId });
  assert.equal(mala.status, 502);
  assert.equal(await AgentRun.count({ where: { agent: 'lesson_summarizer', status: 'failed', errorCode: 'AGENT_INVALID_OUTPUT' } }), 1);
  assert.equal((await ctx.org.student.post('/agents/lesson_summarizer/run', { lessonId: 'abc' })).status, 422);
});

test('cada ejecución queda en la bitácora con tokens y sin contenido, y el tutor también aparece', async () => {
  const mias = await ctx.org.teacher.get('/agents/runs');
  assert.ok(mias.body.data.length >= 4);
  assert.ok(mias.body.data.every((fila) => !('result' in fila) && !('input' in fila)));
  const completada = await AgentRun.findOne({ where: { agent: 'question_generator', status: 'completed' } });
  assert.deepEqual([completada.inputTokens, completada.outputTokens, completada.model], [120, 80, 'modelo-de-prueba']);
  assert.equal((await ctx.org.student.get('/governance/agent-runs')).status, 403);
  const institucion = await ctx.org.admin.get('/governance/agent-runs');
  assert.ok(institucion.body.data.some((fila) => fila.agent === 'study_coach'));
});

test('parseJson tolera texto alrededor pero valida el esquema', () => {
  const schema = z.object({ a: z.number() });
  assert.deepEqual(parseJson('Aquí va: {"a": 1} listo', schema), { a: 1 });
  assert.equal(parseJson('{"a": "x"}', schema), null);
  assert.equal(parseJson('sin llaves', schema), null);
});
