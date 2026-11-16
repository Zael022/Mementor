# ADR 0001 · Proveedor y modelo de generación

**Estado:** aceptada · 2026-11-16

## Contexto
El tutor necesita un modelo que redacte respuestas en español a partir de fragmentos autorizados del curso. MENTOR ya tenía `aiProvider.js` con dos adaptadores (Anthropic y OpenAI) elegidos por `AI_PROVIDER` y `AI_MODEL`. La entrega 3 pide streaming real.

## Decisión
- Se conservan los dos adaptadores. El modelo se elige solo por configuración (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`); el código no fija un modelo.
- **Anthropic** usa el SDK oficial `@anthropic-ai/sdk` para el streaming (`messages.stream`, cancelable con `AbortSignal`). La ruta JSON sin streaming sigue con `fetch` y la misma validación.
- **OpenAI** conserva su ruta JSON. En la ruta de streaming responde en un solo bloque (no hay streaming real con este adaptador).
- La recuperación (local o RAG Engine) es independiente del generador: cambiar de modelo no cambia qué fuentes se usan.
- Sin credenciales, la API responde `AI_NOT_CONFIGURED`; nunca se simulan respuestas.
- Claude Opus 5.5 es quien desarrolla este trabajo; el modelo que usa cada instalación lo decide su operador.

## Consecuencias
- Se requiere Node.js 22.12 o superior (lo exigen el SDK y las dependencias de Google).
- Los tokens y la latencia se registran tal como los informa el proveedor (`ai_usage_events`). Los costos no se calculan sin una tarifa verificada.
- Antes de pasar a producción hay que verificar el identificador de modelo vigente en la consola del proveedor.
