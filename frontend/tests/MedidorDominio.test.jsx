import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import MedidorDominio from '../src/Componentes/MedidorDominio.jsx';

// Datos efímeros de prueba con la forma que devuelve /me/mastery.
const tema = (masteryScore, extra = {}) => ({ topicId: 1, topicTitle: 'Fracciones', masteryScore, evidenceCount: 4, label: 'estimado', ...extra });
const ancho = () => screen.getByTestId('relleno-dominio').style.width;

function movimientoReducido(activo) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: activo && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => cleanup());

describe('MedidorDominio con React Spring', () => {
  it('0.72 muestra 72 % desde el inicio y la barra llega a ese valor', async () => {
    movimientoReducido(false);
    render(<MedidorDominio tema={tema(0.72)} />);
    expect(screen.getByText('72 %')).toBeTruthy();
    expect(screen.getByText(/Estimado · 4 respuesta\(s\) consideradas/)).toBeTruthy();
    await waitFor(() => expect(ancho()).toBe('72%'), { timeout: 3000 });
  });

  it('un valor real de cero muestra 0 %', async () => {
    movimientoReducido(false);
    render(<MedidorDominio tema={tema(0)} />);
    expect(screen.getByText('0 %')).toBeTruthy();
    await waitFor(() => expect(ancho()).toBe('0%'));
  });

  it('null conserva «Sin evidencia suficiente» y n/a', () => {
    movimientoReducido(false);
    render(<MedidorDominio tema={tema(null, { label: 'sin_evidencia', evidenceCount: 0 })} />);
    expect(screen.getByText('n/a')).toBeTruthy();
    expect(screen.getByText(/Sin evidencia suficiente · 0 respuesta/)).toBeTruthy();
  });

  it('con movimiento reducido el valor final aparece de inmediato', () => {
    movimientoReducido(true);
    render(<MedidorDominio tema={tema(0.72)} />);
    expect(ancho()).toBe('72%');
  });

  it('se mantiene entre 0 y 100 % y respeta cambios rápidos', async () => {
    movimientoReducido(false);
    const { rerender } = render(<MedidorDominio tema={tema(1.4)} />);
    expect(screen.getByText('100 %')).toBeTruthy();
    rerender(<MedidorDominio tema={tema(0.3)} />);
    rerender(<MedidorDominio tema={tema(0.55)} />);
    expect(screen.getByText('55 %')).toBeTruthy();
    await waitFor(() => expect(ancho()).toBe('55%'), { timeout: 3000 });
    const valor = parseFloat(ancho());
    expect(valor).toBeGreaterThanOrEqual(0);
    expect(valor).toBeLessThanOrEqual(100);
  });
});
