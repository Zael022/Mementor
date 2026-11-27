// Título de la pestaña según la sección; la primera coincidencia gana.
const TITULOS = [
  [/^\/admisiones/, 'Admisiones'],
  [/\/quizzes\/\d+$/, 'Quiz rápido'],
  [/\/racha$/, 'Práctica del día'],
  [/\/parejas\/\d+$/, 'Parejas'],
  [/\/quizzes$/, 'Quizzes'],
  [/\/calificaciones$/, 'Calificaciones'],
  [/^\/calendario$/, 'Calendario'],
  [/^\/pendientes$/, 'Pendientes'],
  [/^\/configuracion$/, 'Configuración'],
  [/gobernanza$/, 'Gobernanza de datos'],
  [/bitacora$/, 'Bitácora'],
  [/^\/asistentes$/, 'Asistentes de IA'],
  [/\/tutor\//, 'Tutor'],
  [/\/citas\//, 'Fuente citada'],
  [/\/contenidos$/, 'Trabajo en clase'],
  [/\/clases$/, 'Clases en vivo'],
  [/\/tareas(\/|$)/, 'Tareas'],
  [/\/evaluaciones(\/|$)/, 'Evaluaciones'],
  [/\/resultados\//, 'Resultado'],
  [/\/anuncios$/, 'Novedades'],
  [/\/fuentes$/, 'Fuentes del tutor'],
  [/\/matriculas$/, 'Personas'],
  [/\/analitica$/, 'Analítica'],
  [/\/lecciones\//, 'Lección'],
  [/\/cursos/, 'Cursos'],
  [/\/progreso$/, 'Mi progreso'],
  [/\/inicio$/, 'Inicio'],
  [/\/usuarios$/, 'Usuarios'],
  [/\/drive$/, 'Google Drive'],
  [/\/consumo$/, 'Consumo de IA'],
  [/\/auditoria$/, 'Auditoría'],
  [/\/instituciones$/, 'Instituciones'],
];

export function tituloDe(ruta) {
  const encontrado = TITULOS.find(([patron]) => patron.test(ruta));
  return encontrado ? `${encontrado[1]} · MENTOR IA` : 'MENTOR IA';
}
