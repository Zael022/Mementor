import { z } from 'zod';
import { admissionsAgent } from './admissionsAgent.js';
import {
  Assignment, AssignmentSubmission, CourseStreak, Lesson, Topic, TopicMastery,
} from '../../models/index.js';
import { forbidden, notFound } from '../../utils/AppError.js';
import { dayKey } from '../../utils/clock.js';
import { getCourseAccess } from '../accessService.js';
import { getCourseAnalytics } from '../analyticsService.js';
import { retrievePassages } from '../retrievalService.js';
import { streakView } from '../streakService.js';
import { asData } from '../tutorService.js';
import { detectPersonalData, redactPersonalData } from '../../utils/personalData.js';

// Catálogo de los 8 agentes de IA: propósito, roles, entradas, contexto autorizado y formato de salida.

const id = z.coerce.number().int().positive();
const PROVIDER = 'Proveedor configurado en AI_PROVIDER/AI_MODEL (Anthropic Claude por defecto)';

// Pasajes del curso numerados [S1], [S2]… para exigir citas verificables.
function sourcesBlock(passages) {
  return passages.map((passage, index) => `<fuente id="S${index + 1}" titulo="${asData(passage.title)}">\n${asData(passage.text)}\n</fuente>`).join('\n');
}
const sourceList = (passages) => passages.map((passage, index) => ({
  id: `S${index + 1}`, title: passage.title, versionId: passage.versionId, page: passage.page ?? null, heading: passage.heading ?? null,
}));
// Solo se conservan las citas que coinciden exactamente con un identificador entregado (S1…Sn; no S0 ni S01).
export const validCitations = (citations, passages) => {
  const delivered = new Set(passages.map((_, index) => `S${index + 1}`));
  return [...new Set(citations)].filter((cite) => delivered.has(cite));
};

