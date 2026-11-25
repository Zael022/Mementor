import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RangoAvance from '../src/Componentes/RangoAvance.jsx';
import RutaLecciones, { armarParadas } from '../src/Componentes/RutaLecciones.jsx';

// Mapa del curso: orden real, estados como texto, enlaces recorribles con teclado y estado vacío.
const sesion = { preferencias: { showMascots: true } };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));
beforeEach(() => { sesion.preferencias = { showMascots: true }; window.sessionStorage.clear(); });
afterEach(cleanup);

const leccion = (id, title, completed = false) => ({ id, title, completed, status: 'published', position: id });
const MODULOS = [
  {
    id: 1, title: 'Números', practicePairs: 6,
    topics: [
      { id: 11, title: 'Fracciones', prerequisiteIds: [], lessons: [leccion(101, 'Qué es una fracción', true), leccion(102, 'Equivalentes')] },
      { id: 12, title: 'Decimales', prerequisiteIds: [11], lessons: [leccion(103, 'Leer decimales')] },
    ],
  },
  { id: 2, title: 'Medidas', practicePairs: 0, topics: [] },
];
const TAREAS = [
  { id: 7, title: 'Tarea de fracciones', topicId: 11, submitted: false, dueAt: null },
  { id: 8, title: 'Proyecto final', topicId: null, submitted: false, dueAt: '2026-12-10T12:00:00.000Z' },
  { id: 9, title: 'Bitácora', topicId: null, submitted: false, dueAt: '2026-12-01T12:00:00.000Z' },
];

const pintar = (modulos = MODULOS, tareas = TAREAS) => render(<MemoryRouter><RutaLecciones modulos={modulos} tareas={tareas} cursoId={5} /></MemoryRouter>);

describe('mapa del curso', () => {
  it('ordena módulo → tema → lecciones y tareas del tema → Parejas, y al final las tareas sin tema', () => {
    const { lista, siguiente } = armarParadas(MODULOS, TAREAS);
    expect(lista.map((parada) => parada.clave)).toEqual([
      'leccion-101', 'leccion-102', 'tarea-7', 'leccion-103', 'parejas-1',
      'vacio-2', 'parejas-2',
      'tarea-9', 'tarea-8',
    ]);
    expect(lista[siguiente].clave).toBe('leccion-102');
    // El prerrequisito es una recomendación, no un bloqueo.
    expect(lista.find((parada) => parada.clave === 'leccion-103').tema.recomendados).toEqual(['Fracciones']);
  });

  it('cada parada dice su estado como texto y es un enlace real en el orden del recorrido', () => {
    const { container } = pintar();
    const enlaces = screen.getAllByRole('link');
    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
      '/estudiante/lecciones/101', '/estudiante/lecciones/102', '/estudiante/tareas/7', '/estudiante/lecciones/103',
      '/estudiante/cursos/5/parejas/1', '/estudiante/tareas/9', '/estudiante/tareas/8',
    ]);
    expect(enlaces[0].textContent).toContain('Completada');
    expect(enlaces[1].textContent).toContain('Continúa aquí');
    expect(enlaces[1].getAttribute('aria-current')).toBe('step');
    expect(enlaces[2].textContent).toContain('Pendiente');
    expect(enlaces[4].textContent).toContain('6 parejas · no cuenta para la nota');
    // El camino y los nodos son decorativos.
    expect(container.querySelectorAll('[data-nodo]')).toHaveLength(9);
    for (const nodo of container.querySelectorAll('[data-nodo]')) expect(nodo.getAttribute('aria-hidden')).toBe('true');
    // Módulos como lista ordenada con su título y su avance.
    const modulos = container.querySelectorAll('.mapa-modulos > li');
    expect(within(modulos[0]).getByRole('heading', { name: 'Números' })).toBeTruthy();
    expect(modulos[0].textContent).toContain('1 de 4 paradas');
    expect(within(modulos[1]).getByText('Este módulo todavía no tiene lecciones.')).toBeTruthy();
    expect(within(modulos[1]).getByText(/aún no tiene preguntas de práctica/)).toBeTruthy();
    expect(within(modulos[2]).getByRole('heading', { name: 'Tareas del curso' })).toBeTruthy();
  });

  it('con todo hecho celebra el recorrido completo; sin lecciones publicadas muestra un estado vacío real', () => {
    const hecho = MODULOS.map((modulo) => ({ ...modulo, topics: modulo.topics.map((tema) => ({ ...tema, lessons: tema.lessons.map((item) => ({ ...item, completed: true })) })) }));
    const { unmount } = pintar(hecho, TAREAS.map((tarea) => ({ ...tarea, submitted: true })));
    expect(screen.getByText('¡Recorriste todas las paradas!')).toBeTruthy();
    expect(screen.queryByText('Continúa aquí')).toBeNull();
    expect(screen.getAllByText('Entregada')).toHaveLength(3);
    unmount();
    pintar([{ id: 3, title: 'Vacío', practicePairs: 0, topics: [{ id: 30, title: 'Tema', prerequisiteIds: [], lessons: [] }] }], []);
    expect(screen.getByRole('heading', { name: 'Este curso aún no tiene lecciones publicadas' })).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('el rango muestra nombre, barra y lo que falta también como texto', () => {
    const rango = {
      key: 'brillo', name: 'Brillo', level: 2, percent: 33, done: 2, total: 6,
      lessons: { done: 2, total: 5 }, assignments: { done: 0, total: 1 }, next: { key: 'luz', name: 'Luz', threshold: 45, remaining: 1 },
    };
    const { rerender } = render(<RangoAvance rango={rango} variante="banner" />);
    expect(screen.getByText('Brillo')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('33');
    expect(screen.getByText('Te falta 1 lección o tarea para Luz.')).toBeTruthy();
    expect(screen.getByText(/2 de 5 lecciones · 0 de 1 tareas entregadas/)).toBeTruthy();
    rerender(<RangoAvance rango={{ key: null, name: 'Sin rango todavía', level: 0, percent: null, total: 0 }} />);
    expect(screen.getByText('Sin rango todavía')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
