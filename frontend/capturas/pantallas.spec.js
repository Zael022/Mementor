// Captura todas las pantallas en escritorio y móvil para los mockups del anteproyecto.
// Usa la misma base efímera _e2e y el doble local del modelo que las pruebas en navegador.
import { test } from '@playwright/test';
import { prepararCurso, sesion, entrar } from '../e2e/support/datos.mjs';

const SALIDA = 'capturas/salida';

async function foto(page, nombre, testInfo, espera = 400) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(espera);
  await page.screenshot({ path: `${SALIDA}/${testInfo.project.name}/${nombre}.png`, fullPage: false });
}

test.describe.configure({ mode: 'serial' });

let curso;
const extra = {};

test.beforeAll(async () => {
  curso = await prepararCurso("Pacifico", { claseEnMs: 2 * 60 * 60 * 1000 });
  const docente = await sesion(curso.docente);
  const estudiante = await sesion(curso.estudiante);
  // Nombres legibles para las capturas (solo existen en la base efímera _e2e).
  await docente.patch(`/courses/${curso.cursoId}`, { title: 'Matemática 7°' });
  await docente.patch('/me/profile', { displayName: 'Prof. Carlos Mora' });
  await estudiante.patch('/me/profile', { displayName: 'Ana Rodríguez' });
  await (await sesion(curso.admin)).patch('/me/profile', { displayName: 'Laura Jiménez' });
  const modulo = await docente.post(`/courses/${curso.cursoId}/modules`, { title: 'Geometría' });
  const tema = await docente.post(`/modules/${modulo.id}/topics`, { title: 'Ángulos' });
  await docente.post(`/courses/${curso.cursoId}/announcements`, { title: 'Bienvenida al curso', body: 'Esta semana repasamos fracciones. Revisen la lección y el quiz.' });
  const tarea = await docente.post(`/courses/${curso.cursoId}/assignments`, {
    title: 'Ejercicios de fracciones', instructions: 'Resuelve los ejercicios 1 al 10 y explica tu procedimiento.', dueAt: new Date(Date.now() + 3 * 86400000).toISOString(), maxPoints: 100,
  });
  await docente.patch(`/assignments/${tarea.id}`, { status: 'published' });
  extra.tareaId = tarea.id;
  const quiz = await docente.post(`/courses/${curso.cursoId}/quick-quizzes`, { title: 'Repaso de fracciones', secondsPerQuestion: 30 });
  for (const [prompt, correcta] of [['¿Cuál es el denominador de 3/4?', '4'], ['¿1/2 es equivalente a…?', '2/4']]) {
    await docente.post(`/quick-quizzes/${quiz.id}/questions`, { prompt, options: [{ body: 'Ninguna', isCorrect: false }, { body: correcta, isCorrect: true }, { body: 'Cero', isCorrect: false }] });
  }
  await docente.post(`/quick-quizzes/${quiz.id}/publish`);
  extra.quizId = quiz.id;
  const evaluacion = await docente.post(`/courses/${curso.cursoId}/assessments`, { title: 'Prueba corta de ángulos', topicId: tema.id, passingScore: 60, maxAttempts: 2 });
  await docente.post(`/assessments/${evaluacion.id}/questions`, { stem: '¿Cuántos grados tiene un ángulo recto?', options: [{ body: '90', isCorrect: true }, { body: '45', isCorrect: false }, { body: '180', isCorrect: false }] });
  await docente.post(`/assessments/${evaluacion.id}/publish`);
  extra.evaluacionId = evaluacion.id;
  // Repaso de un intento en el módulo Números: al enviarlo, su clave queda visible y alimenta Parejas.
  const numeros = (await docente.get(`/courses/${curso.cursoId}`)).modules[0];
  extra.moduloNumeros = numeros.id;
  const repaso = await docente.post(`/courses/${curso.cursoId}/assessments`, { title: 'Repaso de fracciones', topicId: numeros.topics[0].id, maxAttempts: 1 });
  for (const [stem, correcta] of [
    ['¿Qué indica el denominador?', 'En cuántas partes iguales se divide el entero'],
    ['¿Cuánto es 1/2 + 1/4?', '3/4'],
    ['¿Cómo se llama el número de arriba?', 'Numerador'],
    ['¿Qué fracción es equivalente a 1/2?', '2/4'],
    ['¿Cuál es mayor: 3/5 o 2/5?', '3/5'],
    ['¿Cuántos cuartos hay en un entero?', 'Cuatro'],
  ]) {
    await docente.post(`/assessments/${repaso.id}/questions`, { stem, options: [{ body: correcta, isCorrect: true }, { body: 'Ninguna', isCorrect: false }] });
  }
  await docente.post(`/assessments/${repaso.id}/publish`);
  const intento = await estudiante.post(`/assessments/${repaso.id}/attempts`);
  await estudiante.post(`/attempts/${intento.attemptId}/submit`, { answers: [] });
  // Busca la primera lección publicada dentro del detalle del curso.
  const detalle = await estudiante.get(`/courses/${curso.cursoId}`).catch(() => null);
  const buscar = (nodo) => {
    if (!nodo || typeof nodo !== 'object') return null;
    if (Array.isArray(nodo.lessons) && nodo.lessons[0]?.id) return nodo.lessons[0].id;
    for (const valor of Object.values(nodo)) { const encontrado = buscar(valor); if (encontrado) return encontrado; }
    return null;
  };
  extra.leccionId = buscar(detalle);
});

