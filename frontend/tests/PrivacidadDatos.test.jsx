import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';
import PrivacidadDatos from '../src/Componentes/PrivacidadDatos.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn() },
}));
const sesion = { usuario: { role: 'student' }, sesionEliminada: vi.fn() };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));

function pedirBaja() {
  render(<MemoryRouter><PrivacidadDatos /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar la eliminación de mi cuenta' }));
  fireEvent.change(screen.getByLabelText('Contraseña actual (para confirmar tu identidad)'), { target: { value: 'ClaveActual2026' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { history: [] } });
});
afterEach(cleanup);

describe('Baja de la cuenta', () => {
  it('cierra la sesión solo cuando el servidor confirma que la baja terminó', async () => {
    api.post.mockResolvedValue({ data: { status: 'completed' } });
    pedirBaja();
    await waitFor(() => expect(sesion.sesionEliminada).toHaveBeenCalled());
  });

  it('con la solicitud pendiente mantiene la sesión y lo explica', async () => {
    api.post.mockResolvedValue({ data: { status: 'pending' } });
    pedirBaja();
    expect(await screen.findByText(/todavía no terminó/)).toBeTruthy();
    expect(sesion.sesionEliminada).not.toHaveBeenCalled();
  });
});
