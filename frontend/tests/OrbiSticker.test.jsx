import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrbiSticker, { ANIMACIONES_STICKER } from '../src/Componentes/OrbiSticker.jsx';
import { RangoConSticker } from '../src/Componentes/RangoAvance.jsx';
import { gsap } from '../src/utils/gsap.js';

// Sticker de papel: cada animación termina y avisa, movimiento reducido, identificadores únicos y despegue con foco.
const sesion = { preferencias: { showMascots: true } };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));
beforeEach(() => { document.documentElement.removeAttribute('data-movimiento'); sesion.preferencias = { showMascots: true }; });
afterEach(cleanup);

// Lleva al final una animación devuelta por el sticker (sin esperar tiempo real).
const completar = (linea) => act(() => { linea?.progress(1); });

describe('OrbiSticker', () => {
  it('cada animación se ejecuta y avisa con onTerminar', () => {
    const ref = createRef();
    const terminar = vi.fn();
    render(<OrbiSticker ref={ref} onTerminar={terminar} />);
    const orden = ['pegar', 'despegar', 'soltar', 'doblar', 'desdoblar', 'arrugar', 'alisar', 'saltar', 'volar'];
    expect([...orden].sort()).toEqual([...ANIMACIONES_STICKER].sort());
    for (const nombre of orden) {
      completar(ref.current[nombre]());
      expect(terminar).toHaveBeenLastCalledWith(nombre);
    }
    expect(terminar).toHaveBeenCalledTimes(orden.length);
  });

  it('ninguna animación dura más de 1 segundo', () => {
    const ref = createRef();
    render(<OrbiSticker ref={ref} />);
    for (const nombre of ['pegar', 'despegar', 'soltar', 'doblar', 'desdoblar', 'arrugar', 'alisar', 'saltar', 'volar']) {
      const linea = ref.current[nombre]();
      expect(linea.duration(), nombre).toBeLessThanOrEqual(1);
      completar(linea);
    }
  });

  it('el filtro de arrugado existe solo mientras dura la animación', () => {
    const ref = createRef();
    const { container } = render(<OrbiSticker ref={ref} />);
    const contenido = container.querySelector('[data-sticker="contenido"]:not(.sticker-mitad *)') || container.querySelectorAll('[data-sticker="contenido"]')[1];
    expect(contenido.getAttribute('filter')).toBe('none');
    const arruga = ref.current.arrugar();
    expect(contenido.getAttribute('filter')).toMatch(/^url\(#/);
    completar(arruga);
    completar(ref.current.alisar());
    expect(contenido.getAttribute('filter')).toBe('none');
  });

  it('con movimiento reducido no hay pliegues ni giros: cambia directo y avisa', () => {
    document.documentElement.setAttribute('data-movimiento', 'reducido');
    const ref = createRef();
    const terminar = vi.fn();
    const { container } = render(<OrbiSticker ref={ref} onTerminar={terminar} />);
    expect(ref.current.doblar()).toBeNull();
    expect(terminar).toHaveBeenLastCalledWith('doblar');
    expect(ref.current.arrugar()).toBeNull();
    expect(terminar).toHaveBeenLastCalledWith('arrugar');
    for (const grupo of container.querySelectorAll('[data-sticker="contenido"]')) expect(grupo.getAttribute('filter')).toBe('none');
    expect(ref.current.despegar()).toBeNull();
    // Pegar y volar quedan como un fundido corto.
    expect(ref.current.pegar().duration()).toBeLessThanOrEqual(0.2);
    expect(ref.current.volar().duration()).toBeLessThanOrEqual(0.2);
  });

  it('dos stickers en la misma pantalla no repiten identificadores y el dibujo es decorativo', () => {
    const { container } = render(<><OrbiSticker /><OrbiSticker /></>);
    const ids = [...container.querySelectorAll('[id]')].map((nodo) => nodo.id);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    // Toda referencia url(#…) apunta a un id del mismo sticker.
    for (const sticker of container.querySelectorAll('.sticker')) {
      const propios = new Set([...sticker.querySelectorAll('[id]')].map((nodo) => nodo.id));
      const usados = [...sticker.innerHTML.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      for (const id of usados) expect(propios.has(id), id).toBe(true);
      expect(sticker.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('la insignia del rango despega la esquina con el foco del teclado y la vuelve a pegar al salir', () => {
    const rango = {
      key: 'luz', name: 'Luz', level: 3, percent: 50, done: 3, total: 6,
      lessons: { done: 3, total: 6 }, assignments: { done: 0, total: 0 }, next: { name: 'Estrella', remaining: 2 },
    };
    const { container } = render(<RangoConSticker rango={rango} alVerMapa={() => {}} />);
    const solapas = () => [...container.querySelectorAll('[data-sticker="solapa"]')].map((nodo) => nodo.getAttribute('opacity'));
    expect(solapas().every((valor) => valor === '0')).toBe(true);
    fireEvent.focus(screen.getByRole('link', { name: 'Ver el mapa' }));
    act(() => { gsap.globalTimeline.getChildren(true, true, false).forEach((linea) => linea.progress(1)); });
    expect(solapas()).toContain('1');
    fireEvent.blur(screen.getByRole('link', { name: 'Ver el mapa' }));
    act(() => { gsap.globalTimeline.getChildren(true, true, false).forEach((linea) => linea.progress(1)); });
    expect(solapas().every((valor) => valor === '0')).toBe(true);
  });
});
