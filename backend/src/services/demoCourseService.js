import { Announcement, Course, Institution, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { addDays, appTimeZone, clock, dayKey } from '../utils/clock.js';
import { demoEnabled } from '../utils/demo.js';
import * as assessmentService from './assessmentService.js';
import * as assignmentService from './assignmentService.js';
import * as classWorkService from './classWorkService.js';
import * as contentService from './contentService.js';
import * as courseBoardService from './courseBoardService.js';
import * as courseService from './courseService.js';
import * as quickQuizService from './quickQuizService.js';
import * as sessionService from './sessionService.js';
import * as streakService from './streakService.js';
import * as studyPlanService from './studyPlanService.js';
import {
  DEMO_ANNOUNCEMENT, DEMO_ASSESSMENTS, DEMO_ASSIGNMENTS, DEMO_CLASSMATES, DEMO_COURSE, DEMO_MODULES, DEMO_PREREQUISITES, DEMO_QUIZ,
} from './demoContent.js';
import { DEMO_ACCOUNTS, DEMO_INSTITUTION } from './demoService.js';

// Curso de prueba con actividad simulada (ADR 0011). Todo pasa por los mismos servicios que usa la interfaz,
// así que las notas, el dominio, la racha y el rango salen de los cálculos reales, no de números inventados.
const DIA = 86400000;

// Corre una parte de la simulación como si fuera otro momento (días atrás y segundos extra).
async function enOtroMomento({ dias = 0, segundos = 0 }, tarea) {
  const original = clock.now;
  clock.now = () => new Date(Date.now() - dias * DIA + segundos * 1000);
  try {
    return await tarea();
  } finally {
    clock.now = original;
  }
}

// Opciones con la correcta en distinta posición según la pregunta, para que no siempre sea la primera.
function opciones({ correcta, distractores }, indice) {
  const lista = distractores.map((body) => ({ body, isCorrect: false }));
  lista.splice(indice % (lista.length + 1), 0, { body: correcta, isCorrect: true });
  return lista;
}

// Elige la opción por su texto: la correcta o, si se pide fallar, la primera incorrecta.
function elegir(pregunta, correctaTexto, acertar) {
  const buscada = pregunta.options.find((opcion) => opcion.body === correctaTexto);
  return acertar ? buscada : pregunta.options.find((opcion) => opcion !== buscada);
}

async function cargarPersonas(institution) {
  const porCorreo = async (email) => User.findOne({ where: { email, isDemo: true, institutionId: institution.id } });
  const correo = (role) => DEMO_ACCOUNTS.find((cuenta) => cuenta.role === role).email;
  const personas = {
    docente: await porCorreo(correo('teacher')),
    estudiante: await porCorreo(correo('student')),
    sofia: await porCorreo(DEMO_CLASSMATES[0].email),
    diego: await porCorreo(DEMO_CLASSMATES[1].email),
  };
  if (Object.values(personas).some((persona) => !persona)) {
    throw new AppError(409, 'DEMO_ACCOUNTS_MISSING', 'Faltan cuentas de prueba: corre primero ensureDemoAccounts().');
  }
  return personas;
}

// Crea (o deja como está) el curso de prueba. Con «reiniciar», archiva el anterior y arma uno nuevo.
export async function ensureDemoCourse({ reiniciar = false } = {}) {
  if (!demoEnabled()) throw new AppError(409, 'DEMO_DISABLED', 'Enciende DEMO_MODE=on para crear el curso de prueba.');
  const institution = await Institution.findOne({ where: { slug: DEMO_INSTITUTION.slug } });
  if (!institution) throw new AppError(409, 'DEMO_ACCOUNTS_MISSING', 'Faltan las cuentas de prueba.');
  const actual = await Course.findOne({ where: { institutionId: institution.id, code: DEMO_COURSE.code } });
  if (actual) {
    // El anuncio es lo último que se crea: si existe, el curso quedó completo.
    const completo = await Announcement.count({ where: { courseId: actual.id, title: DEMO_ANNOUNCEMENT.title } });
    if (completo && !reiniciar) return { created: false, courseId: actual.id };
    // No se borra historial: el curso anterior se archiva con otro código.
    await actual.update({ status: 'archived', code: `${DEMO_COURSE.code}-${Date.now().toString(36)}`.slice(0, 40) });
  }
  const personas = await cargarPersonas(institution);
  const curso = await construirCurso(personas);
  await simularActividad(personas, curso);
  await courseBoardService.createAnnouncement(personas.docente, curso.id, DEMO_ANNOUNCEMENT);
  return { created: true, courseId: curso.id };
}

// Estructura del curso: módulos, temas, lecciones publicadas, evaluaciones, quiz, tareas, clase y trabajo en clase.
async function construirCurso({ docente, estudiante, sofia, diego }) {
  const curso = await courseService.createCourse(docente, DEMO_COURSE);
  await courseService.updateCourse(docente, curso.id, { status: 'published' });
  const temas = {};
  const lecciones = {};
  for (const modulo of DEMO_MODULES) {
    const creado = await contentService.createModule(docente, curso.id, { title: modulo.title });
    for (const tema of modulo.topics) {
      const nuevo = await contentService.createTopic(docente, creado.id, { title: tema.title, learningObjective: tema.learningObjective });
      temas[tema.key] = nuevo.id;
      lecciones[tema.key] = [];
      for (const leccion of tema.lessons) {
        const hecha = await contentService.createLesson(docente, nuevo.id, leccion);
        await contentService.updateLesson(docente, hecha.id, { status: 'published' });
        lecciones[tema.key].push(hecha.id);
      }
    }
  }
  for (const [tema, previos] of Object.entries(DEMO_PREREQUISITES)) {
    await contentService.setPrerequisites(docente, temas[tema], previos.map((clave) => temas[clave]));
  }

  // Quiz con bono: también es el banco de la práctica diaria.
  const quiz = await quickQuizService.createQuiz(docente, curso.id, { title: DEMO_QUIZ.title, secondsPerQuestion: DEMO_QUIZ.secondsPerQuestion });
  for (const [indice, pregunta] of DEMO_QUIZ.questions.entries()) {
    await quickQuizService.addQuestion(docente, quiz.id, { prompt: pregunta.stem, options: opciones(pregunta, indice) });
  }
  await quickQuizService.changeStatus(docente, quiz.id, 'published');

  const evaluaciones = {};
  for (const datos of DEMO_ASSESSMENTS) {
    const evaluacion = await assessmentService.createAssessment(docente, curso.id, {
      title: datos.title, topicId: temas[datos.topic], passingScore: datos.passingScore, maxAttempts: datos.maxAttempts,
    });
    for (const [indice, pregunta] of datos.questions.entries()) {
      await assessmentService.addQuestion(docente, evaluacion.id, {
        stem: pregunta.stem, explanation: pregunta.explanation, points: 1, options: opciones(pregunta, indice),
      });
    }
    await assessmentService.changeStatus(docente, evaluacion.id, 'published');
    evaluaciones[datos.key] = evaluacion.id;
  }

  const tareas = {};
  for (const datos of DEMO_ASSIGNMENTS) {
    const tarea = await assignmentService.createAssignment(docente, curso.id, {
      title: datos.title, instructions: datos.instructions, maxPoints: datos.maxPoints,
      dueAt: new Date(Date.now() + datos.dueInDays * DIA), topicId: datos.topic ? temas[datos.topic] : null,
    });
    await assignmentService.updateAssignment(docente, tarea.id, { status: 'published' });
    tareas[datos.key] = tarea.id;
  }

  // Clase en vivo mañana a las 10:00 (hora del servidor) con un enlace de ejemplo.
  const manana = new Date(Date.now() + DIA);
  manana.setHours(10, 0, 0, 0);
  await sessionService.createSession(docente, curso.id, {
    title: 'Clase en vivo: repaso de fracciones', description: 'Resolvemos juntos las dudas de la tarea de fracciones.',
    startsAt: manana, durationMinutes: 60, meetingUrl: 'https://meet.example.com/mentor-prueba', topicId: temas.fracciones,
  });
  const trabajo = await classWorkService.createItem(docente, curso.id, {
    title: 'Trabajo en clase: fracciones con material concreto', maxPoints: 100, workDate: addDays(dayKey(), -3),
  });

  for (const persona of [estudiante, sofia, diego]) await courseService.enrollStudent(docente, curso.id, persona.id);
  return { id: curso.id, quizId: quiz.id, temas, lecciones, evaluaciones, tareas, trabajoId: trabajo.id };
}

// Responde la práctica diaria de un día pasado; «fallar» indica qué preguntas (por orden) se responden mal.
async function practicaDelDia(persona, courseId, dias, fallar = []) {
  await enOtroMomento({ dias }, async () => {
    const practica = await streakService.getTodayPractice(persona, courseId);
    if (!practica.available && practica.available !== undefined) return;
    for (const [indice, pregunta] of practica.questions.entries()) {
      const datos = DEMO_QUIZ.questions.find((item) => item.stem === pregunta.prompt);
      const opcion = elegir(pregunta, datos.correcta, !fallar.includes(indice));
      await streakService.answerDaily(persona, courseId, { questionId: pregunta.id, optionId: opcion.id });
    }
  });
}

// Resuelve una evaluación; «fallar» son los enunciados que se responden mal.
async function resolverEvaluacion(persona, evaluacionId, datos, fallar = []) {
  const { attemptId } = await assessmentService.startAttempt(persona, evaluacionId);
  const evaluacion = await assessmentService.getAssessment(persona, evaluacionId);
  const respuestas = evaluacion.questions.map((pregunta) => {
    const original = datos.questions.find((item) => item.stem === pregunta.stem);
    return { questionId: pregunta.id, selectedOptionId: elegir(pregunta, original.correcta, !fallar.includes(original.stem)).id };
  });
  await assessmentService.submitAttempt(persona, attemptId, respuestas);
}

// Juega el quiz con bono, con unos segundos de pausa por pregunta.
async function jugarQuiz(persona, quizId, { dias, aciertos, segundos }) {
  await enOtroMomento({ dias }, async () => {
    const { playId } = await quickQuizService.startPlay(persona, quizId);
    for (let indice = 0; ; indice += 1) {
      const paso = await quickQuizService.nextQuestion(persona, playId);
      if (paso.finished) break;
      const datos = DEMO_QUIZ.questions.find((item) => item.stem === paso.question.prompt);
      const opcion = elegir(paso.question, datos.correcta, indice < aciertos);
      const resultado = await enOtroMomento({ dias, segundos: segundos * (indice + 1) }, () => (
        quickQuizService.answerQuestion(persona, playId, { questionId: paso.question.id, optionId: opcion.id })
      ));
      if (resultado.isLast) break;
    }
  });
}

// Historia de unos días: la estudiante de prueba va a mitad de camino; Sofía va adelante y Diego empieza.
async function simularActividad({ docente, estudiante, sofia, diego }, curso) {
  const repaso = DEMO_ASSESSMENTS.find((item) => item.key === 'repaso-fracciones');
  const angulos = DEMO_ASSESSMENTS.find((item) => item.key === 'angulos');
  const todas = Object.values(curso.lecciones).flat();

  // Práctica diaria: 4 días seguidos para la estudiante (hoy le toca mantener la racha), 2 para Sofía.
  for (const [dias, fallar] of [[4, [1]], [3, []], [2, [0, 3]], [1, []]]) await practicaDelDia(estudiante, curso.id, dias, fallar);
  for (const dias of [2, 1]) await practicaDelDia(sofia, curso.id, dias);

  // Lecciones completadas.
  for (const leccion of [...curso.lecciones.fracciones, curso.lecciones.decimales[0]]) await contentService.completeLesson(estudiante, leccion);
  for (const leccion of todas.slice(0, -1)) await contentService.completeLesson(sofia, leccion);
  await contentService.completeLesson(diego, curso.lecciones.fracciones[0]);

  // Evaluaciones: la clave del repaso queda visible al usar su único intento (así se habilita Parejas).
  await resolverEvaluacion(estudiante, curso.evaluaciones['repaso-fracciones'], repaso, ['¿Cuál es la forma simplificada de 10/15?']);
  await resolverEvaluacion(sofia, curso.evaluaciones['repaso-fracciones'], repaso);
  await resolverEvaluacion(diego, curso.evaluaciones['repaso-fracciones'], repaso, [repaso.questions[1].stem, repaso.questions[3].stem, repaso.questions[4].stem]);
  await resolverEvaluacion(sofia, curso.evaluaciones.angulos, angulos);

  // Tareas: entregas calificadas con retroalimentación y una pendiente de revisar.
  const entregaAna = await assignmentService.submitAssignment(estudiante, curso.tareas['ejercicios-fracciones'], {
    body: 'Resolví los 10 ejercicios. Para el denominador común busqué el mínimo común múltiplo: en 1/4 + 1/6 usé 12.',
  });
  const entregaSofia = await assignmentService.submitAssignment(sofia, curso.tareas['ejercicios-fracciones'], {
    body: 'Adjunto mis respuestas. En los ejercicios 6 al 10 convertí cada fracción a una equivalente antes de sumar.',
  });
  await assignmentService.gradeSubmission(docente, entregaAna.id, {
    gradePoints: 88, feedback: 'Muy bien explicado el denominador común. Revisa el ejercicio 8: faltó simplificar el resultado.',
  });
  await assignmentService.gradeSubmission(docente, entregaSofia.id, { gradePoints: 95, feedback: 'Excelente procedimiento.' });
  await assignmentService.submitAssignment(sofia, curso.tareas['medir-angulos'], {
    body: 'Puerta: 90° (recto). Tijeras abiertas: 40° (agudo). Respaldo de la silla: 105° (obtuso). Reloj a las 4: 120° (obtuso). Libro abierto: 180° (llano).',
  });

  // Quiz con bono: tabla de posiciones con los compañeros (la estudiante puede jugarlo en vivo).
  await jugarQuiz(sofia, curso.quizId, { dias: 1, aciertos: 6, segundos: 4 });
  await jugarQuiz(diego, curso.quizId, { dias: 1, aciertos: 4, segundos: 9 });

  // Trabajo en clase calificado.
  await classWorkService.saveGrades(docente, curso.trabajoId, [
    { studentId: estudiante.id, points: 90, feedback: 'Buen trabajo en equipo.' },
    { studentId: sofia.id, points: 100 },
    { studentId: diego.id, points: 75, feedback: 'Repasa cómo comparar fracciones.' },
  ]);

  // Una duda en la lección de sumar fracciones, con la respuesta del docente.
  const leccionSuma = curso.lecciones.fracciones[2];
  const duda = await courseBoardService.createComment(diego, leccionSuma, { body: '¿Siempre hay que buscar el mismo denominador para sumar?' });
  await courseBoardService.createComment(docente, leccionSuma, {
    body: 'Sí: primero conviertes las dos fracciones a un denominador común y después sumas los numeradores. Mira el ejemplo de 1/2 + 1/4.',
    parentId: duda.id,
  });

  // Plan de estudio de la estudiante hacia el cierre del curso.
  await studyPlanService.createPlan(estudiante, curso.id, {
    targetDate: addDays(dayKey(), 21), minutesPerSession: 30, studyDays: [1, 3, 5], timeZone: appTimeZone(),
  });
}
