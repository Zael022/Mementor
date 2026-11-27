// Contenido del curso de prueba (ADR 0011). Solo se usa con DEMO_MODE encendido.
// Cada pregunta guarda su respuesta correcta en «correcta» para que la simulación responda como una persona.

export const DEMO_COURSE = {
  code: 'PRUEBA-MAT7',
  title: 'Matemática 7° · curso de prueba',
  description: 'Curso de ejemplo para recorrer MENTOR AI: fracciones, decimales, ángulos y triángulos. Tiene actividad simulada para ver cómo cada función ayuda a estudiar.',
};

const leccion = (title, bodyMd) => ({ title, bodyMd });

export const DEMO_MODULES = [
  {
    title: 'Números',
    topics: [
      {
        key: 'fracciones',
        title: 'Fracciones',
        learningObjective: 'Representar, comparar y sumar fracciones con denominadores iguales y distintos.',
        lessons: [
          leccion('¿Qué es una fracción?', `# ¿Qué es una fracción?

Una **fracción** indica cuántas partes iguales tomamos de un entero.

- El número de abajo es el **denominador**: dice en cuántas partes iguales se divide el entero.
- El número de arriba es el **numerador**: dice cuántas de esas partes tomamos.

## Ejemplo
Una pizza cortada en 8 trozos iguales. Si comes 3, comiste **3/8** de la pizza.

## Para recordar
- Si el numerador es menor que el denominador, la fracción es menor que 1 (fracción propia).
- Si son iguales, la fracción vale exactamente 1: 8/8 es la pizza completa.

## Practica
¿Qué fracción de la semana son los días de fin de semana? (Respuesta: 2/7)`),
          leccion('Fracciones equivalentes', `# Fracciones equivalentes

Dos fracciones son **equivalentes** cuando representan la misma cantidad, aunque se escriban distinto.

## Cómo encontrarlas
Multiplica (o divide) el numerador y el denominador **por el mismo número**:

- 1/2 = 2/4 = 3/6 = 4/8
- 6/9 = 2/3 (dividimos ambos entre 3)

## Simplificar
Simplificar es dividir entre el mayor número que divide a los dos. 12/16 se simplifica a **3/4** dividiendo entre 4.

## Comprueba con el producto cruzado
a/b y c/d son equivalentes si a × d = b × c. Por ejemplo, 2/3 y 4/6: 2 × 6 = 12 y 3 × 4 = 12.`),
          leccion('Sumar fracciones', `# Sumar fracciones

## Con el mismo denominador
Se suman los numeradores y se deja el denominador: 2/7 + 3/7 = **5/7**.

## Con distinto denominador
1. Busca un denominador común (el mínimo común múltiplo es lo más cómodo).
2. Convierte cada fracción en una equivalente con ese denominador.
3. Suma los numeradores.

Ejemplo: 1/2 + 1/4. El denominador común es 4, así que 1/2 = 2/4. Entonces 2/4 + 1/4 = **3/4**.

## Error común
No se suman los denominadores: 1/2 + 1/4 **no** es 2/6.`),
        ],
      },
      {
        key: 'decimales',
        title: 'Decimales',
        learningObjective: 'Leer números decimales y convertir fracciones en decimales.',
        lessons: [
          leccion('Leer números decimales', `# Leer números decimales

Los decimales también representan partes de un entero, pero en base 10.

| Posición | Valor | Ejemplo en 3,125 |
|---|---|---|
| Décimas | 1/10 | 1 |
| Centésimas | 1/100 | 2 |
| Milésimas | 1/1000 | 5 |

**3,125** se lee «tres enteros, ciento veinticinco milésimas».

## Comparar decimales
Compara posición por posición, de izquierda a derecha: 0,7 es mayor que 0,68 porque 7 décimas es más que 6 décimas.`),
          leccion('De fracción a decimal', `# De fracción a decimal

Una fracción es una división: el numerador entre el denominador.

- 3/4 = 3 ÷ 4 = **0,75**
- 1/5 = 1 ÷ 5 = **0,2**
- 1/3 = 0,333… (decimal periódico)

## Truco con denominadores de 10, 100 o 1000
Si el denominador es 10, 100 o 1000, el decimal se escribe directo: 7/100 = 0,07.

## Para pensar
¿Por qué 1/3 nunca termina? Porque al dividir 1 entre 3 siempre sobra 1.`),
        ],
      },
    ],
  },
  {
    title: 'Geometría',
    topics: [
      {
        key: 'angulos',
        title: 'Ángulos',
        learningObjective: 'Clasificar ángulos y medirlos con el transportador.',
        lessons: [
          leccion('Tipos de ángulos', `# Tipos de ángulos

Un **ángulo** es la abertura entre dos semirrectas que comparten un punto (el vértice). Se mide en grados (°).

| Tipo | Medida |
|---|---|
| Agudo | menos de 90° |
| Recto | exactamente 90° |
| Obtuso | entre 90° y 180° |
| Llano | exactamente 180° |

## En tu entorno
La esquina de un cuaderno es un ángulo recto. Las manecillas del reloj a las 2:00 forman un ángulo agudo.`),
          leccion('Medir con el transportador', `# Medir con el transportador

1. Coloca el centro del transportador sobre el **vértice**.
2. Alinea la línea del 0° con uno de los lados.
3. Lee el número por donde pasa el otro lado, usando la escala que empieza en 0.

## Cuidado
El transportador tiene dos escalas. Si el ángulo se ve agudo y lees 130°, estás en la escala equivocada: el valor correcto es 50°.`),
        ],
      },
      {
        key: 'triangulos',
        title: 'Triángulos',
        learningObjective: 'Clasificar triángulos por sus lados y por sus ángulos.',
        lessons: [
          leccion('Clasificar triángulos', `# Clasificar triángulos

## Por sus lados
- **Equilátero:** tres lados iguales.
- **Isósceles:** dos lados iguales.
- **Escaleno:** tres lados distintos.

## Por sus ángulos
- **Acutángulo:** tres ángulos agudos.
- **Rectángulo:** un ángulo recto.
- **Obtusángulo:** un ángulo obtuso.

## Dato clave
Los ángulos interiores de cualquier triángulo suman **180°**. Si dos ángulos miden 60° y 70°, el tercero mide 50°.`),
        ],
      },
    ],
  },
];

