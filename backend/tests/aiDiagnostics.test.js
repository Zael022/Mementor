import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarIA, explicarFallo, FUNCIONES_IA } from '../src/services/aiDiagnostics.js';

// `npm run ia:verificar`: diagnóstico de la IA con un proveedor simulado (nunca llama al real en las pruebas).
const VARIABLES = ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_MODEL_RAPIDO', 'AI_MODEL_AVANZADO', 'AI_BASE_URL'];
const guardadas = Object.fromEntries(VARIABLES.map((nombre) => [nombre, process.env[nombre]]));
const configurar = (valores) => {
  for (const nombre of VARIABLES) delete process.env[nombre];
  Object.assign(process.env, valores);
};
afterEach(() => configurar(Object.fromEntries(Object.entries(guardadas).filter(([, valor]) => valor !== undefined))));

const respuesta = (status, cuerpo) => async () => ({ ok: status < 400, status, json: async () => cuerpo });
const CLAVE = 'sk-ant-prueba-que-no-existe';

test('sin clave dice qué variable falta y ninguna función queda lista', async () => {
  configurar({ AI_PROVIDER: 'anthropic', AI_MODEL: 'claude-sonnet-5-5' });
  let llamadas = 0;
  const resultado = await diagnosticarIA({ fetchImpl: async () => { llamadas += 1; return {}; } });
  assert.equal(llamadas, 0, 'sin configuración no se llama al proveedor');
  assert.equal(resultado.todo, false);
  assert.match(resultado.niveles.avanzado.motivo, /AI_API_KEY/);
  assert.equal(resultado.funciones.length, FUNCIONES_IA.length);
});

test('con la configuración correcta hace una llamada mínima y marca todas las funciones como listas', async () => {
  configurar({ AI_PROVIDER: 'anthropic', AI_API_KEY: CLAVE, AI_MODEL: 'claude-sonnet-5-5' });
  const enviadas = [];
  const resultado = await diagnosticarIA({
    fetchImpl: async (url, opciones) => {
      enviadas.push({ url, opciones });
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'OK' }] }) };
    },
  });
  assert.equal(resultado.todo, true);
  // Un solo modelo para los dos niveles: una sola llamada, con pocos tokens y la clave solo en la cabecera.
  assert.equal(enviadas.length, 1);
  assert.equal(enviadas[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(JSON.parse(enviadas[0].opciones.body).max_tokens, 5);
  assert.equal(enviadas[0].opciones.headers['x-api-key'], CLAVE);
  assert.ok(!JSON.stringify(resultado).includes(CLAVE), 'el resultado nunca incluye la clave');
});

test('con modelos distintos por nivel revisa cada uno y explica el que falla', async () => {
  configurar({ AI_PROVIDER: 'anthropic', AI_API_KEY: CLAVE, AI_MODEL_RAPIDO: 'claude-haiku-5-5', AI_MODEL_AVANZADO: 'modelo-inexistente' });
  const resultado = await diagnosticarIA({
    fetchImpl: async (url, opciones) => (JSON.parse(opciones.body).model === 'modelo-inexistente'
      ? { ok: false, status: 404, json: async () => ({ error: { type: 'not_found_error', message: 'model: modelo-inexistente' } }) }
      : { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'OK' }] }) }),
  });
  assert.equal(resultado.niveles.rapido.funciona, true);
  assert.equal(resultado.niveles.avanzado.funciona, false);
  assert.match(resultado.niveles.avanzado.motivo, /modelo no existe/);
  assert.equal(resultado.funciones.find((funcion) => funcion.clave === 'tutor').funciona, false);
  assert.equal(resultado.funciones.find((funcion) => funcion.clave === 'lesson_summarizer').funciona, true);
});

test('avisa si AI_BASE_URL apunta a un servidor de prueba local o si la clave parece incompleta', async () => {
  configurar({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'abc', AI_MODEL: 'claude-sonnet-5-5', AI_BASE_URL: 'http://127.0.0.1:4599/v1/messages' });
  const resultado = await diagnosticarIA({ fetchImpl: respuesta(401, { error: { type: 'authentication_error' } }) });
  const avisos = resultado.niveles.avanzado.avisos.join(' ');
  assert.match(avisos, /servidor de prueba/);
  assert.match(avisos, /sk-ant-/);
  assert.match(resultado.niveles.avanzado.motivo, /no es válida/);
});

test('explica en español los fallos comunes del proveedor', () => {
  assert.match(explicarFallo(400, { error: { message: 'Your credit balance is too low to access the Anthropic API.' } }), /saldo/);
  assert.match(explicarFallo(429, {}), /Espera un minuto/);
  assert.match(explicarFallo(529, {}), /saturado/);
  assert.match(explicarFallo(403, {}), /permiso/);
});

test('sin conexión con el proveedor lo dice sin romperse', async () => {
  configurar({ AI_PROVIDER: 'anthropic', AI_API_KEY: CLAVE, AI_MODEL: 'claude-sonnet-5-5' });
  const resultado = await diagnosticarIA({ fetchImpl: async () => { throw new Error('sin red'); } });
  assert.match(resultado.niveles.avanzado.motivo, /No se pudo conectar/);
});
