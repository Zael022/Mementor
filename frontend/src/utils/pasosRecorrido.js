// Pasos del recorrido guiado: qué señala cada uno y cómo esa función ayuda a estudiar.
// «seccion» cambia de pestaña en la página del curso antes de buscar el elemento.

export const RECORRIDO_INICIO = [
  {
    objetivo: '[data-recorrido="clases"]',
    titulo: 'Tus clases',
    texto: 'Cada tarjeta muestra tu rango de avance y cuántas lecciones llevas. De un vistazo sabes en qué curso te falta más y en cuál vas al día.',
  },
  {
    objetivo: '[data-recorrido="vence-pronto"]',
    titulo: 'Lo que vence pronto',
    texto: 'Las entregas más cercanas aparecen primero. Planificar con tiempo evita estudiar todo la noche antes.',
  },
  {
    objetivo: '[data-recorrido="clases"] a',
    titulo: 'Entra a una clase',
    texto: 'Dentro de cada clase está el resto: el mapa, la práctica diaria, Parejas y el tutor. Abre el curso de prueba para seguir el recorrido.',
  },
];

export const RECORRIDO_CURSO = [
  {
    objetivo: '.banner-clase .banner-rango',
    titulo: 'Tu rango de avance',
    texto: 'Cuenta lecciones completadas y tareas entregadas, y te dice cuánto falta para el siguiente rango. No es tu nota: mide cuánto avanzaste, para que veas el progreso aunque cueste.',
  },
  {
    objetivo: '[data-recorrido="pestanas"]',
    titulo: 'Todo el curso en un solo lugar',
    texto: 'Novedades, trabajo en clase, quizzes, calificaciones y compañeros, como en un aula. Nada queda perdido en correos o chats.',
  },
  {
    seccion: 'novedades',
    objetivo: '[data-recorrido="proximas"]',
    titulo: 'Próximas entregas y anuncios',
    texto: 'Lo que vence pronto y lo que avisa tu docente, juntos. Así organizas la semana antes de que algo te tome por sorpresa.',
  },
  {
    seccion: 'trabajo',
    objetivo: '.mapa',
    titulo: 'El mapa del curso',
    texto: 'Cada parada es una lección o tarea real, en orden. Orbi te espera en la siguiente: siempre sabes por dónde seguir, sin perder tiempo decidiendo.',
  },
  {
    seccion: 'trabajo',
    objetivo: '.bloque-trabajo .destacada',
    titulo: 'Recomendaciones para ti',
    texto: 'Según tu dominio de cada tema, te sugiere qué repasar o qué tema sigue, y te explica por qué. Estudias lo que más te sirve, no todo a la vez.',
  },
  {
    seccion: 'trabajo',
    objetivo: '.mapa a[href*="/parejas/"]',
    titulo: 'Parejas',
    texto: 'Un juego de memoria con preguntas de evaluaciones que ya hiciste. Recordar una respuesta (en vez de releerla) es de las formas que más ayudan a fijarla, y no afecta tu nota.',
  },
  {
    seccion: 'quizzes',
    objetivo: '.tarjeta-racha',
    titulo: 'Práctica diaria y racha',
    texto: 'Unas pocas preguntas cada día. Repasar un poco seguido funciona mejor que estudiar mucho de golpe, y la racha te ayuda a no cortar el hábito.',
  },
  {
    seccion: 'quizzes',
    objetivo: '.tarjeta-quiz',
    titulo: 'Quiz con bono',
    texto: 'Preguntas rápidas con tiempo para practicar con un poco de reto. Si aciertas todo, ganas un bono para tu nota.',
  },
  {
    seccion: 'calificaciones',
    objetivo: '.nota-curso',
    titulo: 'Tu nota, explicada',
    texto: 'Ves de dónde sale tu nota (evaluaciones, tareas, trabajo en clase y bonos) y la retroalimentación de tu docente. Sabes qué mejorar, no solo un número.',
  },
  {
    objetivo: '[data-recorrido="tutor"]',
    titulo: 'Tutor IA con fuentes',
    texto: 'Pregúntale tus dudas: responde con el material del curso y cita de dónde sale. Si el material no lo cubre, te lo dice en vez de inventar. ¡Listo! Ya puedes explorar a tu ritmo.',
  },
];
