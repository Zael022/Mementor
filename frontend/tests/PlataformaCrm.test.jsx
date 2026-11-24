import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import PlataformaCrm from '../src/Pages/PlataformaCrm.jsx';
import { api } from '../src/services/api.js';

vi.mock('../src/services/api.js', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('lista una institución sin crear seguimiento al consultarla', async () => {
  api.get.mockResolvedValue({ data: [{ id: 1, name: 'Institución temporal', status: 'active', account: null }], meta: { totalPages: 1 } });
  render(<MemoryRouter><PlataformaCrm /></MemoryRouter>);
  expect(await screen.findByText('Institución temporal')).toBeTruthy();
  expect(screen.getByText(/Sin seguimiento configurado/)).toBeTruthy();
  expect(screen.getByText('Abrir ficha').getAttribute('href')).toBe('/plataforma/crm-instituciones/1');
  expect(api.post).not.toHaveBeenCalled();
});

it('permite configurar explícitamente una ficha', async () => {
  api.get.mockResolvedValue({ data: { id: 1, name: 'Institución temporal', status: 'active', account: null } });
  api.post.mockResolvedValue({ data: { id: 1 } });
  render(<MemoryRouter initialEntries={['/plataforma/crm-instituciones/1']}><Routes><Route path="/plataforma/crm-instituciones/:id" element={<PlataformaCrm />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByText('Configurar seguimiento'));
  expect(api.post).toHaveBeenCalledWith('/platform-crm/institutions/1/account');
});
