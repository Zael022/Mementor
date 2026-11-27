import { expect, test } from '@playwright/test';
import { entrar, prepararCurso } from './support/datos.mjs';

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

test.describe('Navegación dentro de la plataforma', () => {
  let curso;
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}) => { curso = await prepararCurso('Navegacion'); });

  test('una dirección inexistente muestra «no encontrada» con el menú y el título de la pestaña cambia por sección', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await expect(page).toHaveTitle('Inicio · MENTOR IA');
    await page.goto('/estudiante/no-existe');
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    await page.getByRole('link', { name: 'Calendario' }).click();
    await expect(page).toHaveTitle('Calendario · MENTOR IA');
    await expect(page.locator('#contenido')).toBeFocused();
  });
});
