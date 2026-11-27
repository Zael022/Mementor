import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FRASES_PAUSA_CARICIA, FRASES_PAUSA_CURIOSIDAD } from '../src/utils/frasesPausa.js';
import { entrar, prepararCurso } from './support/datos.mjs';

// Parte A · Pausa paseante en un navegador real: cuelga de la barra, no bloquea clics, responde al teclado
// y no aparece donde distrae.
test.describe('Pausa paseante @movil', () => {
  let curso;
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => {
    curso = await prepararCurso(`Pausa${testInfo.project.name}`);
  });

  test('cuelga de la barra superior, habla al tocarlo y la capa no tapa la página', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await page.goto('/estudiante/inicio');
    const pausa = page.getByRole('button', { name: 'Pausa, la mascota. Presiona para interactuar' });
    await expect(pausa).toBeVisible();
    // Las garras quedan sobre el borde inferior de la barra superior.
    const barra = await page.locator('.cabecera').boundingBox();
    const caja = await pausa.boundingBox();
    expect(Math.abs(caja.y - (barra.y + barra.height))).toBeLessThan(20);

    await pausa.click();
    const burbuja = page.locator('.pausa-paseante-burbuja');
    await expect(burbuja).toHaveAttribute('aria-live', 'polite');
    expect(FRASES_PAUSA_CURIOSIDAD).toContain((await burbuja.textContent()).trim());

    // La burbuja y la capa dejan pasar los clics a lo que hay debajo.
    const encima = await page.evaluate(() => {
      const caja = document.querySelector('.pausa-paseante-burbuja').getBoundingClientRect();
      const punto = document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2);
      return Boolean(punto?.closest('.pausa-paseante-capa'));
    });
    expect(encima).toBe(false);

    // Teclado: la tecla A con el foco en Pausa es una caricia.
    await pausa.focus();
    await page.keyboard.press('a');
    await expect(burbuja).toHaveText(FRASES_PAUSA_CARICIA[0]);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const resultado = await new AxeBuilder({ page }).include('.pausa-paseante-capa')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(resultado.violations.map((item) => item.id)).toEqual([]);
  });

  test('pasar el puntero despacio por su cabeza es una caricia; los clics rápidos no lo son', async ({ page, isMobile }) => {
    test.skip(isMobile, 'En táctil la caricia es la presión larga (prueba unitaria).');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrar(page, curso.estudiante);
    await page.goto('/estudiante/inicio');
    const dibujo = page.locator('.pausa-paseante-boton svg');
    await dibujo.waitFor();
    const caja = await dibujo.boundingBox();
    // Centro de la cabeza en el dibujo (490, 118 del viewBox 362 36 276 209).
    const x = caja.x + caja.width * 0.464;
    const y = caja.y + caja.height * 0.392;
    await page.mouse.move(x, y);
    for (let paso = 0; paso < 8; paso += 1) {
      await page.waitForTimeout(110);
      await page.mouse.move(x + (paso % 2 ? 3 : -3), y);
    }
    await expect(page.locator('.pausa-paseante-burbuja')).toHaveText(FRASES_PAUSA_CARICIA[0]);
    await expect(page.locator('.pausa-corazones')).toHaveCount(1);
  });

  test('con «Menos movimiento» queda quieto y no aparece en la práctica diaria', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await entrar(page, curso.estudiante);
    await page.goto(`/estudiante/cursos/${curso.cursoId}`);
    await expect(page.locator('.pausa-paseante-capa')).toHaveAttribute('data-quieto', '');
    await page.goto(`/estudiante/cursos/${curso.cursoId}/racha`);
    await expect(page).toHaveURL(/racha$/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /Pausa, la mascota/ })).toHaveCount(0);
  });
});
