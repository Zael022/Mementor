import { expect, test } from '@playwright/test';

test.describe('Portada de acceso @movil', () => {
  test('el formulario recibe foco y escritura de inmediato; la cuadrícula es solo decorativa', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo').fill('persona@e2e.test');
    await expect(page.getByLabel('Correo')).toHaveValue('persona@e2e.test');
    const decoracion = page.locator('.portada-cuadricula');
    await expect(decoracion).toHaveAttribute('aria-hidden', 'true');
    await expect(decoracion.locator('canvas')).toBeVisible();
    expect(await decoracion.evaluate((nodo) => getComputedStyle(nodo).pointerEvents)).toBe('none');
    // La página no se desborda en pantallas angostas.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
