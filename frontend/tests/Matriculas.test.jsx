import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';
import CursoMatriculas from '../src/Pages/CursoMatriculas.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('../src/Componentes/EncabezadoCurso.jsx', () => ({ default: () => null }));

const matriculas = [
  { id: 1, status: 'active', student: { id: 10, displayName: 'Ana', email: 'ana@ejemplo.test', status: 'active' } },
  { id: 2, status: 'withdrawn', student: { id: 11, displayName: 'Beto', email: 'beto@ejemplo.test', status: 'active' } },
  { id: 3, status: 'withdrawn', student: { id: 12, displayName: 'Caro', email: 'caro@ejemplo.test', status: 'disabled' } },
];
const pintar = () => render(
  <MemoryRouter initialEntries={['/docente/cursos/5/matriculas']}>
    <Routes><Route path="/docente/cursos/:id/matriculas" element={<CursoMatriculas />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (ruta) => {
    if (ruta === '/courses/5') return { data: { id: 5, title: 'Curso' } };
    if (ruta === '/courses/5/enrollments') return { data: matriculas };
    return { data: [] };
  });
});
afterEach(cleanup);

describe('Matrículas', () => {
  it('ofrece retirar a los activos y reintegrar a los retirados con cuenta habilitada', async () => {
    pintar();
    expect(await screen.findByRole('button', { name: 'Retirar a Ana' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintegrar a Beto' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintegrar a Caro' })).toBeNull();
    expect(screen.getByText(/Cuenta deshabilitada/)).toBeTruthy();
  });

  it('reintegrar vuelve a matricular al mismo estudiante y lo confirma', async () => {
    api.post.mockResolvedValue({ data: { id: 2, status: 'active', reinstated: true } });
    pintar();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintegrar a Beto' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/courses/5/enrollments', { studentId: 11 }));
    expect(await screen.findByText('Beto fue reintegrado al curso con su historial.')).toBeTruthy();
  });
});
