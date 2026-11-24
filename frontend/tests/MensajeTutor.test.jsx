import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MensajeTutor from '../src/Componentes/MensajeTutor.jsx';

window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
const cita = (position, title) => ({ position, title, available: true, page: position === 1 ? 3 : null, heading: null });
const mensaje = (citations, extra = {}) => ({ id: 77, role: 'assistant', kind: 'answer', content: 'Respuesta [S1].', citations, ...extra });
const pintar = (datos) => render(<MemoryRouter><MensajeTutor mensaje={datos} esEstudiante /></MemoryRouter>);

afterEach(() => cleanup());

describe('Citas del tutor con Motion', () => {
  it('con tres citas muestra la primera y un botón accesible para las otras dos', () => {
    pintar(mensaje([cita(1, 'Reglamento'), cita(2, 'Calendario'), cita(3, 'Normas')]));
    expect(screen.getByRole('link', { name: 'Reglamento' }).getAttribute('href')).toBe('/estudiante/citas/77/1');
    const boton = screen.getByRole('button', { name: 'Ver 2 fuentes más' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    const lista = document.getElementById(boton.getAttribute('aria-controls'));
    expect(lista).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Calendario' })).toBeNull();
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Calendario' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Normas' })).toBeTruthy();
  });

  it('con una cita muestra el enlace directamente, sin botón', () => {
    pintar(mensaje([cita(1, 'Reglamento')]));
    expect(screen.getByRole('link', { name: 'Reglamento' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('con cero citas conserva el aviso que corresponde', () => {
    pintar(mensaje([], { kind: 'notice', content: 'El material publicado de este curso no cubre esta pregunta.' }));
    expect(screen.getByText(/no cubre esta pregunta/)).toBeTruthy();
    expect(screen.queryByText(/Fuente/)).toBeNull();
  });

  it('mientras se escribe no muestra texto ni citas; aparecen juntos al validarse', () => {
    const { rerender } = pintar(mensaje([], { estado: 'escribiendo', content: 'Dos más dos son nueve [S1]', progreso: 26 }));
    expect(screen.getByText(/revisando las fuentes/)).toBeTruthy();
    expect(screen.queryByText(/nueve/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    rerender(<MemoryRouter><MensajeTutor mensaje={mensaje([cita(1, 'Reglamento')], { content: 'Una fracción es [S1]', estado: 'final' })} esEstudiante /></MemoryRouter>);
    expect(screen.getByText(/Una fracción es/)).toBeTruthy();
    expect(document.querySelector('.marca-cita').textContent).toBe('1');
    expect(screen.getByRole('link', { name: 'Reglamento' })).toBeTruthy();
  });

  it('una fuente retirada no ofrece enlace', () => {
    pintar(mensaje([{ ...cita(1, 'Reglamento'), available: false }]));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/fuente retirada/)).toBeTruthy();
  });
});
