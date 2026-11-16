import { expect, test } from '@playwright/test';
import { entrar, llamadasAlModelo, prepararCurso } from './support/datos.mjs';

test.describe('Tutor con fuentes @movil', () => {
  let curso;
  // Playwright exige desestructurar el primer argumento aunque no se use.
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => { curso = await prepararCurso(`tutor-${testInfo.project.name}`); });

  test('responde en vivo, valida las citas al final y las muestra con teclado', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await page.goto(`/estudiante/tutor/${curso.cursoId}`);
    await page.getByLabel('Tu pregunta').fill('¿Qué son las fracciones equivalentes y qué indica el denominador?');
    await page.getByLabel('Tu pregunta').press('Control+Enter');
    // Mientras escribe, el borrador no tiene citas.
    const borrador = page.locator('.burbuja.en-curso');
    await expect(borrador).toBeVisible();
    await expect(borrador.locator('.citas')).toHaveCount(0);
    await expect(borrador).toBeHidden({ timeout: 20000 });
    const respuesta = page.locator('.burbuja.tutor').last();
    await expect(respuesta.locator('.citas a').first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Respuesta lista' })).toHaveCount(1);
    // El botón cambia de nombre al abrirse («Ocultar fuentes»), así que se ubica por su clase.
    const masFuentes = respuesta.locator('.citas .boton-texto');
    await expect(masFuentes).toHaveText(/Ver \d fuentes? más/);
    await expect(masFuentes).toHaveAttribute('aria-expanded', 'false');
    await masFuentes.focus();
    await page.keyboard.press('Enter');
    await expect(masFuentes).toHaveAttribute('aria-expanded', 'true');
    await expect(masFuentes).toHaveText('Ocultar fuentes');
    // El id generado por React puede tener caracteres especiales: se busca por atributo.
    expect(await page.locator(`[id="${await masFuentes.getAttribute('aria-controls')}"]`).count()).toBe(1);
    // La cita abre el pasaje dentro de MENTOR.
    await respuesta.locator('.citas a').first().click();
    await expect(page.locator('blockquote.pasaje')).toBeVisible();
  });

  test('sin respaldo en el curso muestra el aviso y no llama al modelo', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await page.goto(`/estudiante/tutor/${curso.cursoId}`);
    await page.getByRole('button', { name: 'Nueva conversación' }).click();
    const antes = await llamadasAlModelo();
    await page.getByLabel('Tu pregunta').fill('¿Qué es la tectónica volcánica?');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.burbuja.tutor').last()).toContainText('no cubre esta pregunta');
    expect(await llamadasAlModelo()).toBe(antes);
  });

  test('«Detener» corta la respuesta y la marca como interrumpida', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await page.goto(`/estudiante/tutor/${curso.cursoId}`);
    await page.getByLabel('Tu pregunta').fill('¿Qué indica el denominador de una fracción?');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.burbuja.en-curso')).toBeVisible();
    await page.getByRole('button', { name: 'Detener' }).click();
    await expect(page.locator('.burbuja.tutor').last()).toContainText('Respuesta interrumpida');
    await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
  });
});
