import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';
import Asistente from '../src/Pages/Asistente.jsx';
import Asistentes from '../src/Pages/Asistentes.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => ({ usuario: { role: 'teacher' } }) }));

const catalogo = [
  { key: 'tutor', name: 'Tutor del curso (RAG)', purpose: 'Responde dudas.', privacy: 'Sin evidencia no llama al modelo.', link: { teacher: '/docente/cursos/:courseId/tutor' } },
  { key: 'question_generator', name: 'Generador de preguntas', purpose: 'Propone preguntas.', privacy: 'Solo usa material del curso.' },
  { key: 'compliance_checker', name: 'Asistente de cumplimiento', purpose: 'Revisa un texto.', privacy: 'Oculta cédulas y correos.' },
];
const historial = [
  { id: 9, agent: 'compliance_checker', name: 'Asistente de cumplimiento', status: 'success', createdAt: '2026-11-27T10:00:00Z', latencyMs: 1200 },
];

function pintar(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/asistentes" element={<Asistentes />} />
        <Route path="/asistentes/:clave" element={<Asistente />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (ruta) => {
    if (ruta === '/agents') return { data: catalogo };
    if (ruta === '/agents/runs') return { data: historial };
    if (ruta.startsWith('/courses')) return { data: [{ id: 5, title: 'Matemática' }] };
    throw new Error(`ruta inesperada ${ruta}`);
  });
});
afterEach(cleanup);

describe('Asistentes de IA', () => {
  it('cada asistente tiene su color y «Usar» abre su página en otra pestaña', async () => {
    pintar('/asistentes');
    const usar = await screen.findByRole('link', { name: /Usar Generador de preguntas/ });
    expect(usar.getAttribute('href')).toBe('/asistentes/question_generator');
    expect(usar.getAttribute('target')).toBe('_blank');
    expect(usar.getAttribute('rel')).toContain('noopener');
    expect(usar.closest('article').classList.contains('acento-violeta')).toBe(true);
    expect(screen.getByRole('link', { name: 'Abrir el tutor' }).getAttribute('href')).toBe('/docente/cursos/5/tutor');
    expect(screen.getByText('1 uso registrado')).toBeTruthy();
  });

  it('la página propia muestra el formulario, el espacio del resultado y los usos de ese asistente', async () => {
    api.post.mockResolvedValue({ data: { status: 'ok', runId: 10, result: { riskLevel: 'bajo', summary: 'Sin datos personales.', automaticFindings: [], issues: [] } } });
    pintar('/asistentes/compliance_checker');
    expect(await screen.findByRole('heading', { level: 1, name: 'Asistente de cumplimiento' })).toBeTruthy();
    expect(screen.getByText(/El borrador aparecerá aquí/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tus últimos usos de este asistente' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Texto a revisar/), { target: { value: 'Un comunicado sin datos personales para revisar.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/agents/compliance_checker/run', { text: 'Un comunicado sin datos personales para revisar.' }));
    expect(await screen.findByText(/Sin datos personales\./)).toBeTruthy();
  });

  it('un asistente que no corresponde al rol muestra un aviso y el enlace de regreso', async () => {
    pintar('/asistentes/study_coach');
    expect(await screen.findByRole('heading', { name: 'Asistente no disponible' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Todos los asistentes/ }).getAttribute('href')).toBe('/asistentes');
  });
});
