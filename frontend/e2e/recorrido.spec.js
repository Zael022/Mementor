import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { entrar, prepararCurso, sesion } from './support/datos.mjs';

// Recorrido del curso: mapa, rango, celebración con Orbi y el juego Parejas, con datos efímeros de la base _e2e.
// Revisión automática WCAG 2.2 AA de la zona indicada (sin esperar a que terminen las animaciones de entrada).
const sinInfracciones = async (page, zona) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const resultado = await new AxeBuilder({ page }).include(zona).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(resultado.violations.map((item) => `${item.id}: ${item.nodes.map((nodo) => nodo.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
};
const capturar = async (page, nombre) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nombre}.png`, fullPage: true });
};

test.describe('Mapa del curso y rango de avance @movil', () => {
  let curso;
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => {
    curso = await prepararCurso(`Mapa${testInfo.project.name}`);
  });

  test('al completar una lección, el mapa y el rango avanzan', async ({ page }, testInfo) => {
    await entrar(page, curso.estudiante);
    await page.goto(`/estudiante/cursos/${curso.cursoId}?seccion=trabajo&ver=lecciones`);
    const rango = page.getByRole('region', { name: 'Tu rango en este curso' });
    await expect(rango.getByText('Destello', { exact: true })).toBeVisible();
    await expect(rango.getByText('Te falta 1 lección para Brillo.')).toBeVisible();
    const mapa = page.locator('.mapa');
    const primera = mapa.getByRole('link', { name: 'Lección 1. Fracciones. Continúa aquí' });
    await expect(primera).toBeVisible();
    await expect(mapa.getByRole('link', { name: 'Lección 2. Fracciones equivalentes. Pendiente' })).toBeVisible();
    await sinInfracciones(page, 'main');
    await capturar(page, `mapa-01-${testInfo.project.name}`);

    // Se entra a la lección con el teclado.
    await primera.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Marcar como completada' }).click();
    await expect(page.getByRole('heading', { name: '¡Subiste a Brillo!' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver qué sigue' }).click();
    await expect(page.getByRole('heading', { name: 'Próxima meta: Luz' })).toBeVisible();
    await sinInfracciones(page, '.celebracion');
    await capturar(page, `mapa-02-celebracion-${testInfo.project.name}`);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.locator('.celebracion')).toHaveCount(0);

    await page.getByRole('link', { name: 'Ver mi avance en el mapa' }).click();
    await expect(mapa.getByRole('link', { name: 'Lección 1. Fracciones. Completada' })).toBeVisible();
    await expect(mapa.getByRole('link', { name: 'Lección 2. Fracciones equivalentes. Continúa aquí' })).toBeVisible();
    await expect(rango.getByText('Brillo', { exact: true })).toBeVisible();
    await expect(rango.getByText('Te falta 1 lección para Luz.')).toBeVisible();
    // Orbi espera junto a la parada siguiente; al tocarlo dice a dónde sigue y lleva el foco a esa parada.
    await page.getByRole('button', { name: 'Orbi: ir a la siguiente parada' }).click();
    await expect(page.locator('.burbuja-mapa[aria-live]')).toHaveText('¡Vamos! Sigue «Fracciones equivalentes».');
    await expect(mapa.getByRole('link', { name: 'Lección 2. Fracciones equivalentes. Continúa aquí' })).toBeFocused();
    await sinInfracciones(page, 'main');
    await capturar(page, `mapa-03-avance-${testInfo.project.name}`);

    // La tarjeta de inicio muestra el mismo rango.
    await page.goto('/estudiante/inicio');
    await expect(page.locator('.tarjeta-enlace').getByText('Brillo', { exact: true })).toBeVisible();
  });
});

test.describe('Parejas del módulo', () => {
  let curso;
  const preguntas = [
    ['¿Qué indica el denominador?', 'En cuántas partes iguales se divide el entero'],
    ['¿Cuánto es 1/2 + 1/4?', '3/4'],
    ['¿Cómo se llama el número de arriba?', 'Numerador'],
  ];
  test.beforeAll(async () => {
    curso = await prepararCurso('Parejas');
    const docente = await sesion(curso.docente);
    const estudiante = await sesion(curso.estudiante);
    const detalle = await docente.get(`/courses/${curso.cursoId}`);
    // Evaluación de un intento: al enviarla, su clave queda visible para el estudiante y alimenta Parejas.
    const evaluacion = await docente.post(`/courses/${curso.cursoId}/assessments`, { title: 'Repaso', topicId: detalle.modules[0].topics[0].id, maxAttempts: 1 });
    for (const [stem, correcta] of preguntas) {
      await docente.post(`/assessments/${evaluacion.id}/questions`, { stem, options: [{ body: correcta, isCorrect: true }, { body: 'Ninguna', isCorrect: false }] });
    }
    await docente.post(`/assessments/${evaluacion.id}/publish`);
    const intento = await estudiante.post(`/assessments/${evaluacion.id}/attempts`);
    await estudiante.post(`/attempts/${intento.attemptId}/submit`, { answers: [] });
  });

  test('se juega hasta terminar con el teclado y se puede volver a jugar', async ({ page }) => {
    await entrar(page, curso.estudiante);
    await page.goto(`/estudiante/cursos/${curso.cursoId}?seccion=trabajo&ver=lecciones`);
    await page.getByRole('link', { name: /Parejas del módulo\. 3 parejas/ }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    const cartas = page.locator('.carta');
    await expect(cartas).toHaveCount(6);
    await expect(cartas.first()).toHaveAccessibleName('Carta 1, boca abajo');
    await expect(cartas.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cartas.nth(1)).toBeFocused();
    await sinInfracciones(page, 'main');
    await capturar(page, 'parejas-01-tablero');

    const voltear = async (indice) => {
      await cartas.nth(indice).focus();
      await page.keyboard.press('Enter');
      await expect(cartas.nth(indice)).toHaveAccessibleName(/^Carta \d+: (Pregunta|Respuesta): /);
      return cartas.nth(indice).locator('.carta-texto').textContent();
    };
    // Primera pasada: se voltean de dos en dos para conocer los textos.
    const textos = [];
    for (let i = 0; i < 6; i += 2) {
      textos[i] = await voltear(i);
      textos[i + 1] = await voltear(i + 1);
    }
    const anuncio = page.locator('.parejas-orbi [aria-live="polite"]');
    // Segunda pasada: se une cada pregunta con su respuesta.
    for (const [pregunta, respuesta] of preguntas) {
      const a = textos.indexOf(pregunta);
      const b = textos.indexOf(respuesta);
      if (await cartas.nth(a).evaluate((boton) => boton.classList.contains('pareja'))) continue;
      await voltear(a);
      await voltear(b);
      await expect(cartas.nth(a)).toHaveAccessibleName(/\(pareja encontrada\)$/);
    }
    await expect(page.getByRole('heading', { name: '¡Tablero completo!' })).toBeVisible();
    await expect(anuncio).toHaveText(/^¡Encontraste las 3 parejas en \d+ intentos!$/);
    await sinInfracciones(page, 'main');
    await capturar(page, 'parejas-02-final');

    await page.getByRole('button', { name: 'Jugar otra vez' }).click();
    await expect(page.getByRole('heading', { name: '¡Tablero completo!' })).toHaveCount(0);
    await expect(cartas.first()).toHaveAccessibleName('Carta 1, boca abajo');
    await expect(cartas.first()).toBeFocused();
    await page.getByRole('link', { name: 'Volver al mapa' }).first().click();
    await expect(page.locator('.mapa')).toBeVisible();
  });
});
