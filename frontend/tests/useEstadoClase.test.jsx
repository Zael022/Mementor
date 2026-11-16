import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEstadoClase } from '../src/hooks/useEstadoClase.js';
import { proximoCambio } from '../src/utils/clases.js';

// La ventana para entrar se abre 15 minutos antes; el botón debe activarse en ese instante exacto.
const INICIO = new Date('2026-11-20T15:00:00Z').getTime();
const sesion = { startsAt: new Date(INICIO).toISOString(), durationMinutes: 30, status: 'scheduled' };

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useEstadoClase', () => {
  it('activa «Entrar» justo al abrirse la ventana, sin esperar a una revisión periódica', () => {
    vi.setSystemTime(INICIO - 15 * 60000 - 1000);
    const { result } = renderHook(() => useEstadoClase(sesion));
    expect(result.current).toEqual({ estado: 'upcoming', puedeEntrar: false });
    act(() => { vi.advanceTimersByTime(999); });
    expect(result.current.puedeEntrar).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toEqual({ estado: 'upcoming', puedeEntrar: true });
  });

  it('cambia a «en vivo» al empezar y desactiva el botón al terminar', () => {
    vi.setSystemTime(INICIO - 1000);
    const { result } = renderHook(() => useEstadoClase(sesion));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toEqual({ estado: 'live', puedeEntrar: true });
    act(() => { vi.advanceTimersByTime(30 * 60000 + 1); });
    expect(result.current).toEqual({ estado: 'ended', puedeEntrar: false });
  });

  it('no deja temporizadores pendientes cuando la clase terminó o se canceló', () => {
    expect(proximoCambio(sesion, INICIO + 31 * 60000)).toBeNull();
    expect(proximoCambio({ ...sesion, status: 'cancelled' }, INICIO - 60000)).toBeNull();
    vi.setSystemTime(INICIO + 31 * 60000);
    renderHook(() => useEstadoClase(sesion));
    expect(vi.getTimerCount()).toBe(0);
  });
});
