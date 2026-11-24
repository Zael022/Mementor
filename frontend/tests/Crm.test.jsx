import { fireEvent, render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEnvio } from '../src/hooks/useEnvio.js';
import Campo from '../src/Componentes/Campo.jsx';
import { CrmNav } from '../src/Componentes/Crm/Comun.jsx';
import Borradores from '../src/Componentes/Crm/Borradores.jsx';
import CrmCandidatos from '../src/Pages/CrmCandidatos.jsx';
import { api } from '../src/services/api.js';

vi.mock('../src/services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const session = { usuario: { id: 1, role: 'institution_admin' } };
vi.mock('../src/context/SesionContext.jsx', () => ({ useSesion: () => session }));
beforeEach(() => { vi.clearAllMocks(); session.usuario = { id: 1, role: 'institution_admin' }; api.get.mockResolvedValue({ data: [], meta: { page: 1, totalPages: 1 } }); });
afterEach(cleanup);

it('el envío compartido impide dobles clics mientras hay una operación en curso', async () => {
  let finish; const action = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  function Probe() { const send = useEnvio(); return <button onClick={() => send.ejecutar(action)}>Enviar</button>; }
  render(<Probe />); fireEvent.click(screen.getByText('Enviar')); fireEvent.click(screen.getByText('Enviar')); expect(action).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ data: true }); }); fireEvent.click(screen.getByText('Enviar')); expect(action).toHaveBeenCalledTimes(2); await act(async () => { finish({ data: true }); });
});

it('los errores de campo están conectados con su control', () => {
  render(<Campo etiqueta="Contacto" valor="" alCambiar={() => {}} error="Indica un contacto válido" />);
  const input = screen.getByLabelText('Contacto'); expect(input.getAttribute('aria-invalid')).toBe('true'); expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toContain('válido');
});

it('la navegación limita edición y contactos según el rol', () => {
  session.usuario.role = 'auditor'; const view = render(<MemoryRouter><CrmNav /></MemoryRouter>); expect(screen.getByText('Embudo')).toBeTruthy(); expect(screen.queryByText('Candidatos')).toBeNull();
  session.usuario.role = 'teacher'; view.rerender(<MemoryRouter><CrmNav /></MemoryRouter>); expect(screen.getByText('Mis solicitudes')).toBeTruthy(); expect(screen.queryByText('Convocatorias')).toBeNull();
});

it('lista y tablero ofrecen abrir ficha sin arrastre y manejan estados vacíos', async () => {
  api.get.mockImplementation(async (url) => ({ data: url.startsWith('/crm/solicitudes') ? [{ id: 3, stage: 'prospecto', status: 'activo', prospect: { name: 'Persona temporal' }, cycle: { name: 'Convocatoria temporal', campus: 'Sede temporal' } }] : [] }));
  render(<MemoryRouter><CrmCandidatos /></MemoryRouter>); expect(await screen.findByText('Persona temporal')).toBeTruthy(); expect(screen.getByText('Abrir ficha / Mover a').getAttribute('href')).toBe('/admisiones/solicitudes/3');
  fireEvent.click(screen.getByText('Ver tablero')); expect(screen.getByLabelText('Columna del tablero')).toBeTruthy(); expect(screen.getByText('Ver lista accesible')).toBeTruthy();
});

it('un borrador editado exige guardar antes de aprobar y conserva el texto si falla', async () => {
  const application = { id: 2, prospectId: 1, drafts: [{ id: 4, text: 'Texto original pendiente de revisión.', channel: 'correo', status: 'pending', recipient: 'temporal@prueba.test', source: 'manual', version: 1 }] };
  api.patch.mockRejectedValue(new Error('La ficha cambió. Actualiza antes de guardar.'));
  const view = render(<Borradores application={application} reload={() => {}} />);
  fireEvent.change(screen.getByLabelText('Texto del borrador'), { target: { value: 'Texto editado conservado después del error.' } });
  expect(screen.getByText('Aprobar esta versión').disabled).toBe(true);
  fireEvent.click(screen.getByText('Guardar edición e invalidar aprobación')); await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('La ficha cambió'));
  expect(screen.getByLabelText('Texto del borrador').value).toContain('Texto editado conservado');
  view.rerender(<Borradores application={{ ...application, drafts: [{ ...application.drafts[0], version: 2, text: 'Otra edición guardada concurrentemente.' }] }} reload={() => {}} />);
  expect(screen.getByLabelText('Texto del borrador').value).toContain('Texto editado conservado');
});
