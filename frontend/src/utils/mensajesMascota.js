// Textos de Orbi y Pausa en un solo lugar para revisarlos fácilmente.
// Reglas: cortos, en español claro, con datos reales y sin culpa, amenazas ni urgencias falsas.

// Días sin actividad de aprendizaje a partir de los cuales Pausa da la bienvenida de regreso.
export const UMBRAL_DIAS_REGRESO = 7;

const plural = (cantidad, uno, varios) => `${cantidad} ${cantidad === 1 ? uno : varios}`;

// Qué falta para el siguiente rango, con las mismas cuentas del servidor.
export function mensajeRango(rango) {
  if (!rango || rango.total === 0) return 'Cuando tu docente publique lecciones, aquí verás tu avance.';
  if (!rango.next) return '¡Recorrido completo! Llegaste a Constelación.';
  const pasos = rango.assignments?.total > 0
    ? plural(rango.next.remaining, 'lección o tarea', 'lecciones o tareas')
    : plural(rango.next.remaining, 'lección', 'lecciones');
  return `Te ${rango.next.remaining === 1 ? 'falta' : 'faltan'} ${pasos} para ${rango.next.name}.`;
}

export const mensajeSubida = (rango) => `¡Subiste a ${rango.name}!`;
export const mensajeModuloTerminado = (titulo) => `¡Terminaste el módulo «${titulo}»!`;
export const MENSAJE_LECCION_COMPLETADA = '¡Lección completada! Sigue cuando quieras.';
export const MENSAJE_TAREA_ENTREGADA = 'Tarea entregada. ¡Buen trabajo!';

// Mapa del curso.
export const MENSAJE_MAPA_SIGUIENTE = 'Aquí seguimos.';
export const MENSAJE_MAPA_COMPLETO = '¡Recorriste todas las paradas!';

// Parejas.
export const MENSAJES_PAREJAS = {
  inicio: 'Voltea dos cartas: una pregunta y su respuesta.',
  acierto: '¡Pareja encontrada!',
  fallo: 'Casi. Mira bien y prueba otra vez.',
  final: (parejas, intentos) => `¡Encontraste las ${parejas} parejas en ${plural(intentos, 'intento', 'intentos')}!`,
};

// Pausa: regreso y estados tranquilos.
export const MENSAJE_PORTADA = '¡Hola! Qué bueno verte por aquí.';
export const MENSAJE_REGRESO = '¡Qué bueno verte! Seguimos donde lo dejaste.';
export const MENSAJE_RITMO = 'Aprende a tu ritmo.';
export const mensajeMovimiento = (reducido) => (reducido
  ? 'Listo: Orbi y Pausa se quedan quietos y no hay confeti.'
  : 'Si el movimiento te distrae, activa «Menos movimiento». Aquí vamos a tu ritmo.');

// Tutor.
export const MENSAJE_TUTOR_PENSANDO = 'Buscando en el material del curso…';

// Racha: celebra lo logrado, nunca amenaza con perderla.
export const mensajeRacha = (dias) => `Racha de ${plural(dias, 'día', 'días')}. ¡Bien hecho!`;

// Lo que dicen Orbi y Pausa cuando alguien los toca: se recorren en orden, sin repetir seguido.
export const FRASES_TOQUE = {
  orbi: [
    '¡Hola! Soy Orbi, tu guía del curso.',
    'Cada parada del mapa te acerca a Constelación.',
    'Si algo no queda claro, el tutor responde con el material de tu curso.',
    '¡Choca esos cinco!',
    'Un paso a la vez también es avanzar.',
  ],
  pausa: [
    '¡Hola! Soy Pausa. Aquí vamos a tu ritmo.',
    'Respira hondo… y seguimos.',
    'Descansar también es parte de aprender.',
    'Un ratito cada día suma mucho.',
  ],
};
export const FRASE_DESPIERTA = 'Zzz… ¡ah, hola! Ya desperté.';
// Orbi en el mapa, al tocarlo.
export const mensajeOrbiMapa = (siguiente) => (siguiente ? `¡Vamos! Sigue «${siguiente}».` : '¡Recorriste todo el mapa! ¡Bien hecho!');
// Orbi comenta la parada que la persona mira (con el puntero o el teclado). Es decorativo: el estado ya lo dice la tarjeta.
export const FRASES_MAPA = {
  completada: '¡Esa ya la hiciste!',
  siguiente: '¡Esa es la que sigue!',
  pendiente: 'Esa viene más adelante.',
  practica: '¡Ahí practicamos con Parejas!',
  'sin-preguntas': 'Aquí habrá práctica pronto.',
  orbi: '¿Te llevo a la siguiente parada?',
  orbiCompleto: '¡Tócame y celebramos!',
};

