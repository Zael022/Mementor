import { expect, test } from '@playwright/test';
import { entrar, prepararCurso } from './support/datos.mjs';

test.describe('Carga de materiales', () => {
  let curso;
  test.beforeAll(async () => { curso = await prepararCurso('materiales'); });

  test('prepara el archivo, lo sube con una sola petición y muestra la indexación', async ({ page }) => {
    const subidas = [];
    page.on('request', (peticion) => { if (peticion.method() === 'POST' && peticion.url().endsWith('/materials/upload')) subidas.push(peticion); });
    await entrar(page, curso.docente);
    await page.goto(`/docente/cursos/${curso.cursoId}/anuncios`);
    const zona = page.locator('.carga').first();
    await zona.getByLabel('Archivo para subir').setInputFiles({ name: 'grande.txt', mimeType: 'text/plain', buffer: Buffer.alloc(11 * 1024 * 1024, 'a') });
    await expect(page.getByText(/supera 10 MB/)).toBeVisible();
    await zona.getByLabel('Archivo para subir').setInputFiles({
      name: 'reglamento.txt', mimeType: 'text/plain', buffer: Buffer.from('Reglamento.\n\nEl plazo para justificar ausencias es de tres días hábiles.'),
    });
    await expect(zona.locator('.carga-ficha')).toContainText('reglamento.txt');
    await page.getByRole('button', { name: 'Subir archivo' }).first().dblclick();
    await expect(page.locator('.aviso.exito')).toContainText('se subió');
    expect(subidas).toHaveLength(1);
    await expect(page.locator('.gestor-materiales').first()).toContainText('Listo');
  });

  test('un archivo renombrado se rechaza con el mensaje del servidor', async ({ page }) => {
    await entrar(page, curso.docente);
    await page.goto(`/docente/cursos/${curso.cursoId}/anuncios`);
    await page.locator('.carga').first().getByLabel('Archivo para subir').setInputFiles({
      name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>no soy un pdf</html>'),
    });
    await page.getByRole('button', { name: 'Subir archivo' }).first().click();
    await expect(page.getByText(/no corresponde a su formato/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar subida' })).toBeVisible();
  });
});
