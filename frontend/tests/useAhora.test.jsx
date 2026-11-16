import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAhora } from '../src/hooks/useAhora.js';
import { estadoClase } from '../src/utils/clases.js';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('habilita la clase sin recargar y pausa el reloj hasta que la pestaña vuelve a estar visible', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T15:44:50Z'));
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const session = { startsAt: '2026-11-16T16:00:00Z', durationMinutes: 60, status: 'scheduled' };
  const { result, unmount } = renderHook(() => estadoClase(session, useAhora(15000)));
  expect(result.current.puedeEntrar).toBe(false);
  act(() => vi.advanceTimersByTime(15000));
  expect(result.current.puedeEntrar).toBe(true);
  visibility.mockReturnValue('hidden');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(2 * 3600000));
  visibility.mockReturnValue('visible');
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(result.current.estado).toBe('ended');
  expect(result.current.puedeEntrar).toBe(false);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
