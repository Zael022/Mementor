// Frases de Pausa paseante (Parte A). Van aparte de mensajesMascota.js para cargarse solo con Pausa paseante,
// no en la carga inicial de la app.
// Datos curiosos aprobados por Daisy (2026-11-27). Cada uno lleva su fuente para revisarlo.
// No se repiten hasta agotar la lista (utils/pausaPaseante.js).
export const FRASES_PAUSA_CURIOSIDAD = [
  // Perezosos
  'Los perezosos bajamos del árbol más o menos una vez por semana… para ir al baño.', // WWF; Sloth Conservation Foundation
  'En mi pelaje crecen algas: me pintan de verde y me ayudan a esconderme entre las hojas.', // Smithsonian National Zoo; WWF
  'En el pelo de los perezosos vive una polilla que no vive en ningún otro lugar.', // Smithsonian National Zoo
  'Somos buenos nadadores, aunque no lo parezca.', // Lonely Planet; National Geographic
  'En la naturaleza dormimos unas 9 o 10 horas, no 20. Eso de dormir todo el día pasa en los zoológicos.', // Instituto Max Planck (Rattenborg y otros, 2008)
  'El perezoso de tres dedos puede girar la cabeza unos 270 grados, gracias a unas vértebras extra en el cuello.', // National Geographic
  'Un perezoso avanza, en promedio, unos 37 metros al día.', // WWF (41 yardas)
  'Los perezosos «de dos dedos» tienen tres dedos en las patas de atrás. Solo las manos tienen dos.', // IFLScience
  'Digerir una sola hoja puede tomarnos hasta un mes.', // IFLScience
  // Costa Rica
  'Desde 2021, el perezoso es símbolo nacional de Costa Rica, por la Ley 10.007.', // Presidencia de la República, CP-984-2021
  'En Costa Rica viven dos especies de perezoso: el de dos dedos (Choloepus hoffmanni) y el de tres (Bradypus variegatus).', // Universidad Nacional (UNA)
  'Los otros animales que son símbolo nacional son el yigüirro, el venado cola blanca y el manatí.', // Presidencia de la República, 2021
  'Costa Rica ocupa apenas el 0,03 % de la superficie terrestre, pero alberga cerca del 6 % de la biodiversidad del planeta.', // PNUD y MINAE
  'Más de una cuarta parte del territorio de Costa Rica es área protegida.', // Sexto Informe Nacional de Biodiversidad (26,51 %)
  'Costa Rica abolió su ejército en 1948, y la Constitución lo prohíbe como institución permanente.', // Constitución Política, artículo 12
  // Aprender (Dunlosky y otros, 2013: revisión de 10 técnicas de estudio)
  'Ponerte a prueba, con Parejas o la práctica diaria, te ayuda a recordar más que releer.',
  'Estudiar un poco en varios días funciona mejor que todo de golpe la noche antes.',
  'Subrayar y releer se sienten útiles, pero ayudan poco a recordar. Mejor pregúntate qué sabes.',
  'Explicarte por qué una respuesta es correcta también ayuda a aprender.',
  'Mezclar distintos tipos de ejercicios en una misma práctica te prepara mejor para el examen.',
];

// Molestia por niveles: humor amable, sin culpa. El nivel 3 se tapa la cara y se aleja.
export const FRASES_PAUSA_MOLESTIA = {
  1: ['Oye… estaba descansando.', 'Con calma, que yo voy despacito.'],
  2: ['Ya entendí que quieres jugar… pero dame un respiro.', 'Un perezoso necesita su tiempo, ¿eh?'],
  3: ['Me voy a descansar a otra rama un ratito.'],
};
export const FRASES_PAUSA_CARICIA = ['Mmm… qué rico.', 'Gracias, eso me pone de buen humor.', 'Me encanta que me rasquen la cabeza.'];
export const FRASE_PAUSA_SIESTA = 'Zzz… qué siesta tan buena.';
