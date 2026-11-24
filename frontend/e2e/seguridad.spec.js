import { expect, test } from '@playwright/test';
import { entrar, prepararCurso, sesion } from './support/datos.mjs';

// Asignación de seguridad: los ataques llegan por la interfaz real y fallan.
// Con EVIDENCIAS=1 guarda capturas en docs/seguridad/evidencias para la presentación.
const evidencia = async (page, nombre) => {
  if (process.env.EVIDENCIAS === '1') await page.screenshot({ path: `../docs/seguridad/evidencias/${nombre}.png` });
};

test.describe('Seguridad web en la interfaz', () => {
  let curso;
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => { curso = await prepararCurso(`seguridad-${testInfo.project.name}`); });

  test('la búsqueda de Usuarios trata una inyección SQL como texto', async ({ page }) => {
    await entrar(page, curso.admin);
    await page.goto('/admin/usuarios');
    const buscador = page.getByLabel('Buscar por nombre o correo');
    await buscador.fill('Estudiante');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await buscador.fill("' OR 1=1 -- ");
    await expect(page.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);
    await evidencia(page, '06-mentor-busqueda-inyeccion');
  });

  test('un anuncio con etiquetas HTML se muestra como texto y no ejecuta código', async ({ page }) => {
    const docente = await sesion(curso.docente);
    await docente.post(`/courses/${curso.cursoId}/announcements`, {
      title: 'Prueba XSS', body: '<img src=x onerror="window.atacado=1"><script>window.atacado=1</script>',
    });
    await entrar(page, curso.estudiante);
    await page.goto(`/estudiante/cursos/${curso.cursoId}`);
    const anuncio = page.locator('#contenido').getByText('<img src=x onerror="window.atacado=1">', { exact: false }).first();
    await expect(anuncio).toBeVisible();
    expect(await page.evaluate(() => window.atacado)).toBeUndefined();
    await expect(page.locator('#contenido img[src="x"]')).toHaveCount(0);
    await evidencia(page, '07-mentor-anuncio-xss');
  });
});
