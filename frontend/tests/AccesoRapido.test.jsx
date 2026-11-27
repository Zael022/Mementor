import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';
import AccesoRapido from '../src/Componentes/AccesoRapido.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Acceso rápido de prueba', () => {
  it('no aparece si el modo de prueba está apagado o el backend no responde', async () => {
    api.get.mockResolvedValueOnce({ data: { enabled: false, accounts: [] } });
    const { container, unmount } = render(<AccesoRapido alEntrar={vi.fn()} />);
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/demo'));
    expect(container.innerHTML).toBe('');
    unmount();
    api.get.mockRejectedValueOnce(new Error('sin red'));
    const otro = render(<AccesoRapido alEntrar={vi.fn()} />);
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(otro.container.innerHTML).toBe('');
  });

  it('con el modo encendido muestra un botón plegado por rol y entra con el elegido', async () => {
    api.get.mockResolvedValueOnce({ data: { enabled: true, accounts: [
      { role: 'student', label: 'Estudiante', email: 'estudiante@prueba.mentorai.test' },
      { role: 'teacher', label: 'Docente', email: 'docente@prueba.mentorai.test' },
    ] } });
    const alEntrar = vi.fn();
    render(<AccesoRapido alEntrar={alEntrar} />);
    const resumen = await screen.findByText('Acceso rápido de prueba');
    expect(resumen.closest('details').open).toBe(false);
    fireEvent.click(resumen);
    fireEvent.click(screen.getByRole('button', { name: 'Docente' }));
    expect(alEntrar).toHaveBeenCalledWith('teacher');
  });
});
