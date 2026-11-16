import { expect, test } from '@playwright/test';
import { entrar, prepararCurso } from './support/datos.mjs';

test('el botón «Entrar» aparece al abrirse la ventana de 15 minutos sin recargar', async ({ page }) => {
  // La clase empieza en 15 minutos y 6 segundos: la ventana se abre unos segundos después de cargar.
  const curso = await prepararCurso('clases', { claseEnMs: 15 * 60000 + 6000 });
  await entrar(page, curso.estudiante);
  await page.goto('/estudiante/inicio');
  await expect(page.getByRole('button', { name: 'Entrar a la clase' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Entrar a la clase' }).first()).toBeVisible({ timeout: 15000 });
});
