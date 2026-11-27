import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecorridoGuiado from '../src/Componentes/RecorridoGuiado.jsx';

vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => ({ usuario: null, preferencias: {} }) }));
afterEach(cleanup);

const PASOS = [
  { objetivo: '#uno', titulo: 'Primero', texto: 'Explica la primera función.' },
  { objetivo: '#no-existe', titulo: 'Fantasma', texto: 'Este paso no tiene elemento.' },
  { seccion: 'otra', objetivo: '#dos', titulo: 'Segundo', texto: 'Explica la segunda función.' },
];

function Pagina({ alCerrar = vi.fn(), alPrepararPaso = vi.fn() }) {
  return (
    <>
      <div id="uno">Función uno</div>
      <div id="dos">Función dos</div>
      <RecorridoGuiado pasos={PASOS} abierto alCerrar={alCerrar} alPrepararPaso={alPrepararPaso} />
    </>
  );
}

describe('Recorrido guiado', () => {
  it('muestra cada paso como diálogo con su progreso, salta los que no existen y prepara la sección', async () => {
    const alPrepararPaso = vi.fn();
    render(<Pagina alPrepararPaso={alPrepararPaso} />);
    expect(await screen.findByRole('dialog', { name: 'Primero' })).toBeTruthy();
    expect(screen.getByText('Paso 1 de 3')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); });
    // El paso sin elemento desaparece y el total se ajusta.
    expect(await screen.findByRole('dialog', { name: 'Segundo' }, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Paso 2 de 2')).toBeTruthy();
    expect(alPrepararPaso).toHaveBeenCalledWith(PASOS[2]);
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByRole('dialog', { name: 'Primero' })).toBeTruthy();
  });

  it('Escape y «Saltar recorrido» lo cierran', async () => {
    const alCerrar = vi.fn();
    render(<Pagina alCerrar={alCerrar} />);
    await screen.findByRole('dialog', { name: 'Primero' });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Saltar recorrido' }));
    expect(alCerrar).toHaveBeenCalledTimes(2);
  });
});