// Prerrequisitos: para avanzar en un tema conviene dominar el anterior (alimenta las recomendaciones).
export const DEMO_PREREQUISITES = { decimales: ['fracciones'], triangulos: ['angulos'] };

const pregunta = (stem, correcta, distractores, explanation) => ({ stem, correcta, distractores, explanation });

// Evaluaciones. «Repaso de fracciones» tiene un intento: al enviarlo, su clave queda visible y alimenta Parejas.
export const DEMO_ASSESSMENTS = [
  {
    key: 'repaso-fracciones', title: 'Repaso de fracciones', topic: 'fracciones', maxAttempts: 1, passingScore: 60,
    questions: [
      pregunta('¿Qué indica el denominador de una fracción?', 'En cuántas partes iguales se divide el entero', ['Cuántas partes tomamos', 'El resultado de la división'], 'El denominador está abajo y cuenta las partes iguales del entero.'),
      pregunta('¿Cuánto es 1/2 + 1/4?', '3/4', ['2/6', '1/6'], 'Se usa el denominador común 4: 2/4 + 1/4 = 3/4.'),
      pregunta('¿Cómo se llama el número de arriba de una fracción?', 'Numerador', ['Denominador', 'Cociente'], 'El numerador indica cuántas partes se toman.'),
      pregunta('¿Qué fracción es equivalente a 1/2?', '4/8', ['2/3', '3/5'], 'Multiplicando numerador y denominador por 4: 4/8.'),
      pregunta('¿Cuál es la forma simplificada de 10/15?', '2/3', ['5/10', '1/3'], 'Se dividen ambos entre 5.'),
      pregunta('¿Cuánto es 2/7 + 3/7?', '5/7', ['5/14', '6/7'], 'Mismo denominador: se suman los numeradores.'),
    ],
  },
  {
    key: 'prueba-decimales', title: 'Prueba corta de decimales', topic: 'decimales', maxAttempts: 2, passingScore: 60,
    questions: [
      pregunta('¿Cuánto es 3/4 en decimal?', '0,75', ['0,34', '0,43'], '3 ÷ 4 = 0,75.'),
      pregunta('¿Qué número es mayor?', '0,7', ['0,68', '0,07'], '7 décimas es más que 6 décimas.'),
      pregunta('¿Cómo se escribe 7/100 en decimal?', '0,07', ['0,7', '7,100'], 'Centésimas: dos cifras después de la coma.'),
      pregunta('¿Qué tipo de decimal es 1/3?', 'Periódico', ['Exacto', 'Entero'], '1 ÷ 3 = 0,333… nunca termina.'),
    ],
  },
  {
    key: 'angulos', title: 'Comprobación de ángulos', topic: 'angulos', maxAttempts: 1, passingScore: 60,
    questions: [
      pregunta('¿Cuánto mide un ángulo recto?', '90°', ['180°', '45°'], 'Como la esquina de un cuaderno.'),
      pregunta('Un ángulo de 120° es…', 'Obtuso', ['Agudo', 'Llano'], 'Está entre 90° y 180°.'),
      pregunta('¿Dónde se coloca el centro del transportador?', 'Sobre el vértice', ['Sobre un lado', 'En cualquier punto'], 'El vértice es el punto donde se unen los lados.'),
      pregunta('Un ángulo de 180° se llama…', 'Llano', ['Recto', 'Obtuso'], 'Forma una línea recta.'),
    ],
  },
];

