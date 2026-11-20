# ADR 0005 — Preferencias de accesibilidad, repaso espaciado y plan de estudio

Fecha: 2026-11-20 · Estado: aceptada

## Contexto
Se pidió mejorar la personalización con los estándares actuales en cuatro frentes: preferencias de apariencia y accesibilidad, repaso espaciado, planificador de estudio (pendiente en `docs/06` y `docs/08`) y metas del estudiante. La única personalización existente era el dominio por tema (`baseline-1`) con sus recomendaciones; la configuración solo permitía cambiar el nombre.

## Decisión
**Preferencias (`user_preferences`).**
- Se guardan en la cuenta, no solo en el navegador, para que acompañen a la persona en cualquier equipo. Una copia local evita el parpadeo al abrir la página y se borra al cerrar sesión, pensando en equipos compartidos.
- El tema por defecto sigue al sistema operativo (`prefers-color-scheme`). «Menos movimiento» se suma a `prefers-reduced-motion`, nunca lo anula: si el sistema pide menos movimiento, se respeta aunque la cuenta no lo marque.
- La escala de texto usa `106,25 % × escala` en lugar de píxeles, para respetar también el tamaño de letra del navegador (WCAG 1.4.4).
- «Espaciado de lectura» aplica los mínimos de WCAG 1.4.12; «Subrayar enlaces» cubre WCAG 1.4.1. El alto contraste oscurece el naranja de las acciones a `#c2410c`, con 5,2:1 sobre blanco.
- Los colores fijos de `styles.css` pasaron a variables, para que el tema oscuro y el alto contraste cambien toda la interfaz sin duplicar reglas.

**Repaso espaciado (`topic_reviews`, `topic_review_logs`).**
- Se usa FSRS-4.5 con sus parámetros por defecto publicados y retención deseada de 0,9. Es el planificador abierto con mejor respaldo empírico en tarjetas de memoria.
- Se aplica **por tema**, no por pregunta, porque es la unidad de dominio de MENTOR. Los parámetros no están ajustados a esta plataforma: es un punto de partida, como `baseline-1`.
- La nota de repaso sale de las respuestas objetivas de cada evaluación (aciertos del tema: < 50 % otra vez, < 80 % difícil, < 100 % bien, 100 % con 3 o más preguntas fácil). Se calcula en la **misma transacción** del envío.
- El estudiante puede autoevaluarse (1–4) solo cuando el repaso ya toca o el tema no tiene historial. La autoevaluación **no cambia el dominio** ni la nota; solo mueve su fecha de repaso.
- El historial guarda el origen de cada nota (`assessment` o `self`), para poder ajustar los parámetros más adelante con datos reales.

**Plan de estudio (`study_plans`, `study_plan_items`).**
- Es determinista (`planner-1`): tema sin evidencia → aprender, 45 min; dominio < 0,60 → reforzar, 40 min; < 0,85 o menos de 3 evidencias → practicar, 25 min. Un tema dominado con repaso antes de la fecha objetivo recibe un repaso de 15 min.
- El orden es topológico (un tema nunca va antes que sus prerrequisitos). Entre los temas disponibles va primero el refuerzo, luego la práctica y por último lo nuevo.
- No se supera nunca el tiempo por día. Lo que no cabe se informa (`unscheduledMinutes`) en lugar de crear un calendario imposible.
- La zona horaria la elige el estudiante (preferencia o valor explícito del formulario); el servidor nunca la supone.
- Un plan nuevo archiva el anterior. Cada sesión se puede marcar como hecha, omitir o mover dentro del rango del plan.

**Metas.**
- La práctica diaria puede tener 5, 10 o 15 preguntas. El mínimo de 5 de la racha no cambia, ni el bono por día.
- El cambio se aplica desde la práctica del día siguiente, porque la de hoy ya tiene sus preguntas fijadas.
- Los minutos diarios son el valor inicial del plan.

## Consecuencias
- Las rutas del plan cuelgan del curso (`/courses/:courseId/study-plan`), no de `/me/study-plans` como preveía `docs/07`: el plan pertenece a un curso y así la autorización por curso queda en la ruta, como en el resto de la API. `docs/07` ya está actualizado.
- No se agregó dificultad por pregunta: las preguntas no tienen ese dato, así que la práctica no se adapta por dificultad. Se puede agregar cuando el banco tenga dificultad calibrada.
- Los repasos solo se generan con evaluaciones: las preguntas de los quizzes y de la práctica diaria no están ligadas a temas.
- La probabilidad de recordar que se muestra es una estimación del modelo y así se indica en la interfaz; no es una calificación.
- No se afirma eficacia educativa sin una evaluación empírica (`docs/08`).
