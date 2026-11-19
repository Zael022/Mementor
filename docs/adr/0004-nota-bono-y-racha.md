# ADR 0004 — Nota del curso, bono por quizzes y racha diaria

Fecha: 2026-11-19 · Estado: aceptada

## Contexto
Se pidió un juego de preguntas para el estudiante en el que cada quiz correcto suma 0,1 a la nota, y una racha diaria en la que cada día suma (0,09). También se pidió que cada curso tenga una nota donde el docente califica tareas y trabajo en clase. Antes no existía una nota final del curso.

## Decisión
- La nota final usa una escala de 0 a 10 y combina evaluaciones, tareas y trabajo en clase con pesos que fija el docente (deben sumar 100). Una parte sin calificaciones no cuenta y su peso se reparte entre las demás, para no castigar lo que todavía no se ha evaluado.
- El bono se guarda como eventos en `grade_bonus_events`, con un índice único (curso, estudiante, tipo, referencia). Así un quiz o un día solo suman una vez, aunque lleguen dos solicitudes a la vez, y cada punto se puede auditar. El valor del evento se fija cuando se gana.
- El tope del bono lo fija el docente y se aplica al calcular; la nota nunca pasa de 10.
- El quiz se corrige en el servidor: guarda cuándo mostró cada pregunta y mide el tiempo con su propio reloj. La clave de respuestas solo sale después de responder.
- La práctica diaria toma preguntas de los quizzes publicados. Cuenta responder, no acertar, para premiar la constancia. El día se decide con `APP_TIMEZONE`.
- Una racha rota vuelve a 1, pero lo ya ganado no se pierde.

## Consecuencias
- La nota se calcula al consultarla, así que siempre refleja las calificaciones vigentes.
- Si el docente cambia el valor del bono, el cambio aplica a lo que se gane desde ese momento.
- Si la institución usa otra escala (por ejemplo, de 0 a 100), basta cambiar `GRADE_SCALE` y los valores del bono.
