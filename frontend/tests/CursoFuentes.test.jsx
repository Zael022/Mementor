import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';
import CursoFuentes from '../src/Pages/CursoFuentes.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => ({ usuario: { role: 'teacher' } }) }));

const version = (id, versionNo, state, extra = {}) => ({ id, versionNo, state, active: state === 'ready', createdAt: '2026-11-16T10:00:00Z', usedInAnswers: 0, ...extra });
const fuentes = {
  mode: 'local', configured: true, reason: null, corpus: null,
  notIndexed: [{ origin: 'lesson', id: 3, title: 'Lección antigua' }],
  sources: [
    { id: 1, origin: 'material', title: 'Reglamento', status: 'active', state: 'ready', activeVersionNo: 2, versions: [version(11, 2, 'ready', { usedInAnswers: 4 }), version(10, 1, 'superseded')] },
    { id: 2, origin: 'material', title: 'Escaneado', status: 'active', state: 'error', errorMessage: 'El PDF no tiene texto extraíble.', versions: [version(20, 1, 'error')] },
    { id: 3, origin: 'drive', title: 'Calendario', status: 'retired', state: 'ready', retireReason: 'drive_removed', cleanupStatus: 'done', versions: [version(30, 1, 'retired')] },
  ],
};

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/docente/cursos/5/fuentes']}>
      <Routes><Route path="/docente/cursos/:id/fuentes" element={<CursoFuentes />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (ruta) => {
    if (ruta === '/courses/5') return { data: { id: 5, title: 'Matemática', code: 'MAT', status: 'published' } };
    if (ruta === '/courses/5/knowledge') return { data: fuentes };
    if (ruta === '/courses/5/drive') return { data: { link: null, folders: [] } };
    throw new Error(`ruta inesperada ${ruta}`);
  });
  api.post.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe('Fuentes del tutor', () => {
  it('muestra el estado, el motivo del error, la versión en uso y lo retirado', async () => {
    pintar();
    const reglamento = (await screen.findByText('Reglamento')).closest('li');
    // «Listo» aparece en la insignia de la fuente y en su versión vigente.
    expect(within(reglamento).getAllByText('Listo').length).toBe(2);
    expect(within(reglamento).getByText('En uso: versión 2')).toBeTruthy();
    const escaneado = screen.getByText('Escaneado').closest('li');
    expect(within(escaneado).getByText('El PDF no tiene texto extraíble.')).toBeTruthy();
    expect(screen.getByText(/Motivo: ya no está en la carpeta/)).toBeTruthy();
    expect(screen.getByText(/1 lecciones o archivos que existían antes/)).toBeTruthy();
  });

  it('reintentar, retirar e indexar llaman a la API y recargan la lista', async () => {
    pintar();
    const escaneado = (await screen.findByText('Escaneado')).closest('li');
    fireEvent.click(within(escaneado).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/knowledge/versions/20/retry'));
    const reglamento = screen.getByText('Reglamento').closest('li');
    fireEvent.click(within(reglamento).getByRole('button', { name: 'Retirar del tutor' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/knowledge/sources/1/retire'));
    fireEvent.click(screen.getByRole('button', { name: 'Indexar ahora' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/courses/5/knowledge/index-existing'));
    await waitFor(() => expect(api.get.mock.calls.filter(([ruta]) => ruta === '/courses/5/knowledge').length).toBeGreaterThanOrEqual(4));
  });
});