// Quiz con bono; sus preguntas también forman el banco de la práctica diaria.
export const DEMO_QUIZ = {
  title: 'Calentamiento de fracciones',
  secondsPerQuestion: 20,
  questions: [
    pregunta('¿Cuánto es 1/4 + 1/4?', '1/2', ['2/8', '1/8']),
    pregunta('¿Qué fracción representa la mitad?', '1/2', ['1/3', '2/1']),
    pregunta('¿Cuál es mayor: 3/5 o 2/5?', '3/5', ['2/5', 'Son iguales']),
    pregunta('¿Cuántos cuartos hay en un entero?', '4', ['2', '8']),
    pregunta('¿Cuánto es 0,5 como fracción?', '1/2', ['5/1', '1/5']),
    pregunta('Un ángulo de 30° es…', 'Agudo', ['Recto', 'Obtuso']),
  ],
};

export const DEMO_ASSIGNMENTS = [
  {
    key: 'ejercicios-fracciones', title: 'Ejercicios de fracciones', topic: 'fracciones', dueInDays: 2, maxPoints: 100,
    instructions: 'Resuelve los ejercicios 1 al 10 de la guía de fracciones y explica en una línea cómo encontraste el denominador común en los ejercicios 6 al 10.',
  },
  {
    key: 'medir-angulos', title: 'Medir ángulos en casa', topic: 'angulos', dueInDays: 5, maxPoints: 100,
    instructions: 'Busca cinco ángulos en tu casa (puertas, sillas, el reloj…), mídelos con el transportador y clasifícalos en agudo, recto u obtuso.',
  },
  {
    key: 'proyecto-final', title: 'Proyecto final: fracciones en la cocina', topic: null, dueInDays: 20, maxPoints: 100,
    instructions: 'Elige una receta, duplícala y redúcela a la mitad usando fracciones. Entrega una tabla con las cantidades y una explicación corta.',
  },
];

export const DEMO_ANNOUNCEMENT = {
  title: 'Bienvenida al curso de prueba',
  body: 'Este curso es de ejemplo y tiene actividad simulada. Recorre el mapa, juega Parejas en el módulo Números, haz la práctica de hoy para mantener la racha y revisa tus calificaciones. Si tienes una clave de IA configurada, también puedes preguntarle al tutor.',
};

// Compañeros de clase simulados (no aparecen en el acceso rápido).
export const DEMO_CLASSMATES = [
  { key: 'sofia', email: 'sofia.mora@prueba.mentorai.test', displayName: 'Sofía Mora (prueba)' },
  { key: 'diego', email: 'diego.vargas@prueba.mentorai.test', displayName: 'Diego Vargas (prueba)' },
];
