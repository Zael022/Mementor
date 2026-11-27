// Identidad visual de cada asistente de IA: color de acento, ícono y categoría.
// El color nunca va solo: siempre acompaña al nombre y al ícono del asistente.
export const ESTILO_ASISTENTE = {
  tutor: { color: 'azul', icono: 'tutor', categoria: 'Aprender' },
  question_generator: { color: 'violeta', icono: 'preguntas', categoria: 'Evaluar' },
  feedback_assistant: { color: 'naranja', icono: 'retro', categoria: 'Evaluar' },
  course_analyst: { color: 'turquesa', icono: 'analisis', categoria: 'Analizar' },
  compliance_checker: { color: 'verde', icono: 'escudo', categoria: 'Revisar' },
  announcement_writer: { color: 'rosa', icono: 'megafono', categoria: 'Comunicar' },
  study_coach: { color: 'ambar', icono: 'meta', categoria: 'Planificar' },
  lesson_summarizer: { color: 'cian', icono: 'resumen', categoria: 'Aprender' },
  admissions_writer: { color: 'indigo', icono: 'admision', categoria: 'Comunicar' },
};

const PREDETERMINADO = { color: 'azul', icono: 'chispa', categoria: 'Asistente' };

export function estiloDe(clave) {
  return ESTILO_ASISTENTE[clave] || PREDETERMINADO;
}

// Asistentes que se usan desde su propia página (los demás abren el tutor o admisiones).
export const ASISTENTES_CON_PAGINA = [
  'question_generator', 'feedback_assistant', 'course_analyst', 'compliance_checker',
  'announcement_writer', 'study_coach', 'lesson_summarizer',
];

export const rutaAsistente = (clave) => `/asistentes/${clave}`;
