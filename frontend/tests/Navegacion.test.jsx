import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LimiteErrores from '../src/Componentes/LimiteErrores.jsx';
import Layout from '../src/Componentes/Layout.jsx';
import NoEncontrada from '../src/Pages/NoEncontrada.jsx';
import { tituloDe } from '../src/utils/titulos.js';

vi.mock('../src/context/SesionContext.jsx', () => ({
  useSesion: () => ({ usuario: { role: 'student', displayName: 'Ana' }, cerrarSesion: vi.fn() }),
}));

afterEach(cleanup);

function Rompe({ error }) {
  throw error;
}

function IrA({ destino }) {
  const navegar = useNavigate();
  return <button type="button" onClick={() => navegar(destino)}>ir</button>;
}

describe('navegación y errores', () => {
  it('muestra un aviso con «Recargar» en lugar de una pantalla en blanco', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LimiteErrores><Rompe error={new Error('boom')} /></LimiteErrores>);
    expect(screen.getByRole('alert').textContent).toContain('Esta página no se pudo mostrar');
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy();
  });

  it('reconoce cuando falla la descarga de una página tras publicar una versión nueva', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LimiteErrores><Rompe error={new TypeError('Failed to fetch dynamically imported module: /assets/x.js')} /></LimiteErrores>);
    expect(screen.getByRole('alert').textContent).toContain('Hay una versión nueva');
  });

  it('pone un título de pestaña por sección', () => {
    expect(tituloDe('/estudiante/tutor/4')).toBe('Tutor · MENTOR AI');
    expect(tituloDe('/docente/cursos/3/fuentes')).toBe('Fuentes del tutor · MENTOR AI');
    expect(tituloDe('/docente/cursos')).toBe('Cursos · MENTOR AI');
    expect(tituloDe('/desconocida')).toBe('MENTOR AI');
  });

  it('una dirección inexistente muestra la página de «no encontrada» y al navegar mueve el foco al contenido', () => {
    render(
      <MemoryRouter initialEntries={['/estudiante/progreso']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/estudiante/progreso" element={<IrA destino="/no-existe" />} />
            <Route path="*" element={<NoEncontrada />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(document.title).toBe('Mi progreso · MENTOR AI');
    expect(document.activeElement.id).not.toBe('contenido');

    fireEvent.click(screen.getByRole('button', { name: 'ir' }));
    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
    expect(document.activeElement.id).toBe('contenido');
    expect(document.title).toBe('MENTOR AI');
  });
});