test('pantallas públicas', async ({ page }, testInfo) => {
  for (const [ruta, nombre] of [['/login', '01-login'], ['/recuperar', '02-recuperar-clave'], ['/activar?token=x', '03-activar-cuenta'], ['/terminos', '04-terminos'], ['/privacidad', '05-privacidad']]) {
    await page.goto(ruta);
    await foto(page, nombre, testInfo);
  }
});

test('pantallas del estudiante', async ({ page }, testInfo) => {
  await entrar(page, curso.estudiante);
  const id = curso.cursoId;
  const rutas = [
    ['/estudiante/inicio', '10-estudiante-inicio'],
    ['/estudiante/cursos', '11-estudiante-cursos'],
    [`/estudiante/cursos/${id}`, '12-curso-novedades'],
    [`/estudiante/cursos/${id}?seccion=trabajo`, '13-curso-trabajo-en-clase'],
    [`/estudiante/cursos/${id}?seccion=quizzes`, '14-curso-quizzes-y-racha'],
    [`/estudiante/cursos/${id}?seccion=calificaciones`, '15-curso-calificaciones'],
    [`/estudiante/tareas/${extra.tareaId}`, '16-entregar-tarea'],
    [`/estudiante/cursos/${id}/quizzes/${extra.quizId}`, '17-jugar-quiz'],
    [`/estudiante/cursos/${id}/racha`, '18-practica-diaria'],
    [`/estudiante/evaluaciones/${extra.evaluacionId}`, '19-evaluacion'],
    [`/estudiante/tutor/${id}`, '20-tutor-ia'],
    ['/estudiante/progreso', '21-progreso'],
    ['/estudiante/plan', '22-plan-de-estudio'],
    ['/calendario', '23-calendario'],
    ['/pendientes', '24-pendientes'],
    ['/asistentes', '25-asistentes-ia-estudiante'],
    ['/configuracion', '26-configuracion-y-privacidad'],
    ['/no-existe', '28-pagina-no-encontrada'],
  ];
  if (extra.leccionId) rutas.push([`/estudiante/lecciones/${extra.leccionId}`, '27-leccion']);
  for (const [ruta, nombre] of rutas) {
    await page.goto(ruta);
    await foto(page, nombre, testInfo);
  }
  // Mapa del curso con Orbi junto a la parada siguiente.
  await page.goto(`/estudiante/cursos/${id}?seccion=trabajo&ver=lecciones`);
  await page.locator('.mapa-orbi').waitFor();
  await page.locator('.mapa').scrollIntoViewIfNeeded();
  await foto(page, '13b-mapa-del-curso', testInfo);
  // Parejas del módulo, con una pareja encontrada.
  await page.goto(`/estudiante/cursos/${id}/parejas/${extra.moduloNumeros}`);
  await page.getByRole('button', { name: /Empezar/ }).first().click();
  const cartas = page.locator('.carta');
  await cartas.first().waitFor();
  const textos = [];
  for (let i = 0; i < 12; i += 1) {
    await cartas.nth(i).click();
    await page.waitForFunction((n) => document.querySelectorAll('.carta')[n].getAttribute('aria-label').includes(':'), i);
    textos[i] = await cartas.nth(i).locator('.carta-texto').textContent();
  }
  await page.waitForTimeout(1500);
  await cartas.nth(textos.indexOf('¿Cuánto es 1/2 + 1/4?')).click();
  await cartas.nth(textos.indexOf('3/4')).click();
  await foto(page, '18b-parejas', testInfo, 1200);
  // Celebración al subir de rango (la lección ya se capturó antes sin completar).
  if (extra.leccionId) {
    await page.goto(`/estudiante/lecciones/${extra.leccionId}`);
    await page.getByRole('button', { name: 'Marcar como completada' }).click();
    await page.locator('.celebracion').waitFor();
    await page.locator('.celebracion').scrollIntoViewIfNeeded();
    await foto(page, '27b-celebracion-rango', testInfo, 2600);
  }
  // Flujo de eliminación de cuenta dentro de Configuración.
  await page.goto('/configuracion');
  await page.getByRole('button', { name: 'Solicitar la eliminación de mi cuenta' }).click();
  await page.getByRole('button', { name: 'Eliminar mi cuenta' }).scrollIntoViewIfNeeded();
  await foto(page, '29-eliminar-cuenta', testInfo);
  // Un agente de IA en uso (el modelo es el doble local de las pruebas).
  await usarAgente(page, 'Coach de estudio', '25b-agente-coach-de-estudio', testInfo);
});

