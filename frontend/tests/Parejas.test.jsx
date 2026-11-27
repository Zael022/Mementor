import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ParejasModulo from '../src/Pages/ParejasModulo.jsx';
import { api } from '../src/services/api.js';

// Parejas: juego completo con teclado, anuncios por aria-live, movimiento reducido y estado vacío.
vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const sesion = { preferencias: { showMascots: true, showBigCelebrations: true } };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));

// Servidor simulado: el cliente nunca recibe las parejas, solo textos al voltear y el resultado al comparar.
const CARTAS = [
  { id: 'cartaUno01', kind: 'question', text: '¿Cuánto es 1/2 + 1/4?', pair: 0 },
  { id: 'cartaDos02', kind: 'question', text: '¿Qué indica el denominador?', pair: 1 },
  { id: 'cartaTres3', kind: 'answer', text: 'Numerador', pair: 2 },
  { id: 'cartaCua04', kind: 'answer', text: '3/4', pair: 0 },
  { id: 'cartaCin05', kind: 'question', text: '¿Cómo se llama el número de arriba?', pair: 2 },
  { id: 'cartaSei06', kind: 'answer', text: 'En cuántas partes se divide', pair: 1 },
];
let estado;
function servidor() {
  estado = { matched: new Set(), attempts: 0 };
  api.get.mockResolvedValue({ data: { id: 5, title: 'Matemática', modules: [{ id: 1, title: 'Números', practicePairs: 3, topics: [] }] } });
  api.post.mockImplementation(async (ruta, cuerpo) => {
    if (ruta === '/modules/1/memory-games') {
      return { data: { id: 77, pairCount: 3, matchedPairs: 0, attempts: 0, elapsedSeconds: 0, status: 'in_progress', cards: CARTAS.map((carta, i) => ({ id: carta.id, position: i + 1, matched: false })) } };
    }
    const carta = (id) => CARTAS.find((item) => item.id === id);
    const vista = (item) => ({ id: item.id, position: CARTAS.indexOf(item) + 1, kind: item.kind, text: item.text });
    if (ruta === '/memory-games/77/reveal') return { data: vista(carta(cuerpo.cardId)) };
    if (ruta === '/memory-games/77/match') {
      const [a, b] = cuerpo.cardIds.map(carta);
      estado.attempts += 1;
      const match = a.pair === b.pair;
      if (match) { estado.matched.add(a.id); estado.matched.add(b.id); }
      const matchedPairs = estado.matched.size / 2;
      return { data: { match, cards: [vista(a), vista(b)], matchedPairs, pairCount: 3, attempts: estado.attempts, finished: matchedPairs === 3, elapsedSeconds: 42 } };
    }
    throw new Error(`Ruta inesperada ${ruta}`);
  });
}

const abrir = () => render(
  <MemoryRouter initialEntries={['/estudiante/cursos/5/parejas/1']}>
    <Routes><Route path="/estudiante/cursos/:id/parejas/:moduleId" element={<ParejasModulo />} /></Routes>
  </MemoryRouter>,
);
const carta = (posicion) => document.querySelector(`.carta[data-posicion="${posicion}"]`);
// En un navegador, Enter sobre un botón lo activa: aquí se simula esa activación.
const enter = async (boton) => { boton.focus(); await act(async () => { fireEvent.click(boton); }); };

beforeEach(() => {
  vi.clearAllMocks();
  sesion.preferencias = { showMascots: true, showBigCelebrations: true };
  document.documentElement.removeAttribute('data-movimiento');
  servidor();
});
afterEach(cleanup);

describe('Parejas', () => {
  it('se juega completo con el teclado y anuncia aciertos y fallos', async () => {
    abrir();
    const empezar = await screen.findByRole('button', { name: 'Empezar' });
    await act(async () => { fireEvent.click(empezar); });
    expect(api.post).toHaveBeenCalledWith('/modules/1/memory-games', { pairs: 6 });
    await waitFor(() => expect(carta(1)).toBeTruthy());
    // El nombre accesible sale de la cara visible de la carta.
    expect(screen.getByRole('button', { name: 'Carta 1, boca abajo' })).toBe(carta(1));
    // El foco empieza en la primera carta.
    expect(document.activeElement).toBe(carta(1));

    // Flechas para moverse por el tablero.
    carta(1).focus();
    fireEvent.keyDown(carta(1), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(carta(2));
    fireEvent.keyDown(carta(2), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(carta(1));

    const region = document.querySelector('.parejas-orbi [aria-live="polite"]');
    expect(region.textContent).toBe('Voltea dos cartas: una pregunta y su respuesta.');

    // Fallo: no son pareja.
    await enter(carta(1));
    expect(screen.getByRole('button', { name: 'Carta 1: Pregunta: ¿Cuánto es 1/2 + 1/4?' })).toBe(carta(1));
    await enter(carta(2));
    expect(region.textContent).toBe('Casi. Mira bien y prueba otra vez.');

    // Aciertos con Enter hasta terminar.
    for (const [a, b] of [[1, 4], [2, 6], [3, 5]]) {
      await enter(carta(a));
      await enter(carta(b));
      expect(screen.getByRole('button', { name: new RegExp(`^Carta ${a}: .*\\(pareja encontrada\\)$`) })).toBe(carta(a));
    }
    expect(region.textContent).toBe('¡Encontraste las 3 parejas en 4 intentos!');
    expect(screen.getByRole('heading', { name: '¡Tablero completo!' })).toBeTruthy();
    expect(screen.getByText('Tiempo: 42 s')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jugar otra vez' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al mapa' }).getAttribute('href')).toBe('/estudiante/cursos/5?seccion=trabajo&ver=lecciones');
    // El marcador refleja lo que dice el servidor.
    expect(screen.getByText('3 de 3')).toBeTruthy();
  });

  it('con movimiento reducido las cartas cambian de cara sin girar', async () => {
    document.documentElement.setAttribute('data-movimiento', 'reducido');
    abrir();
    const empezar = await screen.findByRole('button', { name: 'Empezar' });
    await act(async () => { fireEvent.click(empezar); });
    await waitFor(() => expect(carta(1)).toBeTruthy());
    await enter(carta(1));
    // El giro se fija de inmediato (sin interpolación) y la carta muestra su texto.
    expect(carta(1).querySelector('.carta-interior').style.transform).toContain('rotateY(180deg)');
    expect(carta(1).classList.contains('volteada')).toBe(true);
  });

  it('si el módulo no tiene preguntas con clave visible, muestra un estado vacío real', async () => {
    api.get.mockResolvedValue({ data: { id: 5, title: 'Matemática', modules: [{ id: 1, title: 'Números', practicePairs: 0, topics: [] }] } });
    abrir();
    expect(await screen.findByRole('heading', { name: 'Este módulo aún no tiene preguntas de práctica' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Empezar/ })).toBeNull();
  });
});
