import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BienvenidaRegreso from '../src/Componentes/BienvenidaRegreso.jsx';
import EstadoVacio from '../src/Componentes/EstadoVacio.jsx';
import Mascota from '../src/Componentes/Mascota.jsx';
import Orbi, { ESTADOS_ORBI } from '../src/Componentes/Orbi.jsx';
import Pausa, { ESTADOS_PAUSA } from '../src/Componentes/Pausa.jsx';
import * as mensajes from '../src/utils/mensajesMascota.js';

const { mensajeRango, MENSAJE_REGRESO, UMBRAL_DIAS_REGRESO } = mensajes;

// Orbi y Pausa: estados, preferencia de ocultar, movimiento reducido y accesibilidad.
const sesion = { preferencias: { showMascots: true, showBigCelebrations: true } };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));

beforeEach(() => {
  sesion.preferencias = { showMascots: true, showBigCelebrations: true };
  document.documentElement.removeAttribute('data-movimiento');
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe('mascotas', () => {
  it('cada estado de Orbi y de Pausa se dibuja cambiando partes del mismo SVG decorativo', () => {
    for (const estado of ESTADOS_ORBI) {
      const { container, unmount } = render(<Orbi estado={estado} />);
      const svg = container.querySelector('svg.orbi');
      expect(svg.getAttribute('data-estado')).toBe(estado);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      // Las mismas partes base en todos los estados (no son dibujos distintos).
      for (const parte of ['cuerpo', 'birrete', 'brazo-saludo', 'brazo-mapa', 'ojos', 'boca']) {
        expect(svg.querySelector(`[data-parte="${parte}"]`), `${estado}: ${parte}`).toBeTruthy();
      }
      unmount();
    }
    // Ánimo: la hebilla brilla. Descanso: ojos cerrados (sin pupilas).
    expect(render(<Orbi estado="animo" />).container.querySelector('[data-parte="brillo-hebilla"]')).toBeTruthy();
    expect(render(<Orbi estado="descanso" />).container.querySelector('[data-parte="parpados"]')).toBeNull();

    for (const estado of ESTADOS_PAUSA) {
      const { container, unmount } = render(<Pausa estado={estado} />);
      const svg = container.querySelector('svg.pausa');
      expect(svg.getAttribute('data-estado')).toBe(estado);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.querySelector('[data-parte="rama"]')).toBeTruthy();
      unmount();
    }
    expect(render(<Pausa estado="leyendo" />).container.querySelector('[data-parte="libro"]')).toBeTruthy();
    expect(render(<Pausa estado="dormido" />).container.querySelectorAll('[data-parte="z"]')).toHaveLength(3);
  });

  it('el mensaje es texto visible con aria-live y el dibujo queda oculto para el lector', () => {
    const { container } = render(<Mascota personaje="orbi" estado="saludo" mensaje="Te faltan 2 lecciones para Brillo." anunciar />);
    const mensaje = screen.getByText('Te faltan 2 lecciones para Brillo.');
    expect(mensaje.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('«Mostrar mascotas» apagado las oculta; un mensaje útil puede quedar como texto', () => {
    sesion.preferencias = { showMascots: false };
    const { container, rerender } = render(<Mascota personaje="pausa" estado="leyendo" mensaje="Aprende a tu ritmo." />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByText('Aprende a tu ritmo.')).toBeNull();
    rerender(<Mascota personaje="pausa" estado="leyendo" mensaje="Aprende a tu ritmo." siOculta="mensaje" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('Aprende a tu ritmo.')).toBeTruthy();
    // Los estados vacíos vuelven a su ilustración.
    rerender(<EstadoVacio mascota="dormido" ilustracion="libro" titulo="Sin lecciones" />);
    expect(container.querySelector('.pausa')).toBeNull();
    expect(container.querySelector('.ilustracion')).toBeTruthy();
  });

  it('con movimiento reducido no anima: termina al instante sin mover partes', () => {
    document.documentElement.setAttribute('data-movimiento', 'reducido');
    const terminar = vi.fn();
    const { container } = render(<Orbi estado="celebrando" animacion={1} alTerminar={terminar} />);
    expect(terminar).toHaveBeenCalledTimes(1);
    for (const parte of container.querySelectorAll('[data-parte]')) expect(parte.getAttribute('style') || '').not.toMatch(/transform/);
  });

  it('Pausa da la bienvenida solo a partir del umbral de días sin actividad', () => {
    const curso = { id: 4, title: 'Matemática' };
    const ayer = '2026-11-20T15:00:00.000Z';
    const { container, rerender } = render(<MemoryRouter><BienvenidaRegreso actividad={{ lastActivityAt: ayer, daysAway: UMBRAL_DIAS_REGRESO - 1 }} curso={curso} /></MemoryRouter>);
    expect(container.textContent).toBe('');
    // Sin actividad previa no hay «regreso».
    rerender(<MemoryRouter><BienvenidaRegreso actividad={{ lastActivityAt: null, daysAway: null }} curso={curso} /></MemoryRouter>);
    expect(container.textContent).toBe('');
    rerender(<MemoryRouter><BienvenidaRegreso actividad={{ lastActivityAt: ayer, daysAway: UMBRAL_DIAS_REGRESO }} curso={curso} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: MENSAJE_REGRESO })).toBeTruthy();
    expect(container.querySelector('.pausa').getAttribute('data-estado')).toBe('bienvenida');
    expect(screen.getByRole('link', { name: 'Seguir en Matemática' }).getAttribute('href')).toBe('/estudiante/cursos/4?seccion=trabajo&ver=lecciones');
    // Al cerrarla no vuelve a salir en esta pestaña para la misma ausencia.
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('heading', { name: MENSAJE_REGRESO })).toBeNull();
  });

  it('los mensajes usan datos reales del rango, sin culpa ni urgencias', () => {
    const base = { total: 10, assignments: { total: 0 }, next: { name: 'Luz', remaining: 2 } };
    expect(mensajeRango(base)).toBe('Te faltan 2 lecciones para Luz.');
    expect(mensajeRango({ ...base, next: { name: 'Brillo', remaining: 1 } })).toBe('Te falta 1 lección para Brillo.');
    expect(mensajeRango({ ...base, assignments: { total: 2 } })).toBe('Te faltan 2 lecciones o tareas para Luz.');
    expect(mensajeRango({ ...base, next: null })).toBe('¡Recorrido completo! Llegaste a Constelación.');
    expect(mensajeRango({ total: 0 })).toMatch(/Cuando tu docente publique lecciones/);
    // Ningún texto regaña ni amenaza: se revisan todos los mensajes centralizados.
    const textos = Object.values(mensajes).flatMap((valor) => {
      if (typeof valor === 'string') return [valor];
      if (typeof valor === 'function') return [valor(3, 5), valor(base)].filter((texto) => typeof texto === 'string');
      if (valor && typeof valor === 'object') return Object.values(valor).map((item) => (typeof item === 'function' ? item(3, 5) : item));
      return [];
    });
    expect(textos.length).toBeGreaterThan(12);
    for (const texto of textos) expect(texto).not.toMatch(/perder|pierdes|apúrate|última oportunidad|deberías|rápido/i);
  });
});
