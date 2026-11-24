import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { modelForTier, readAiConfig, toProviderMessages } from '../../src/services/aiProvider.js';
import { AGENTS } from '../../src/services/agents/agentRegistry.js';
import { tierFor } from '../../src/services/agents/agentRunner.js';

// Capas 6 y 7 sin base de datos: router de modelos por entorno y marcas de prompt caching.
const ENV = ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_MODEL_RAPIDO', 'AI_MODEL_AVANZADO', 'AI_TIER_ANNOUNCEMENT_WRITER', 'AI_PROMPT_CACHE', 'AI_PROMPT_CACHE_MIN_TOKENS'];
const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
afterEach(() => { for (const key of ENV) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
const setEnv = (values) => { for (const key of ENV) delete process.env[key]; Object.assign(process.env, values); };

test('cada nivel usa su variable y, si falta, AI_MODEL (los despliegues anteriores no se rompen)', () => {
  setEnv({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'clave-de-prueba', AI_MODEL: 'modelo-base' });
  assert.equal(modelForTier('rapido'), 'modelo-base');
  assert.equal(modelForTier('avanzado'), 'modelo-base');
  process.env.AI_MODEL_RAPIDO = 'modelo-rapido';
  assert.equal(readAiConfig({ tier: 'rapido' }).model, 'modelo-rapido');
  assert.equal(readAiConfig({ tier: 'avanzado' }).model, 'modelo-base');
  // Sin AI_MODEL pero con las dos variables específicas, también está configurado.
  setEnv({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'clave-de-prueba', AI_MODEL_RAPIDO: 'r', AI_MODEL_AVANZADO: 'a' });
  assert.deepEqual([readAiConfig({ tier: 'rapido' }).model, readAiConfig({ tier: 'avanzado' }).model], ['r', 'a']);
  // Sin ningún modelo para el nivel, el mensaje dice qué falta.
  setEnv({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'clave-de-prueba', AI_MODEL_RAPIDO: 'r' });
  const sinAvanzado = readAiConfig({ tier: 'avanzado' });
  assert.equal(sinAvanzado.configured, false);
  assert.match(sinAvanzado.reason, /AI_MODEL_AVANZADO o AI_MODEL/);
});

test('asignación de modelos: tareas simples (incluye borradores de admisiones) al rápido; tutor, retroalimentación, preguntas y cumplimiento al avanzado', () => {
  setEnv({});
  const niveles = Object.fromEntries(Object.values(AGENTS).filter((agent) => !agent.external).map((agent) => [agent.key, tierFor(agent)]));
  assert.deepEqual(niveles, {
    question_generator: 'avanzado', feedback_assistant: 'avanzado', course_analyst: 'rapido', compliance_checker: 'avanzado',
    announcement_writer: 'rapido', study_coach: 'rapido', lesson_summarizer: 'rapido', admissions_writer: 'rapido',
  });
  // Se puede reasignar un agente sin tocar código; un valor inválido se ignora.
  process.env.AI_TIER_ANNOUNCEMENT_WRITER = 'avanzado';
  assert.equal(tierFor(AGENTS.announcement_writer), 'avanzado');
  process.env.AI_TIER_ANNOUNCEMENT_WRITER = 'carísimo';
  assert.equal(tierFor(AGENTS.announcement_writer), 'rapido');
});

test('prompt caching: solo con AI_PROMPT_CACHE=on y para bloques largos; OpenAI recibe texto plano', () => {
  const largo = 'Contenido estable de la lección. '.repeat(200);
  const mensajes = [{ role: 'user', content: [{ text: largo, cache: true }, { text: 'Formato: {}' }] }];
  setEnv({});
  assert.equal(toProviderMessages('anthropic', mensajes)[0].content[0].cache_control, undefined);
  setEnv({ AI_PROMPT_CACHE: 'on', AI_PROMPT_CACHE_MIN_TOKENS: '1024' });
  const anthropic = toProviderMessages('anthropic', mensajes)[0].content;
  assert.deepEqual(anthropic[0].cache_control, { type: 'ephemeral' });
  assert.equal(anthropic[1].cache_control, undefined);
  // Un bloque corto no llega al mínimo del proveedor: no se marca.
  assert.equal(toProviderMessages('anthropic', [{ role: 'user', content: [{ text: 'corto', cache: true }] }])[0].content[0].cache_control, undefined);
  assert.equal(typeof toProviderMessages('openai', mensajes)[0].content, 'string');
  // Los mensajes de texto simple no cambian.
  assert.deepEqual(toProviderMessages('anthropic', [{ role: 'user', content: 'hola' }]), [{ role: 'user', content: 'hola' }]);
});
