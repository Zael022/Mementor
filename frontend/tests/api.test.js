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
