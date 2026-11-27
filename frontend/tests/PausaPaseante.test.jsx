import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from '../src/Componentes/Layout.jsx';
import Pausa, { ESTADOS_PAUSA_PASEANTE } from '../src/Componentes/Pausa.jsx';
import PausaPaseante from '../src/Componentes/PausaPaseante.jsx';
import { FRASE_DESPIERTA } from '../src/utils/mensajesMascota.js';
import {
  FRASE_PAUSA_SIESTA, FRASES_PAUSA_CARICIA, FRASES_PAUSA_CURIOSIDAD, FRASES_PAUSA_MOLESTIA,
} from '../src/utils/frasesPausa.js';
import {
  REGLAS_PAUSA, alAcariciar, alClic, crearEstadoPausa, elegirDestino, molestiaActual, rutaConPausa,
} from '../src/utils/pausaPaseante.js';

// Parte A · Pausa paseante: reglas de reacción, rutas donde aparece y el componente con teclado y movimiento reducido.
const sesion = { usuario: { role: 'student', displayName: 'Ana' }, preferencias: {} };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));

beforeEach(() => {
  sesion.usuario = { role: 'student', displayName: 'Ana' };
  sesion.preferencias = { showMascots: true, pausaWalks: true, pausaHiddenToday: false };
  document.documentElement.removeAttribute('data-movimiento');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Clics separados por más de 5 s: siempre curiosidad, nunca molestia.
const clicsTranquilos = (veces, inicio = 0) => {
  let estado = crearEstadoPausa(() => 0.42);
  const frases = [];
  for (let i = 0; i < veces; i += 1) {
    const resultado = alClic(estado, inicio + i * 30000);
    estado = resultado.estado;
    frases.push(resultado.reaccion);
  }
  return { estado, frases };
};

describe('reglas de Pausa paseante', () => {
  it('un clic muestra un dato curioso y no se repite ninguno hasta agotar la lista', () => {
    const total = FRASES_PAUSA_CURIOSIDAD.length;
    const { frases } = clicsTranquilos(total + 1);
    expect(frases[0]).toMatchObject({ tipo: 'curiosidad', pose: 'curioso' });
    const primeraVuelta = frases.slice(0, total).map((reaccion) => reaccion.frase);
    expect(new Set(primeraVuelta).size).toBe(total);
    expect(FRASES_PAUSA_CURIOSIDAD).toContain(frases[total].frase);
  });

  it('los clics rápidos suben la molestia por niveles y la molestia baja sola con el tiempo', () => {
    let estado = crearEstadoPausa();
    const reacciones = [];
    for (let i = 0; i < 8; i += 1) {
      const resultado = alClic(estado, 1000 + i * 500);
      estado = resultado.estado;
      reacciones.push(resultado.reaccion);
    }
    expect(reacciones.slice(0, 3).every((reaccion) => reaccion.tipo === 'curiosidad')).toBe(true);
    expect(reacciones[3]).toMatchObject({ tipo: 'molestia', nivel: 1, pose: 'molesto' });
    expect(FRASES_PAUSA_MOLESTIA[1]).toContain(reacciones[3].frase);
    expect(reacciones[5]).toMatchObject({ nivel: 2, pose: 'enojado' });
    expect(reacciones[7]).toMatchObject({ nivel: 3, pose: 'tapado', alejarse: true, frase: FRASES_PAUSA_MOLESTIA[3][0] });
    // Nivel 3: no responde durante 10 s.
    expect(alClic(estado, 1000 + 7 * 500 + 2000).reaccion).toBeNull();
    // Después del silencio queda en nivel 2 y baja un nivel cada 20 s sin clics.
    const despues = 1000 + 7 * 500;
    expect(molestiaActual(estado, despues + 1000)).toBe(2);
    expect(molestiaActual(estado, despues + REGLAS_PAUSA.bajaMolestiaMs)).toBe(1);
    expect(molestiaActual(estado, despues + 2 * REGLAS_PAUSA.bajaMolestiaMs)).toBe(0);
    expect(alClic(estado, despues + 3 * REGLAS_PAUSA.bajaMolestiaMs).reaccion.tipo).toBe('curiosidad');
  });

  it('la caricia se dispara una vez por periodo de espera y tres caricias seguidas lo duermen', () => {
    let estado = crearEstadoPausa();
    let resultado = alAcariciar(estado, 0);
    expect(resultado.reaccion).toMatchObject({ tipo: 'caricia', pose: 'feliz', corazones: true, frase: FRASES_PAUSA_CARICIA[0] });
    estado = resultado.estado;
    // Dentro de los 15 s de espera no se repite.
    expect(alAcariciar(estado, 5000).reaccion).toBeNull();
    resultado = alAcariciar(estado, REGLAS_PAUSA.esperaCariciaMs);
    expect(resultado.reaccion.frase).toBe(FRASES_PAUSA_CARICIA[1]);
    resultado = alAcariciar(resultado.estado, 2 * REGLAS_PAUSA.esperaCariciaMs);
    expect(resultado.reaccion).toMatchObject({ tipo: 'siesta', pose: 'dormido', frase: FRASE_PAUSA_SIESTA });
    // Dormido no recibe caricias; un clic lo despierta.
    expect(alAcariciar(resultado.estado, 2 * REGLAS_PAUSA.esperaCariciaMs + 20000).reaccion).toBeNull();
    const despierta = alClic(resultado.estado, 2 * REGLAS_PAUSA.esperaCariciaMs + 1000);
    expect(despierta.reaccion).toMatchObject({ tipo: 'despierta', frase: FRASE_DESPIERTA });
  });

  it('solo aparece en las páginas generales del estudiante, nunca en evaluaciones, quizzes, práctica diaria ni el tutor', () => {
    for (const ruta of ['/estudiante/inicio', '/estudiante/cursos', '/estudiante/cursos/4', '/estudiante/cursos/4/parejas/9']) {
      expect(rutaConPausa(ruta)).toBe(true);
    }
    for (const ruta of ['/estudiante/evaluaciones/3', '/estudiante/resultados/8', '/estudiante/cursos/4/quizzes/2',
      '/estudiante/cursos/4/racha', '/estudiante/tutor/4', '/estudiante/lecciones/5', '/docente/inicio', '/admin/usuarios']) {
      expect(rutaConPausa(ruta)).toBe(false);
    }
  });

  it('al elegir dónde detenerse esquiva lo ocupado y, si se aleja, va al punto libre más lejano', () => {
    const zonas = [[0, 300], [500, 700]];
    for (let i = 0; i < 20; i += 1) {
      const x = elegirDestino({ desde: 320, minimo: 0, maximo: 900, ancho: 100, zonas, distanciaMinima: 0, azar: () => i / 20 });
      expect(zonas.every(([inicio, fin]) => x + 100 <= inicio || x >= fin)).toBe(true);
    }
    expect(elegirDestino({ desde: 320, minimo: 0, maximo: 900, ancho: 100, zonas, lejos: true })).toBe(900);
    // Sin lugar libre se queda donde está.
    expect(elegirDestino({ desde: 50, minimo: 0, maximo: 200, ancho: 100, zonas: [[0, 400]] })).toBe(50);
  });
});

describe('dibujo y componente', () => {
  it('cada expresión nueva cambia partes del mismo dibujo decorativo', () => {
    for (const estado of ESTADOS_PAUSA_PASEANTE) {
      const { container, unmount } = render(<Pausa estado={estado} rama={false} />);
      const svg = container.querySelector('svg.pausa');
      expect(svg.getAttribute('data-estado')).toBe(estado);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      unmount();
    }
  });

  it('es un botón con nombre: Enter o un clic da un dato, la tecla A es una caricia, y la frase se anuncia', () => {
    vi.useFakeTimers();
    const { container } = render(<PausaPaseante />);
    const boton = screen.getByRole('button', { name: 'Pausa, la mascota. Presiona para interactuar' });
    const burbuja = container.querySelector('.pausa-paseante-burbuja');
    expect(burbuja.getAttribute('aria-live')).toBe('polite');
    act(() => boton.click());
    expect(FRASES_PAUSA_CURIOSIDAD).toContain(burbuja.textContent);
    fireEvent.keyDown(boton, { key: 'a' });
    expect(burbuja.textContent).toBe(FRASES_PAUSA_CARICIA[0]);
    expect(container.querySelector('.pausa-corazones')).toBeTruthy();
    // La frase se va sola.
    act(() => vi.advanceTimersByTime(6000));
    expect(burbuja.textContent).toBe('');
  });

  it('la presión larga en pantalla táctil es una caricia y no cuenta también como clic', () => {
    vi.useFakeTimers();
    const { container } = render(<PausaPaseante />);
    const boton = screen.getByRole('button', { name: /Pausa, la mascota/ });
    fireEvent.pointerDown(boton, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerUp(boton, { pointerType: 'touch' });
    act(() => boton.click());
    expect(container.querySelector('.pausa-paseante-burbuja').textContent).toBe(FRASES_PAUSA_CARICIA[0]);
  });

  it('con «Menos movimiento» o con el paseo apagado no se desplaza: queda quieto y solo cambia de expresión', () => {
    document.documentElement.setAttribute('data-movimiento', 'reducido');
    const { container, unmount } = render(<PausaPaseante />);
    expect(container.querySelector('.pausa-paseante-capa').hasAttribute('data-quieto')).toBe(true);
    unmount();
    document.documentElement.removeAttribute('data-movimiento');
    sesion.preferencias = { showMascots: true, pausaWalks: false };
    const otra = render(<PausaPaseante />);
    expect(otra.container.querySelector('.pausa-paseante-capa').hasAttribute('data-quieto')).toBe(true);
  });

  it('la capa no recibe clics: solo Pausa (el botón) es interactivo', () => {
    const { container } = render(<PausaPaseante />);
    const capa = container.querySelector('.pausa-paseante-capa');
    expect(capa.querySelectorAll('button')).toHaveLength(1);
    expect(capa.querySelectorAll('a, input, select, textarea')).toHaveLength(0);
  });
});

describe('dónde se monta', () => {
  const pintar = (ruta) => render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<p>Página</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  it('aparece en el inicio del estudiante y no en una evaluación', async () => {
    pintar('/estudiante/inicio');
    expect(await screen.findByRole('button', { name: /Pausa, la mascota/ })).toBeTruthy();
    cleanup();
    pintar('/estudiante/evaluaciones/3');
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /Pausa, la mascota/ })).toBeNull();
  });

  it('no aparece para docentes, con las mascotas ocultas ni escondido por hoy', async () => {
    sesion.usuario = { role: 'teacher', displayName: 'Profe' };
    pintar('/estudiante/inicio');
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /Pausa, la mascota/ })).toBeNull();
    cleanup();
    sesion.usuario = { role: 'student', displayName: 'Ana' };
    for (const preferencias of [{ showMascots: false }, { showMascots: true, pausaHiddenToday: true }]) {
      sesion.preferencias = preferencias;
      pintar('/estudiante/inicio');
      await act(async () => {});
      expect(screen.queryByRole('button', { name: /Pausa, la mascota/ })).toBeNull();
      cleanup();
    }
  });
});
