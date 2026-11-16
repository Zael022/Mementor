import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';
import { useChatTutor } from '../src/hooks/useChatTutor.js';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), stream: vi.fn() },
}));

const threads = [{ id: 12 }];
const saved = { id: 7, role: 'assistant', content: 'Una respuesta anterior.', citations: [] };
let events;
let finish;
let streamSignal;

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [saved] });
  api.post.mockResolvedValue({ data: { id: 13 } });
  api.stream.mockImplementation((path, body, options) => {
    events = options.onEvento;
    streamSignal = options.signal;
    return new Promise((resolve) => { finish = resolve; });
  });
});
afterEach(cleanup);

async function openChat() {
  const hook = renderHook(() => useChatTutor(3, threads));
  await waitFor(() => expect(hook.result.current.cargandoHistorial).toBe(false));
  return hook;
}

it('los deltas actualizan el borrador sin cambiar el historial y las citas llegan al finalizar', async () => {
  const { result } = await openChat();
  let request;
  act(() => { request = result.current.preguntar('¿Qué es la IA?'); });
  const history = result.current.mensajes;
  act(() => { events('delta', { text: 'Una explicación' }); events('delta', { text: ' con fuente.' }); });
  await waitFor(() => expect(result.current.borrador.content).toBe('Una explicación con fuente.'));
  expect(result.current.mensajes).toBe(history);
  expect(history[0]).toBe(saved);
  expect(result.current.borrador.citations).toEqual([]);
  await act(async () => {
    events('final', { messageId: 50, status: 'answer', answer: 'Una explicación con fuente.', citations: [{ position: 1 }], grounded: true });
    finish();
    expect(await request).toBe(true);
  });
  expect(result.current.borrador).toBeNull();
  expect(result.current.mensajes.at(-1).citations).toEqual([{ position: 1 }]);
});

it('nueva conversación cancela el turno y descarta una respuesta tardía del hilo anterior', async () => {
  const { result } = await openChat();
  let request;
  act(() => { request = result.current.preguntar('¿Cuál es el plazo?'); });
  act(() => result.current.nuevaConversacion());
  expect(streamSignal.aborted).toBe(true);
  await act(async () => {
    events('final', { messageId: 51, answer: 'Respuesta tardía', citations: [] });
    finish();
    expect(await request).toBe(false);
  });
  expect(result.current.seleccion).toBeNull();
  expect(result.current.mensajes).toEqual([]);
  expect(result.current.borrador).toBeNull();
});

it('detener conserva todo el texto recibido como interrumpido y sin citas', async () => {
  const { result } = await openChat();
  let request;
  act(() => { request = result.current.preguntar('¿Qué es la IA?'); });
  act(() => { events('delta', { text: 'Texto aún en curso' }); result.current.detener(); });
  await act(async () => { finish(); await request; });
  expect(streamSignal.aborted).toBe(true);
  expect(result.current.borrador).toBeNull();
  expect(result.current.mensajes.at(-1)).toMatchObject({ content: 'Texto aún en curso', estado: 'interrumpido', citations: [] });
});

it('salir del curso cancela la petición activa', async () => {
  const { result, unmount } = await openChat();
  let request;
  act(() => { request = result.current.preguntar('¿Cuál es el plazo?'); });
  unmount();
  expect(streamSignal.aborted).toBe(true);
  finish();
  expect(await request).toBe(false);
});

it('anuncia solo el resultado final para lectores de pantalla, no cada trozo', async () => {
  const hook = await openChat();
  let pending;
  act(() => { pending = hook.result.current.preguntar('¿Qué es una fracción?'); });
  await waitFor(() => expect(events).toBeTypeOf('function'));
  act(() => {
    events('delta', { text: 'Una fracción ' });
    events('delta', { text: 'representa partes [S1]' });
  });
  expect(hook.result.current.anuncio).toBe('');
  await act(async () => {
    events('final', { messageId: 30, status: 'answer', answer: 'Una fracción representa partes [S1]', citations: [{ position: 1, title: 'Fracciones' }], grounded: true });
    finish();
    await pending;
  });
  expect(hook.result.current.anuncio).toBe('Respuesta lista con 1 fuente. Está al final de la conversación.');
});
