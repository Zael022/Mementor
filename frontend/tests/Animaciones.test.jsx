import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AnilloPuntaje, Contador, Revelar } from '../src/Componentes/Animaciones.jsx';
import { gsap } from '../src/utils/gsap.js';

// Simula la preferencia del sistema operativo de reducir el movimiento.
function movimientoReducido(activo) {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: activo && consulta.includes('reduce'), media: consulta, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  }));
}

// Lleva al final todas las animaciones pendientes, como si hubiera pasado el tiempo.
function terminarAnimaciones() {
  gsap.globalTimeline.getChildren(true, true, false).forEach((animacion) => animacion.progress(1));
}

const animacionesActivas = () => gsap.globalTimeline.getChildren(true, true, false).length;
const visible = (contenedor) => contenedor.querySelector('[aria-hidden="true"]').textContent;
const desplazamiento = (contenedor) => Number(contenedor.querySelector('.avance').getAttribute('stroke-dashoffset'));
const LARGO = 2 * Math.PI * 54;

beforeEach(() => {
  document.documentElement.removeAttribute('data-movimiento');
  gsap.globalTimeline.clear();
});

afterEach(() => cleanup());

describe('Animaciones con GSAP', () => {
  it('el contador llega a su valor final y el lector de pantalla recibe solo ese valor', () => {
    movimientoReducido(false);
    const { container } = render(<Contador valor={42} sufijo=" %" />);
    expect(screen.getByText('42 %', { selector: '.solo-lector' })).toBeTruthy();
    expect(visible(container)).toBe('0 %');
    terminarAnimaciones();
    expect(visible(container)).toBe('42 %');
  });

  it('el anillo termina en el avance correcto', () => {
    movimientoReducido(false);
    const { container } = render(<AnilloPuntaje porcentaje={75} aprobado />);
    terminarAnimaciones();
    expect(desplazamiento(container)).toBeCloseTo(LARGO * 0.25, 1);
    expect(screen.getByRole('img', { name: 'Puntaje 75 por ciento' })).toBeTruthy();
  });

  it('con movimiento reducido en el sistema todo aparece de inmediato', () => {
    movimientoReducido(true);
    const { container } = render(<><Contador valor={8.5} decimales={1} /><AnilloPuntaje porcentaje={40} /><Revelar><p>Contenido</p></Revelar></>);
    expect(animacionesActivas()).toBe(0);
    expect(visible(container)).toBe('8.5');
    expect(desplazamiento(container)).toBeCloseTo(LARGO * 0.6, 1);
    expect(screen.getByText('Contenido')).toBeTruthy();
  });

  it('con «Menos movimiento» elegido en Configuración todo aparece de inmediato', () => {
    movimientoReducido(false);
    document.documentElement.setAttribute('data-movimiento', 'reducido');
    const { container } = render(<><Contador valor={3} /><AnilloPuntaje porcentaje={100} /></>);
    expect(animacionesActivas()).toBe(0);
    expect(visible(container)).toBe('3');
    expect(desplazamiento(container)).toBeCloseTo(0, 1);
  });
});
