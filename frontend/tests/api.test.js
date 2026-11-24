import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';

afterEach(() => vi.unstubAllGlobals());

it('SSE acepta CRLF y caracteres UTF-8 divididos entre paquetes', async () => {
  const bytes = new TextEncoder().encode('event: delta\r\ndata: {"text":"matrícula"}\r\n\r\nevent: final\r\ndata: {"answer":"listo"}\r\n\r\n');
  const body = new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
    controller.close();
  } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } })));
  const events = [];
  await api.stream('/tutor', {}, { onEvento: (name, data) => events.push([name, data]) });
  expect(events).toEqual([['delta', { text: 'matrícula' }], ['final', { answer: 'listo' }]]);
  expect(body.locked).toBe(false);
});

it('un fallo al procesar un evento cierra el stream para detener la generación', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({
    start: (controller) => controller.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"hola"}\n\n')),
    cancel,
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } })));
  await expect(api.stream('/tutor', {}, { onEvento: () => { throw new Error('Evento inválido'); } })).rejects.toThrow('Evento inválido');
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});

it('los comentarios «: ping» del servidor se ignoran y no interrumpen la respuesta', async () => {
  const texto = ': ping\n\nevent: start\ndata: {"sources":1}\n\n: ping\n\nevent: final\ndata: {"answer":"listo"}\n\n';
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(texto)); controller.close(); } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } })));
  const events = [];
  await api.stream('/tutor', {}, { onEvento: (name, data) => events.push([name, data]) });
  expect(events).toEqual([['start', { sources: 1 }], ['final', { answer: 'listo' }]]);
});

// M14: el vencimiento de la sesión se trata igual en una petición normal y en el streaming del tutor.
it('un 401 avisa la sesión vencida tanto en request como en stream', async () => {
  const respuesta401 = () => new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Debes iniciar sesión.' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => respuesta401()));
  const vencida = vi.fn();
  window.addEventListener('mentor:sesion-vencida', vencida);
  await expect(api.get('/courses')).rejects.toMatchObject({ status: 401 });
  await expect(api.stream('/tutor/threads/1/messages/stream', {}, { onEvento: () => {} })).rejects.toMatchObject({ status: 401 });
  window.removeEventListener('mentor:sesion-vencida', vencida);
  expect(vencida).toHaveBeenCalledTimes(2);
});

it('un 403 por documentos pendientes vuelve a pedir la aceptación', async () => {
  const pendientes = [{ document: 'privacy', version: '2026-11-23' }];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'CONSENT_REQUIRED', message: 'Antes de continuar debes aceptar.', details: pendientes } }), { status: 403 })));
  const escucha = vi.fn();
  window.addEventListener('mentor:consentimiento-pendiente', escucha);
  await expect(api.post('/courses', {})).rejects.toMatchObject({ code: 'CONSENT_REQUIRED', message: 'Antes de continuar debes aceptar.' });
  window.removeEventListener('mentor:consentimiento-pendiente', escucha);
  expect(escucha.mock.calls[0][0].detail).toEqual(pendientes);
});

it('una página de error del proxy se explica como servicio no disponible', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })));
  await expect(api.post('/auth/login', {})).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: expect.stringMatching(/servicio no está disponible/) });
});