export const AGENTS = {
  admissions_writer: admissionsAgent,
  // 1. Tutor conversacional con RAG: ya existe con su propia pantalla y bitácora de consumo.
  tutor: {
    key: 'tutor',
    name: 'Tutor del curso (RAG)',
    purpose: 'Responde dudas del estudiante usando solo el material autorizado del curso y cita cada fuente.',
    roles: ['student', 'teacher'],
    inputs: ['Curso (de la sesión)', 'Pregunta'],
    provider: PROVIDER,
    privacy: 'Envía la pregunta (con cédulas, teléfonos, correos y enlaces ocultos), los pasajes del curso y los últimos turnos del hilo; nunca el nombre ni el correo de la cuenta. Sin evidencia no llama al modelo.',
    external: true,
    link: { student: '/estudiante/tutor/:courseId', teacher: '/docente/tutor/:courseId' },
  },

  // 2. Generador de preguntas para quizzes a partir del material del curso.
  question_generator: {
    key: 'question_generator',
    name: 'Generador de preguntas',
    purpose: 'Propone preguntas de opción múltiple para un quiz a partir del material del curso, con su fuente.',
    roles: ['teacher', 'institution_admin'],
    inputs: ['Curso', 'Tema o enfoque', 'Cantidad (1 a 8)'],
    provider: PROVIDER,
    privacy: 'Solo usa material del curso; no envía datos de estudiantes.',
    inputSchema: z.object({ courseId: id, topic: z.string().trim().min(3).max(200), count: z.coerce.number().int().min(1).max(8).default(5) }),
    async buildContext(user, input) {
      await getCourseAccess(user, input.courseId, { write: true });
      const retrieval = await retrievePassages(input.courseId, input.topic);
      const passages = retrieval.passages.slice(0, 6);
      if (!passages.length) return { courseId: input.courseId, noEvidence: 'No hay material del curso sobre ese tema. Sube o publica material antes de generar preguntas.' };
      return { courseId: input.courseId, data: { topic: input.topic, count: input.count }, passages, sources: sourceList(passages) };
    },
    system: 'Eres un diseñador de evaluaciones. Creas preguntas claras, con una sola opción correcta y distractores plausibles, basadas solo en las fuentes.',
    prompt: ({ data, passages }) => `${sourcesBlock(passages)}\n<dato>Tema: ${asData(data.topic)}</dato>\nGenera ${data.count} preguntas. Formato: {"questions":[{"prompt":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"...","citations":["S1"]}]}`,
    outputSchema: z.object({
      questions: z.array(z.object({
        prompt: z.string().min(3).max(500),
        options: z.array(z.string().min(1).max(200)).min(2).max(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().max(600).default(''),
        citations: z.array(z.string()).default([]),
      })).min(1).max(8),
    }),
    // Se descartan preguntas sin cita válida o con índice fuera de rango; si no queda ninguna, no hay respaldo.
    finalize: (result, { passages }) => {
      const questions = result.questions
        .map((question) => ({ ...question, citations: validCitations(question.citations, passages) }))
        .filter((question) => question.citations.length && question.correctIndex < question.options.length);
      return questions.length ? { questions } : { noEvidence: 'Ninguna pregunta propuesta citaba una fuente entregada, así que no se muestran. Prueba con un tema más concreto.' };
    },
  },

  // 3. Borrador de retroalimentación para una entrega (el docente decide la nota).
  feedback_assistant: {
    key: 'feedback_assistant',
    name: 'Asistente de retroalimentación',
    purpose: 'Redacta un borrador de retroalimentación para una entrega según las instrucciones de la tarea; el docente lo revisa y califica.',
    roles: ['teacher', 'institution_admin'],
    inputs: ['Entrega'],
    provider: PROVIDER,
    privacy: 'Envía las instrucciones y el texto de la entrega con cédulas, teléfonos, correos y enlaces ocultos; nunca el nombre ni el correo de la cuenta del estudiante.',
    inputSchema: z.object({ submissionId: id }),
    async buildContext(user, input) {
      const submission = await AssignmentSubmission.findByPk(input.submissionId);
      if (!submission) throw notFound('Entrega no encontrada.');
      const assignment = await Assignment.findByPk(submission.assignmentId);
      await getCourseAccess(user, assignment.courseId, { write: true });
      return {
        courseId: assignment.courseId,
        // El enlace de la entrega no se envía: solo se indica que existe.
        data: { title: assignment.title, instructions: assignment.instructions, maxPoints: assignment.maxPoints, body: redactPersonalData(submission.body), hasLink: Boolean(submission.linkUrl) },
      };
    },
    system: 'Eres un docente que da retroalimentación formativa: específica, respetuosa y accionable. Sugieres una nota orientativa, nunca definitiva.',
    prompt: ({ data }) => `<dato>Tarea: ${asData(data.title)}\nInstrucciones: ${asData(data.instructions)}\nPuntaje máximo: ${data.maxPoints}</dato>\n<dato>Entrega del estudiante:\n${asData(data.body)}${data.hasLink ? '\n(La entrega incluye un enlace que el docente revisa directamente.)' : ''}</dato>\nFormato: {"strengths":["..."],"improvements":["..."],"feedback":"texto para el estudiante","suggestedPoints":0}`,
    outputSchema: z.object({
      strengths: z.array(z.string().max(300)).max(5),
      improvements: z.array(z.string().max(300)).max(5),
      feedback: z.string().min(10).max(2000),
      suggestedPoints: z.number().min(0),
    }),
    finalize: (result, { data }) => ({ ...result, suggestedPoints: Math.min(Math.round(result.suggestedPoints), data.maxPoints), maxPoints: data.maxPoints }),
  },

  // 4. Analista del curso: informe en lenguaje natural con datos agregados.
  course_analyst: {
    key: 'course_analyst',
    name: 'Analista del curso',
    purpose: 'Interpreta las estadísticas del curso (evaluaciones, temas y participación) y redacta un informe con recomendaciones.',
    roles: ['teacher', 'institution_admin'],
    inputs: ['Curso'],
    provider: PROVIDER,
    privacy: 'Solo envía datos agregados; los estudiantes se identifican como «Estudiante 1, 2…».',
    inputSchema: z.object({ courseId: id }),
    async buildContext(user, input) {
      const analytics = await getCourseAnalytics(user, input.courseId);
      // Se reemplazan los nombres por etiquetas antes de salir del servidor.
      const students = (analytics.students || []).map((student, index) => ({
        label: `Estudiante ${index + 1}`, submittedAttempts: Number(student.submittedAttempts || 0),
        averageScorePct: student.averageScorePct === null ? null : Number(student.averageScorePct),
      }));
      return { courseId: input.courseId, data: { assessments: analytics.assessments, topics: analytics.topics, students } };
    },
    system: 'Eres un analista educativo. Interpretas números con prudencia, señalas temas débiles y propones acciones concretas para el docente.',
    prompt: ({ data }) => `<dato>${asData(JSON.stringify(data))}</dato>\nFormato: {"summary":"...","highlights":["..."],"risks":["..."],"recommendations":["..."]}`,
    outputSchema: z.object({
      summary: z.string().min(10).max(1500),
      highlights: z.array(z.string().max(300)).max(6),
      risks: z.array(z.string().max(300)).max(6),
      recommendations: z.array(z.string().max(300)).max(6),
    }),
  },

  // 5. Asistente de cumplimiento: revisa un texto frente a la política de privacidad.
  compliance_checker: {
    key: 'compliance_checker',
    name: 'Asistente de cumplimiento',
    purpose: 'Revisa un texto (material, anuncio o comunicado) y señala datos personales o usos que contradigan la política de privacidad.',
    roles: ['teacher', 'institution_admin', 'auditor'],
    inputs: ['Texto a revisar'],
    provider: PROVIDER,
    privacy: 'Detecta en el servidor cédulas, teléfonos y correos y los reemplaza por etiquetas antes de enviar el texto: el proveedor recibe el texto sin esos datos.',
    inputSchema: z.object({ text: z.string().trim().min(20).max(12000) }),
    async buildContext(user, input) {
      // El modelo recibe el texto ya sin los datos detectados; los hallazgos viajan solo como tipo y muestra enmascarada.
      return { data: { text: redactPersonalData(input.text, { links: false }) }, findings: detectPersonalData(input.text) };
    },
    system: 'Eres un oficial de cumplimiento de la Ley 8968 de Costa Rica. Detectas datos personales y sensibles y explicas el riesgo y cómo corregirlo.',
    prompt: ({ data, findings }) => `<dato>Hallazgos automáticos: ${asData(JSON.stringify(findings))}</dato>\n<dato>Texto:\n${asData(data.text)}</dato>\nFormato: {"riskLevel":"bajo|medio|alto","issues":[{"type":"...","detail":"...","fix":"..."}],"summary":"..."}`,
    outputSchema: z.object({
      riskLevel: z.enum(['bajo', 'medio', 'alto']),
      issues: z.array(z.object({ type: z.string().max(80), detail: z.string().max(400), fix: z.string().max(400) })).max(10),
      summary: z.string().min(5).max(1000),
    }),
    finalize: (result, { findings }) => ({ ...result, automaticFindings: findings }),
  },

  // 6. Redactor de anuncios y piezas de comunicación.
  announcement_writer: {
    key: 'announcement_writer',
    name: 'Redactor de anuncios',
    purpose: 'Redacta anuncios para el curso o publicaciones breves para redes a partir de una indicación del docente.',
    roles: ['teacher', 'institution_admin'],
    inputs: ['Curso', 'Indicación', 'Tono', 'Formato'],
    provider: PROVIDER,
    privacy: 'Envía la indicación (con cédulas, teléfonos y correos ocultos) y el nombre del curso.',
    inputSchema: z.object({
      courseId: id,
      brief: z.string().trim().min(10).max(1000),
      tone: z.enum(['cercano', 'formal', 'motivador']).default('cercano'),
      format: z.enum(['anuncio', 'redes']).default('anuncio'),
    }),
    async buildContext(user, input) {
      const { course } = await getCourseAccess(user, input.courseId, { write: true });
      return { courseId: course.id, data: { course: course.title, ...input, brief: redactPersonalData(input.brief, { links: false }) } };
    },
    system: 'Eres un redactor educativo. Escribes textos breves, claros e inclusivos, sin inventar fechas ni datos que no estén en la indicación.',
    prompt: ({ data }) => `<dato>Curso: ${asData(data.course)}\nIndicación: ${asData(data.brief)}\nTono: ${data.tone}\nFormato: ${data.format === 'redes' ? 'publicación para redes (máximo 280 caracteres) con 2 o 3 etiquetas' : 'anuncio para el curso'}</dato>\nFormato: {"title":"...","body":"...","hashtags":["..."]}`,
    outputSchema: z.object({ title: z.string().min(3).max(180), body: z.string().min(10).max(3000), hashtags: z.array(z.string().max(40)).max(5).default([]) }),
  },

  // 7. Coach de estudio: plan del día con los datos propios del estudiante.
  study_coach: {
    key: 'study_coach',
    name: 'Coach de estudio',
    purpose: 'Arma un plan para hoy según tu dominio por tema, tus tareas pendientes y tu racha, con un mensaje de motivación.',
    roles: ['student'],
    inputs: ['Curso', 'Minutos disponibles'],
    provider: PROVIDER,
    privacy: 'Usa solo tus propios datos del curso; no envía tu nombre ni tu correo.',
    inputSchema: z.object({ courseId: id, minutes: z.coerce.number().int().min(10).max(240).default(30) }),
    async buildContext(user, input) {
      const { course } = await getCourseAccess(user, input.courseId);
      const topics = await Topic.findAll({ where: { courseId: course.id }, attributes: ['id', 'title'] });
      const mastery = await TopicMastery.findAll({ where: { studentId: user.id, topicId: topics.map((topic) => topic.id) } });
      const assignments = await Assignment.findAll({
        where: { courseId: course.id, status: 'published' }, attributes: ['id', 'title', 'dueAt'],
        include: [{ model: AssignmentSubmission, as: 'submissions', required: false, where: { studentId: user.id }, attributes: ['id'] }],
      });
      const streak = await CourseStreak.findOne({ where: { courseId: course.id, studentId: user.id } });
      return {
        courseId: course.id,
        data: {
          course: course.title,
          minutes: input.minutes,
          topics: topics.map((topic) => ({ title: topic.title, mastery: Number(mastery.find((row) => row.topicId === topic.id)?.masteryScore ?? 0) })),
          pending: assignments.filter((row) => !row.submissions.length).map((row) => ({ title: row.title, dueAt: row.dueAt })),
          streak: streakView(streak, dayKey()),
        },
      };
    },
    system: 'Eres un coach de estudio amable y concreto. Priorizas temas con menor dominio y entregas cercanas, y respetas el tiempo disponible.',
    prompt: ({ data }) => `<dato>${asData(JSON.stringify(data))}</dato>\nLa suma de los minutos del plan no puede superar ${data.minutes}.\nFormato: {"plan":[{"minutes":10,"activity":"...","why":"..."}],"motivation":"..."}`,
    outputSchema: z.object({
      plan: z.array(z.object({ minutes: z.number().int().min(1).max(240), activity: z.string().max(300), why: z.string().max(300) })).min(1).max(8),
      motivation: z.string().max(500),
    }),
    // El modelo puede pasarse del tiempo disponible: el servidor recorta el plan para que la suma nunca lo supere.
    finalize: (result, { data }) => fitPlanToBudget(result, data.minutes),
  },

  // 8. Resumen de lección con preguntas de autoevaluación.
  lesson_summarizer: {
    key: 'lesson_summarizer',
    name: 'Resumen de lección',
    purpose: 'Resume una lección en ideas clave y propone preguntas para autoevaluarte, solo con el contenido de la lección.',
    roles: ['student', 'teacher'],
    inputs: ['Lección'],
    provider: PROVIDER,
    privacy: 'Envía solo el contenido de la lección.',
    inputSchema: z.object({ lessonId: id }),
    async buildContext(user, input) {
      const lesson = await Lesson.findByPk(input.lessonId);
      if (!lesson) throw notFound('Lección no encontrada.');
      const { canEdit } = await getCourseAccess(user, lesson.courseId);
      if (!canEdit && lesson.status !== 'published') throw forbidden('La lección no está publicada.');
      if (!lesson.bodyMd || lesson.bodyMd.trim().length < 80) return { courseId: lesson.courseId, noEvidence: 'La lección tiene muy poco contenido para resumir.' };
      return { courseId: lesson.courseId, data: { title: lesson.title, body: lesson.bodyMd.slice(0, 20000) } };
    },
    system: 'Eres un tutor que sintetiza. Resumes con fidelidad a la lección, sin agregar información externa.',
    prompt: ({ data }) => `<fuente id="S1" titulo="${asData(data.title)}">\n${asData(data.body)}\n</fuente>\nFormato: {"summary":"...","keyPoints":["..."],"selfCheck":[{"question":"...","answer":"..."}]}`,
    outputSchema: z.object({
      summary: z.string().min(20).max(1500),
      keyPoints: z.array(z.string().max(300)).min(1).max(8),
      selfCheck: z.array(z.object({ question: z.string().max(300), answer: z.string().max(500) })).max(5),
    }),
  },
};

export { detectPersonalData };

// Recorta un plan de estudio al tiempo disponible: conserva el orden propuesto, acorta la actividad que
// cruza el límite si le quedan al menos 5 minutos y descarta el resto. Informa si hubo ajuste.
export function fitPlanToBudget(result, budget) {
  const plan = [];
  let used = 0;
  for (const item of result.plan) {
    const left = budget - used;
    if (left <= 0) break;
    if (item.minutes <= left) {
      plan.push(item);
      used += item.minutes;
    } else if (left >= 5 || plan.length === 0) {
      plan.push({ ...item, minutes: left });
      used += left;
    }
  }
  const proposed = result.plan.reduce((total, item) => total + item.minutes, 0);
  return { ...result, plan, totalMinutes: used, budgetMinutes: budget, adjusted: proposed > budget };
}
