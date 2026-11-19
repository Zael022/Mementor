import { expect, test } from '@playwright/test';
import { entrar, prepararCurso, sesion } from './support/datos.mjs';

// Capturas opcionales para revisar el diseño (CAPTURAS=/ruta/carpeta).
const capturar = async (page, nombre) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nombre}.png`, fullPage: true });
};

test.describe('Quiz rápido, racha y calificaciones @movil', () => {
  let curso;
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => {
    curso = await prepararCurso(`Juego${testInfo.project.name}`);
    const docente = await sesion(curso.docente);
    const quiz = await docente.post(`/courses/${curso.cursoId}/quick-quizzes`, { title: 'Repaso de fracciones', secondsPerQuestion: 30 });
    for (const [prompt, correcta] of [['¿Cuál es el denominador de 3/4?', '4'], ['¿1/2 es equivalente a…?', '2/4']]) {
      await docente.post(`/quick-quizzes/${quiz.id}/questions`, {
        prompt, options: [{ body: 'Ninguna', isCorrect: false }, { body: correcta, isCorrect: true }, { body: 'Cero', isCorrect: false }],
      });
    }
    await docente.post(`/quick-quizzes/${quiz.id}/publish`);
  });

  test('el estudiante juega un quiz perfecto, mantiene su racha y ve el bono en su nota', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await capturar(page, '01-inicio-estudiante');
    await page.goto(`/estudiante/cursos/${curso.cursoId}?seccion=quizzes`);
    await expect(page.getByText('0 días seguidos')).toBeVisible();
    await capturar(page, '02-quizzes-y-racha');

    await page.getByRole('link', { name: 'Jugar', exact: true }).click();
    await page.getByRole('button', { name: 'Comenzar' }).click();
    for (const correcta of ['4', '2/4']) {
      await page.getByRole('button', { name: correcta, exact: true }).click();
      await expect(page.getByText('¡Correcto!')).toBeVisible();
      await capturar(page, `03-respuesta-${correcta.replace('/', '-')}`);
      await page.getByRole('button', { name: /Siguiente|Ver resultados/ }).click();
    }
    await expect(page.getByRole('heading', { name: '¡Perfecto!' })).toBeVisible();
    await expect(page.getByText('+0,1 a tu nota del curso')).toBeVisible();
    await expect(page.locator('.tabla-posiciones li.mia')).toBeVisible();
    await capturar(page, '04-resultado');

    await page.getByRole('link', { name: 'Volver a la clase' }).click();
    await page.getByRole('link', { name: 'Practicar hoy' }).click();
    for (let i = 0; i < 2; i += 1) {
      await page.locator('.opcion-quiz').first().click();
      await page.getByRole('button', { name: /Siguiente|Terminar/ }).click();
    }
    await expect(page.getByRole('heading', { name: '¡Racha de 1 día!' })).toBeVisible();
    await expect(page.getByText('+0,09 a tu nota del curso')).toBeVisible();
    await capturar(page, '05-racha');

    await page.goto(`/estudiante/cursos/${curso.cursoId}?seccion=calificaciones`);
    await expect(page.getByText('Quizzes perfectos: 1 (+0,10)')).toBeVisible();
    await expect(page.getByText('Días de racha: 1 (+0,09)')).toBeVisible();
    await capturar(page, '06-calificaciones-estudiante');

    // El estudiante no tiene las pantallas del docente.
    await page.goto(`/docente/cursos/${curso.cursoId}/calificaciones`);
    await expect(page).not.toHaveURL(/calificaciones$/);
  });

  test('el docente califica trabajo en clase y ve el libro de calificaciones con la racha', async ({ page }) => {
    await entrar(page, curso.docente);
    await capturar(page, '07-inicio-docente');
    await page.goto(`/docente/cursos/${curso.cursoId}/calificaciones`);
    await page.getByLabel('Actividad', { exact: true }).fill('Participación');
    await page.getByLabel('Puntos máximos').fill('10');
    await page.getByRole('button', { name: 'Crear actividad' }).click();
    await page.getByLabel(/^Puntos de Estudiante/).fill('8');
    await page.getByRole('button', { name: 'Guardar calificaciones' }).click();
    await expect(page.getByText('Calificaciones guardadas.')).toBeVisible();
    // Trabajo en clase 80 % (lo único calificado) → 8,00 + bono 0,19 = 8,19.
    await expect(page.locator('.tabla-notas').first().getByText('8,19')).toBeVisible();
    await capturar(page, '08-calificaciones-docente');

    await page.goto(`/docente/cursos/${curso.cursoId}/quizzes`);
    await expect(page.getByText('Repaso de fracciones')).toBeVisible();
    await capturar(page, '09-quizzes-docente');
    await page.goto('/calendario');
    await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
    await capturar(page, '10-calendario');
    await page.goto(`/docente/cursos/${curso.cursoId}/matriculas`);
    await capturar(page, '11-personas-docente');
  });
});
