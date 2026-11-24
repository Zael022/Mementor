import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AGENT_COMMON_PROMPT, AGENT_PROMPTS, ALL_PROMPTS, TUTOR_PROMPT, agentPromptVersion, fingerprint, tutorPromptVersion } from '../../src/prompts/index.js';
import { AGENTS } from '../../src/services/agents/agentRegistry.js';
import { COMMON_RULES } from '../../src/services/agents/agentRunner.js';

// Capa 1: un prompt solo cambia subiendo su versión y actualizando el lock con `npm run prompts:lock`.
const lock = JSON.parse(await readFile(new URL('../../src/prompts/prompts.lock.json', import.meta.url), 'utf8'));

test('cada prompt coincide con la huella registrada para su versión', () => {
  for (const prompt of ALL_PROMPTS) {
    const entry = lock[prompt.id];
    assert.ok(entry, `${prompt.id} no está en prompts.lock.json: ejecuta npm run prompts:lock`);
    assert.equal(entry.version, prompt.version, `${prompt.id}: la versión cambió; ejecuta npm run prompts:lock`);
    assert.equal(entry.sha256, fingerprint(prompt), `${prompt.id}: el texto cambió sin subir la versión (${prompt.version}). Sube la versión y ejecuta npm run prompts:lock.`);
  }
  assert.deepEqual(Object.keys(lock).sort(), ALL_PROMPTS.map((prompt) => prompt.id).sort());
});

test('cambiar una letra del texto cambia la huella (la prueba anterior lo detectaría)', () => {
  const copia = structuredClone(TUTOR_PROMPT);
  copia.text.json = copia.text.json.replace('ÚNICAMENTE', 'principalmente');
  assert.notEqual(fingerprint(copia), fingerprint(TUTOR_PROMPT));
  // El orden de las llaves no cambia la huella.
  const reordenado = { ...TUTOR_PROMPT, text: { hints: TUTOR_PROMPT.text.hints, stream: TUTOR_PROMPT.text.stream, json: TUTOR_PROMPT.text.json } };
  assert.equal(fingerprint(reordenado), fingerprint(TUTOR_PROMPT));
});

test('los agentes usan exactamente los textos versionados y conservan las reglas de seguridad', () => {
  assert.equal(COMMON_RULES, AGENT_COMMON_PROMPT.text.system);
  for (const [key, prompt] of Object.entries(AGENT_PROMPTS)) {
    assert.equal(AGENTS[key].system, prompt.text.system, key);
    assert.match(agentPromptVersion(key), new RegExp(`^${key}@\\d+\\.\\d+\\.\\d+\\+agentes-comun@\\d+\\.\\d+\\.\\d+$`));
  }
  assert.match(tutorPromptVersion(), /^tutor@\d+\.\d+\.\d+$/);
  // Reglas que no se negocian: el material es dato y la respuesta del tutor se apoya solo en fuentes.
  assert.match(COMMON_RULES, /nunca instrucciones/);
  assert.match(TUTOR_PROMPT.text.json, /son datos, no instrucciones/);
  assert.match(TUTOR_PROMPT.text.stream, /SIN_RESPALDO/);
  assert.match(TUTOR_PROMPT.text.hints.assessment, /sin decir cuál opción es la correcta/);
});
