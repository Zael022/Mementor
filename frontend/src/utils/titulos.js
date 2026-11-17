// Título de la pestaña según la sección; la primera coincidencia gana.
const TITULOS = [
  [/\/tutor\//, 'Tutor'],
  [/\/citas\//, 'Fuente citada'],
  [/\/contenidos$/, 'Contenidos'],
  [/\/clases$/, 'Clases en vivo'],
  [/\/tareas(\/|$)/, 'Tareas'],
  [/\/evaluaciones(\/|$)/, 'Evaluaciones'],
  [/\/resultados\//, 'Resultado'],
  [/\/anuncios$/, 'Anuncios'],
  [/\/fuentes$/, 'Fuentes del tutor'],
  [/\/matriculas$/, 'Matrículas'],
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
  return encontrado ? `${encontrado[1]} · MENTOR AI` : 'MENTOR AI';
}
