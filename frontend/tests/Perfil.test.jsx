import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';
import { CambiarContrasena, DatosPersonales, FotoPerfil } from '../src/Componentes/EditorPerfil.jsx';

vi.mock('../src/services/api.js', async (importOriginal) => ({
  ...await importOriginal(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn() },
}));
const sesion = { usuario: null, actualizarUsuario: vi.fn() };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => sesion }));

const archivo = (nombre, tipo, bytes = 10) => new File([new Uint8Array(bytes)], nombre, { type: tipo });

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario = { displayName: 'Ana', email: 'ana@ejemplo.test', role: 'student', avatarUrl: null };
});
afterEach(cleanup);

describe('Foto de perfil', () => {
  it('rechaza SVG y archivos de más de 2 MB sin llamar a la API', async () => {
    render(<FotoPerfil />);
    const entrada = screen.getByLabelText('Subir foto');
    fireEvent.change(entrada, { target: { files: [archivo('dibujo.svg', 'image/svg+xml')] } });
    expect(await screen.findByText('Elige una imagen PNG, JPG o WebP.')).toBeTruthy();
    fireEvent.change(entrada, { target: { files: [archivo('grande.png', 'image/png', 2 * 1024 * 1024 + 1)] } });
    expect(await screen.findByText('La imagen supera los 2 MB.')).toBeTruthy();
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('sube una imagen válida y actualiza la foto de la sesión', async () => {
    api.upload.mockResolvedValue({ data: { avatarUrl: '/api/v1/users/1/avatar?v=1' } });
    render(<FotoPerfil />);
    fireEvent.change(screen.getByLabelText('Subir foto'), { target: { files: [archivo('yo.png', 'image/png')] } });
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith('/me/avatar', expect.any(FormData)));
    expect(sesion.actualizarUsuario).toHaveBeenCalledWith({ avatarUrl: '/api/v1/users/1/avatar?v=1' });
  });
});

describe('Datos personales', () => {
  it('carga los datos y guarda los cambios', async () => {
    api.get.mockResolvedValue({ data: { displayName: 'Ana', firstName: null, lastName: null, phone: null, bio: null } });
    api.patch.mockResolvedValue({ data: { displayName: 'Ana R.' } });
    render(<DatosPersonales />);
    fireEvent.change(await screen.findByLabelText('Apellidos'), { target: { value: 'Rojas' } });
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: 'Ana R.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me/profile', expect.objectContaining({ lastName: 'Rojas', displayName: 'Ana R.' })));
    expect(sesion.actualizarUsuario).toHaveBeenCalledWith({ displayName: 'Ana R.' });
  });
});

describe('Contraseña', () => {
  it('no envía si las contraseñas nuevas no coinciden', () => {
    render(<CambiarContrasena />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'NuevaClave2026' } });
    fireEvent.change(screen.getByLabelText('Repite la nueva contraseña'), { target: { value: 'OtraClave2026' } });
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' }).disabled).toBe(true);
  });
});
