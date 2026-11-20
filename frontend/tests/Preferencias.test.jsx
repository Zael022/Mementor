import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PREFERENCIAS_BASE, aplicarPreferencias, guardarPreferenciasLocales, leerPreferenciasLocales,
} from '../src/services/preferencias.js';
import { prefiereMenosMovimiento } from '../src/hooks/useMovimiento.js';
import { api } from '../src/services/api.js';
import Configuracion from '../src/Pages/Configuracion.jsx';
import EstudiantePlan from '../src/Pages/EstudiantePlan.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const sesion = { usuario: null, preferencias: null, guardarPreferencias: vi.fn(), actualizarUsuario: vi.fn() };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));

window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
const raiz = document.documentElement;

beforeEach(() => {
  vi.clearAllMocks();
  aplicarPreferencias(PREFERENCIAS_BASE);
  sesion.usuario = { displayName: 'Ana', email: 'ana@ejemplo.test', role: 'student' };
  sesion.preferencias = { ...PREFERENCIAS_BASE };
  sesion.guardarPreferencias.mockImplementation(async (cambios) => ({ ...sesion.preferencias, ...cambios }));
  // Configuración también carga los datos personales.
  api.get.mockResolvedValue({ data: { displayName: 'Ana', firstName: null, lastName: null, phone: null, bio: null } });
});
afterEach(cleanup);

describe('Aplicar preferencias', () => {
  it('sin elegir tema se sigue al sistema y cada opción se refleja en <html>', () => {
    expect(raiz.hasAttribute('data-tema')).toBe(false);
    aplicarPreferencias({ theme: 'dark', textScale: 130, highContrast: true, reducedMotion: true, readingSpacing: true, underlineLinks: true });
    expect(raiz.getAttribute('data-tema')).toBe('oscuro');
    expect(raiz.getAttribute('data-contraste')).toBe('alto');
    expect(raiz.getAttribute('data-movimiento')).toBe('reducido');
    expect(raiz.getAttribute('data-lectura')).toBe('espaciada');
    expect(raiz.getAttribute('data-enlaces')).toBe('subrayados');
    expect(raiz.style.getPropertyValue('--escala-texto')).toBe('1.3');
    expect(prefiereMenosMovimiento()).toBe(true);

    aplicarPreferencias({ theme: 'light' });
    expect(raiz.getAttribute('data-tema')).toBe('claro');
    expect(raiz.hasAttribute('data-contraste')).toBe(false);
    expect(prefiereMenosMovimiento()).toBe(false);
  });

  it('la copia local tolera un almacenamiento bloqueado o con datos dañados', () => {
    guardarPreferenciasLocales({ theme: 'dark' });
    expect(leerPreferenciasLocales()).toEqual({ theme: 'dark' });
    window.localStorage.setItem('mentor.preferencias', '{roto');
    expect(leerPreferenciasLocales()).toBeNull();
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('bloqueado'); };
    expect(leerPreferenciasLocales()).toBeNull();
    Storage.prototype.getItem = original;
  });
});

describe('Configuración', () => {
  it('cambiar el tema y un ajuste de accesibilidad guarda solo ese campo', async () => {
    render(<MemoryRouter><Configuracion /></MemoryRouter>);
    fireEvent.click(screen.getByLabelText('Oscuro'));
    expect(sesion.guardarPreferencias).toHaveBeenCalledWith({ theme: 'dark' });
    expect(await screen.findByText('Preferencias guardadas en tu cuenta.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Alto contraste'));
    expect(sesion.guardarPreferencias).toHaveBeenLastCalledWith({ highContrast: true });
    fireEvent.change(screen.getByLabelText('Preguntas en la práctica diaria'), { target: { value: '10' } });
    expect(sesion.guardarPreferencias).toHaveBeenLastCalledWith({ practiceSize: 10 });
  });

  it('las metas de estudio solo aparecen para estudiantes', () => {
    sesion.usuario = { ...sesion.usuario, role: 'teacher' };
    render(<MemoryRouter><Configuracion /></MemoryRouter>);
    expect(screen.getByText('Apariencia y accesibilidad')).toBeTruthy();
    expect(screen.queryByText('Metas de estudio')).toBeNull();
  });
});

describe('Mi plan', () => {
  const rutas = {
    '/courses?limit=100': [{ id: 7, title: 'Álgebra' }],
    '/me/reviews?courseId=7': [
      { topicId: 1, topicTitle: 'Fracciones', status: 'due', recallPct: 72, dueAt: '2026-11-19T00:00:00Z' },
      { topicId: 2, topicTitle: 'Ecuaciones', status: 'new', recallPct: null, dueAt: null },
    ],
    '/courses/7/study-plan': null,
  };

  it('registra la autoevaluación de un repaso que toca hoy', async () => {
    api.get.mockImplementation(async (ruta) => ({ data: rutas[ruta] }));
    api.post.mockResolvedValue({ data: { scheduledDays: 9 } });
    render(<MemoryRouter><EstudiantePlan /></MemoryRouter>);
    expect(await screen.findByText('Fracciones')).toBeTruthy();
    expect(screen.getByText(/1 tema aún no tiene repasos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Me costó' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/topics/1/reviews', { grade: 2 }));
    expect(await screen.findByText('«Fracciones» volverá en 9 días.')).toBeTruthy();
  });

  it('sin plan muestra el formulario y envía la zona horaria de forma explícita', async () => {
    sesion.preferencias = { ...PREFERENCIAS_BASE, timeZone: 'America/Costa_Rica', dailyGoalMinutes: 45 };
    api.get.mockImplementation(async (ruta) => ({ data: rutas[ruta] }));
    api.post.mockResolvedValue({ data: {} });
    render(<MemoryRouter><EstudiantePlan /></MemoryRouter>);
    expect(await screen.findByText(/America\/Costa Rica|America Costa Rica|Costa Rica/)).toBeTruthy();
    expect(screen.getByLabelText('Minutos por día de estudio').value).toBe('45');
    fireEvent.click(screen.getByLabelText('Sáb'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear plan' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/courses/7/study-plan', expect.objectContaining({
      minutesPerSession: 45, studyDays: [1, 2, 3, 4, 5, 6], timeZone: 'America/Costa_Rica',
    })));
  });
});