async function usarAgente(page, titulo, nombre, testInfo, rellenar = async () => {}) {
  await page.goto('/asistentes');
  const tarjeta = page.locator('.tarjeta, article, li').filter({ hasText: titulo }).filter({ has: page.getByRole('button', { name: 'Usar' }) }).first();
  await tarjeta.getByRole('button', { name: 'Usar' }).click();
  const curso = page.getByLabel('Curso', { exact: true });
  if (await curso.count()) await curso.selectOption({ index: 1 });
  await rellenar();
  await page.getByRole('button', { name: 'Generar' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Generar' }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 300);
  await foto(page, nombre, testInfo);
}

test('pantallas del docente', async ({ page }, testInfo) => {
  await entrar(page, curso.docente);
  const id = curso.cursoId;
  for (const [ruta, nombre] of [
    ['/docente/cursos', '30-docente-cursos'],
    [`/docente/cursos/${id}/contenidos`, '31-contenidos'],
    [`/docente/cursos/${id}/clases`, '32-clases'],
    [`/docente/cursos/${id}/tareas`, '33-tareas'],
    [`/docente/cursos/${id}/evaluaciones`, '34-evaluaciones'],
    [`/docente/cursos/${id}/quizzes`, '35-quizzes'],
    [`/docente/cursos/${id}/calificaciones`, '36-calificaciones'],
    [`/docente/cursos/${id}/anuncios`, '37-anuncios'],
    [`/docente/cursos/${id}/fuentes`, '38-fuentes-tutor'],
    [`/docente/cursos/${id}/matriculas`, '39-matriculas'],
    [`/docente/cursos/${id}/analitica`, '40-analitica'],
    ['/asistentes', '41-asistentes-ia-docente'],
  ]) {
    await page.goto(ruta);
    await foto(page, nombre, testInfo);
  }
  await usarAgente(page, 'Generador de preguntas', '42-agente-generador-de-preguntas', testInfo, async () => {
    await page.getByLabel('Tema o enfoque').fill('fracciones equivalentes');
  });
});

test('pantallas de administración', async ({ page }, testInfo) => {
  await entrar(page, curso.admin);
  for (const [ruta, nombre] of [
    ['/admin/usuarios', '50-admin-usuarios'],
    ['/admin/cursos', '51-admin-cursos'],
    ['/admin/consumo', '52-consumo-y-tipo-de-cambio'],
    ['/admin/drive', '53-drive'],
    ['/admin/auditoria', '54-bitacora'],
    ['/admin/gobernanza', '55-gobernanza'],
  ]) {
    await page.goto(ruta);
    await foto(page, nombre, testInfo);
  }
});

test('pantallas de plataforma', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Correo').fill('operador@e2e.test');
  await page.getByLabel('Contraseña').fill('OperadorE2E2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  // La cuenta del operador se crea por script: acepta los documentos legales en el aviso.
  const casilla = page.getByRole('checkbox').first();
  if (await casilla.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) {
    await casilla.check();
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' }).catch(() => {});
  }
  await page.goto('/plataforma/instituciones');
  await foto(page, '60-plataforma-instituciones', testInfo);
});
