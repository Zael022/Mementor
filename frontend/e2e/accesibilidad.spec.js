import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Revisión automática con axe-core (WCAG 2.2 A y AA) de las pantallas públicas en tres anchos.
// No reemplaza la prueba con lectores de pantalla; detecta contraste, nombres accesibles y tamaño de objetivos.
const ANCHOS = [[390, 844], [768, 1024], [1280, 900]];
const PANTALLAS = [['/login', 'inicio de sesión'], ['/recuperar', 'recuperar contraseña']];

test.describe('Accesibilidad automática @movil', () => {
  for (const [ancho, alto] of ANCHOS) {
    for (const [ruta, nombre] of PANTALLAS) {
      test(`${nombre} sin infracciones WCAG 2.2 AA en ${ancho}×${alto}`, async ({ page }) => {
        await page.setViewportSize({ width: ancho, height: alto });
        // Sin animaciones de entrada: el contraste se mide en el estado final, no a mitad de un fundido.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(ruta);
        await expect(page.getByRole('heading').first()).toBeVisible();
        const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        const resumen = resultado.violations.map((item) => `${item.id}: ${item.nodes.map((nodo) => nodo.target.join(' ')).join(', ')}`);
        expect(resumen).toEqual([]);
      });
    }
  }
});
