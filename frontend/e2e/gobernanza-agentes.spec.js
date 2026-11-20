import { expect, test } from '@playwright/test';
import { entrar, prepararCurso, sesion } from './support/datos.mjs';

// Capturas opcionales para los mockups (CAPTURAS=/ruta/carpeta).
const capturar = async (page, nombre) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nombre}-${test.info().project.name}.png`, fullPage: true });
};

test.describe('Gobernanza y asistentes de IA @movil', () => {
  let curso;
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => {
    curso = await prepararCurso(`Gob${testInfo.project.name}`);
    const docente = await sesion(curso.docente);
    const modulo = await docente.post(`/courses/${curso.cursoId}/modules`, { title: 'Números' });
    const tema = await docente.post(`/modules/${modulo.id}/topics`, { title: 'Fracciones' });
    const leccion = await docente.post(`/topics/${tema.id}/lessons`, {
      title: 'Fracciones',
      bodyMd: 'Las fracciones representan partes de un entero. El numerador indica cuántas partes se toman y el denominador en cuántas partes iguales se divide. El denominador nunca puede ser cero.',
    });
    await docente.patch(`/lessons/${leccion.id}`, { status: 'published' });
  });

  test('los documentos legales son públicos', async ({ page }) => {
    await page.goto('/privacidad');
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.getByText(/Ley N.º 8968/).first()).toBeVisible();
    await capturar(page, '20-privacidad');
    await page.getByRole('link', { name: 'Términos y condiciones' }).click();
    await expect(page.getByRole('heading', { name: 'Términos y condiciones' })).toBeVisible();
    await capturar(page, '21-terminos');
    await page.goto('/recuperar');
    await capturar(page, '22-recuperar');
  });

  test('el docente usa el generador de preguntas y lo convierte en un quiz en borrador', async ({ page }) => {
    await entrar(page, curso.docente);
    await page.goto('/asistentes');
    await expect(page.getByRole('heading', { name: 'Generador de preguntas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coach de estudio' })).toHaveCount(0);
    await capturar(page, '23-asistentes-docente');
    await page.locator('.tarjeta-agente', { hasText: 'Generador de preguntas' }).getByRole('button', { name: 'Usar' }).click();
    await page.getByLabel('Curso').selectOption(String(curso.cursoId));
    await page.getByLabel('Tema o enfoque').fill('denominador de las fracciones');
    await page.getByRole('button', { name: 'Generar' }).click();
    await expect(page.getByText('¿Por qué el denominador no puede ser cero?')).toBeVisible();
    await capturar(page, '24-agente-preguntas');
    await page.getByRole('button', { name: 'Crear un quiz en borrador con estas preguntas' }).click();
    await expect(page.getByText('Quiz creado en borrador.')).toBeVisible();
  });

  test('el estudiante ve sus asistentes, resume una lección y gestiona su privacidad', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await page.goto('/asistentes');
    await expect(page.getByRole('heading', { name: 'Generador de preguntas' })).toHaveCount(0);
    await page.locator('.tarjeta-agente', { hasText: 'Resumen de lección' }).getByRole('button', { name: 'Usar' }).click();
    await page.getByLabel('Curso').selectOption(String(curso.cursoId));
    await page.getByLabel('Lección', { exact: true }).selectOption({ label: 'Fracciones' });
    await page.getByRole('button', { name: 'Generar' }).click();
    await expect(page.getByText('El denominador no puede ser cero')).toBeVisible();
    await capturar(page, '25-agente-resumen');

    await page.goto('/configuracion');
    await expect(page.getByRole('heading', { name: 'Privacidad y datos' })).toBeVisible();
    await expect(page.getByText('Política de privacidad').first()).toBeVisible();
    await page.getByRole('button', { name: 'Solicitar la eliminación de mi cuenta' }).click();
    await capturar(page, '26-baja-cuenta');
  });
});

test.describe('APIs externas', () => {
  let curso;
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => { curso = await prepararCurso(`Api${testInfo.project.name}`); });

  test('el calendario muestra los feriados de Costa Rica y la administración ve el tipo de cambio', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await page.goto('/calendario');
    const diciembre = new Date(new Date().getFullYear(), 11, 25);
    // Avanza semanas hasta la de Navidad.
    for (let i = 0; i < 60 && !(await page.getByText('Navidad').isVisible()); i += 1) {
      if (new Date() > diciembre) break;
      await page.getByRole('button', { name: 'Semana siguiente' }).click();
    }
    await expect(page.getByText('Navidad')).toBeVisible();
    await capturar(page, '27-calendario-feriados');
  });

  test('la administración ve el tipo de cambio y la gobernanza', async ({ page }) => {
    await entrar(page, curso.admin);
    await page.goto('/admin/consumo');
    await expect(page.getByRole('heading', { name: 'Tipo de cambio del dólar' })).toBeVisible();
    await expect(page.getByText(/Referencia del BCCR/)).toBeVisible();
    await capturar(page, '28-tipo-cambio');
    await page.goto('/admin/gobernanza');
    await expect(page.getByRole('heading', { name: 'Gobernanza de datos' })).toBeVisible();
    await capturar(page, '29-gobernanza');
  });
});
