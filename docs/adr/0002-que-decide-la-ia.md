# ADR 0002 · Qué puede decidir la IA

**Estado:** aceptada · 2026-11-16

## Decisión
La IA **solo redacta explicaciones** a partir de fragmentos que el servidor ya autorizó. No decide nada que afecte la nota, el acceso o el contenido del curso.

| Tema | Quién decide |
| --- | --- |
| Corrección de opción múltiple, nota, dominio y recomendación | Código determinista (`assessmentService`, `utils/mastery.js`) dentro de una transacción |
| Qué fuentes existen, se publican o se retiran | Docente o administración de la institución |
| Qué fragmentos recibe el modelo | Servidor: curso de la sesión, fuentes activas, versión publicada en MySQL |
| Si una respuesta se muestra | Servidor: formato válido (Zod) y al menos una cita a un fragmento entregado |
| Qué preguntas se publican en una evaluación | Docente (los borradores generados por IA quedan como mejora futura y siempre con aprobación docente) |
| Límites de consumo | Configuración del operador y de la plataforma |

## Reglas que lo garantizan
- Sin evidencia relevante no se llama al modelo: el estudiante recibe un aviso de material insuficiente.
- Las fuentes y la pregunta se envían como datos; el prompt del sistema ordena ignorar instrucciones dentro de ellas.
- Citas inválidas se descartan; sin ninguna válida, la respuesta no se muestra.
- Un flujo interrumpido nunca se guarda como respuesta completa.
- No se usan herramientas del modelo (tool use) en esta versión.
