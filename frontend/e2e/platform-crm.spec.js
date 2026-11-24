import { test, expect } from '@playwright/test';
import { sesion } from './support/datos.mjs';

test('plataforma configura una ficha y registra un contacto @movil', async ({ page }) => {
  const operator = await sesion('operador@e2e.test', 'OperadorE2E2026');
  await operator.post('/me/consents', { documents: ['terms', 'privacy'] });
  const name = `Institución temporal ${Date.now()}`;
  await operator.post('/institutions', { name });
  await page.goto('/login');
  await page.getByLabel('Correo').fill('operador@e2e.test');
  await page.getByLabel('Contraseña').fill('OperadorE2E2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  const consent = page.getByRole('dialog', { name: 'Antes de continuar' });
  if (await consent.isVisible()) {
    await consent.getByRole('checkbox').check();
    await consent.getByRole('button', { name: 'Aceptar y continuar' }).click();
  }
  const menu = page.getByRole('button', { name: 'Abrir menú' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Seguimiento institucional' }).click();
  const card = page.locator('article').filter({ hasText: name });
  await expect(card).toContainText('Sin seguimiento configurado');
  await card.getByRole('link', { name: 'Abrir ficha' }).click();
  await page.getByRole('button', { name: 'Configurar seguimiento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Contacto temporal');
  await page.getByLabel('Correo profesional').fill('contacto@e2e.test');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('Contacto temporal', { exact: false })).toBeVisible();
});
