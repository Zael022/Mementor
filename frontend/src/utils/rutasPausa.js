// Rutas generales del estudiante donde Pausa puede pasear: inicio, cursos, curso (con su mapa) y Parejas.
// Nunca en evaluaciones, resultados, quizzes con bono, práctica diaria, lecciones ni el tutor.
// Archivo aparte y sin dependencias: lo usa Layout en la carga inicial.
const RUTAS_PAUSA = [
  /^\/estudiante\/inicio\/?$/,
  /^\/estudiante\/cursos\/?$/,
  /^\/estudiante\/cursos\/[^/]+\/?$/,
  /^\/estudiante\/cursos\/[^/]+\/parejas\/[^/]+\/?$/,
];
export const rutaConPausa = (ruta) => RUTAS_PAUSA.some((patron) => patron.test(ruta));
