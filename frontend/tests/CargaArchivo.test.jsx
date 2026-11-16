import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../src/services/api.js';
import { GestorMateriales } from '../src/Componentes/Materiales.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), upload: vi.fn() },
}));
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => ({ usuario: { role: 'teacher' } }) }));

window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
const pintar = () => render(<MemoryRouter><GestorMateriales cursoId={4} /></MemoryRouter>);
const entrada = () => screen.getByLabelText('Archivo para subir');
const elegir = (archivo) => fireEvent.change(entrada(), { target: { files: [archivo] } });
const guia = () => new File(['Guía de estudio'], 'guia.txt', { type: 'text/plain' });

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
});
afterEach(cleanup);

describe('Carga de materiales', () => {
  it('rechaza un formato no permitido y un archivo de más de 10 MB sin llamar a la API', async () => {
    pintar();
    elegir(new File(['<script></script>'], 'pagina.html', { type: 'text/html' }));
    expect(await screen.findByText(/Formato no permitido/)).toBeTruthy();
    const grande = guia();
    Object.defineProperty(grande, 'size', { value: 11 * 1024 * 1024 });
    elegir(grande);
    expect(await screen.findByText(/supera 10 MB/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Subir archivo' }).disabled).toBe(true);
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('muestra nombre y tamaño y hace una sola petición aunque se pulse dos veces', async () => {
    let terminar;
    api.upload.mockImplementation(() => new Promise((resolve) => { terminar = resolve; }));
    pintar();
    elegir(guia());
    expect(await screen.findByText('guia.txt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar archivo' })).toBeTruthy();
    const subir = screen.getByRole('button', { name: 'Subir archivo' });
    fireEvent.click(subir);
    fireEvent.click(subir);
    expect(await screen.findByRole('button', { name: 'Subiendo…' })).toBeTruthy();
    terminar({ data: { id: 9, title: 'guia.txt', knowledge: { state: 'ready' } } });
    expect(await screen.findByText(/se subió/)).toBeTruthy();
    expect(api.upload).toHaveBeenCalledTimes(1);
    const datos = api.upload.mock.calls[0][1];
    expect(datos.get('file').name).toBe('guia.txt');
    // La lista se recarga al recibir éxito.
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('un fallo muestra el mensaje del servidor y permite reintentar con el mismo archivo', async () => {
    api.upload
      .mockRejectedValueOnce(new ApiError(409, 'DOCUMENT_LIMIT', 'La institución alcanzó su tope de documentos.'))
      .mockResolvedValueOnce({ data: { id: 10, title: 'guia.txt' } });
    pintar();
    elegir(guia());
    await screen.findByText('guia.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' }));
    expect(await screen.findByText('La institución alcanzó su tope de documentos.')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar subida' }));
    expect(await screen.findByText(/se subió/)).toBeTruthy();
    expect(api.upload).toHaveBeenCalledTimes(2);
  });
});
