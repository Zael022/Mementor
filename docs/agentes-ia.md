# Agentes de inteligencia artificial de MENTOR AI

Los 8 agentes viven en `backend/src/services/agents/` (el tutor, en `tutorService.js`). Todos comparten estas reglas:
- Cada agente vuelve a comprobar en el servidor el rol, la institución y el acceso al curso o recurso.
- El material del curso entra al modelo como dato (`asData`), nunca como instrucción.
- La respuesta del modelo debe ser JSON y se valida con Zod antes de mostrarse.
- Si falta material del curso, el agente no llama al modelo y lo dice. Si no hay clave de IA, responde con un error claro (503).
- Antes de mostrarse, la salida pasa por los guardrails (`src/utils/outputGuard.js`). Si no pasa, la persona recibe un mensaje claro y nunca el contenido.
- Cada ejecución queda en la tabla `agent_runs`, sin el contenido. Se registran:
  - el agente, la persona, el curso y el resultado;
  - la versión del prompt, el nivel y el modelo;
  - si vino de la caché y el resultado de los guardrails;
  - los tokens y la latencia.
- Límite diario por persona: `AGENT_DAILY_LIMIT_PER_USER` (30 por defecto). Las respuestas servidas desde la caché no cuentan. El tutor tiene su propia cuota.

**Modelo o proveedor:** `AI_PROVIDER` (Anthropic Claude por defecto; también un servicio compatible con OpenAI). El modelo lo elige el router según la tarea:
- `AI_MODEL_RAPIDO` para anuncios, resúmenes, Coach y analista;
- `AI_MODEL_AVANZADO` para el tutor, la retroalimentación, el generador de preguntas y cumplimiento.

Si una de esas variables falta, se usa `AI_MODEL`. `AI_TIER_<AGENTE>=rapido|avanzado` reasigna un agente (ADR 0009).

**Prompts:** todos están en `backend/src/prompts/`, con versión. Ver «Antes de cambiar un prompt».

| # | Agente (clave) | Objetivo | Rol que lo usa | Entradas | Resultado | Protección de datos personales |
| --- | --- | --- | --- | --- | --- | --- |
<!-- Modelo y guardrails de salida de cada agente: tabla «Router y guardrails» más abajo. -->
| 1 | Tutor del curso (`tutor`) | Responder dudas con el material autorizado del curso, citando cada fuente | Estudiante (y docente para probar) | Curso de la sesión y pregunta | Respuesta en vivo con citas verificables | No envía nombre ni correo; sin evidencia no llama al modelo |
| 2 | Generador de preguntas (`question_generator`) | Proponer preguntas de opción múltiple para quizzes | Docente, administración | Curso, tema, cantidad (1 a 8) | Preguntas con la respuesta correcta, una explicación y la cita; se pueden convertir en un quiz en borrador | Solo usa material del curso; descarta las preguntas sin cita válida |
| 3 | Asistente de retroalimentación (`feedback_assistant`) | Borrador de retroalimentación para una entrega | Docente, administración | Entrega | Fortalezas, mejoras, texto para el estudiante y una nota orientativa (nunca mayor que el máximo) | No envía el nombre ni el correo del estudiante; la nota la decide el docente |
| 4 | Analista del curso (`course_analyst`) | Informe en lenguaje natural de las estadísticas del curso | Docente, administración | Curso | Resumen, puntos destacados, riesgos y recomendaciones | Solo datos agregados; los nombres se cambian por «Estudiante 1, 2…» |
| 5 | Asistente de cumplimiento (`compliance_checker`) | Revisar un texto frente a la política de privacidad (Ley 8968) | Docente, administración, auditoría | Texto | Nivel de riesgo, hallazgos y cómo corregirlos | Detecta en el servidor cédulas, teléfonos y correos y los muestra enmascarados |
| 6 | Redactor de anuncios (`announcement_writer`) | Generar anuncios o publicaciones para redes | Docente, administración | Curso, indicación, tono, formato | Título, texto y etiquetas; se puede publicar como anuncio | Envía solo la indicación y el nombre del curso |
| 7 | Coach de estudio (`study_coach`) | Plan de estudio para hoy | Estudiante | Curso, minutos disponibles | Pasos con minutos y motivo, y un mensaje de motivación | Usa solo los datos propios del estudiante, sin nombre ni correo |
| 8 | Resumen de lección (`lesson_summarizer`) | Sintetizar una lección y proponer autoevaluación | Estudiante, docente | Lección | Resumen, ideas clave y preguntas con su respuesta | Solo el contenido de una lección que la persona puede ver |

## Router y guardrails por agente
| Agente | Modelo | Guardrails de salida (bloquean) | Solo alerta | Caché |
| --- | --- | --- | --- | --- |
| Tutor | Avanzado | Citas válidas, `claimCheck` y datos personales que no vienen de las fuentes. Con una pregunta de evaluación abierta, solo pistas y nunca la clave | Inyección en la pregunta o en el material | Nunca |
| Generador de preguntas | Avanzado | Datos personales y enlaces externos. Descarta las preguntas sin cita válida o con una explicación que la fuente no respalda | Inyección en el material | No (el docente espera preguntas nuevas) |
| Retroalimentación | Avanzado | Datos personales y enlaces externos. La nota sugerida queda entre 0 y el máximo | Inyección en la entrega | No (entrada personal) |
| Analista | Rápido | Datos personales y enlaces externos | Cifras que no están en los datos | No |
| Cumplimiento | Avanzado | Datos personales que se ocultaron en la entrada | Inyección en el texto | No (entrada personal) |
| Anuncios | Rápido | Datos personales, enlaces externos, cifras o fechas que no están en la indicación, y tema ajeno | Inyección en la indicación | No (entrada personal) |
| Coach | Rápido | Datos personales y enlaces externos | Cifras que no están en los datos | No (datos propios) |
| Resumen de lección | Rápido | Datos personales, enlaces externos y cifras o negaciones que la lección no respalda | Inyección en la lección | Sí: por institución, lección, versión del prompt y modelo |

## Antes de cambiar un prompt
1. Edita el texto en `backend/src/prompts/` y **sube su `version`** (por ejemplo de 1.0.0 a 1.1.0).
2. Ejecuta `npm run prompts:lock`. Se niega si cambiaste el texto sin subir la versión.
3. Ejecuta `npm test`: las evals rápidas comprueban que siguen las reglas de seguridad, el formato y los guardrails.
4. Ejecuta `npm run evals` con la clave real y compara los aciertos con la versión anterior. Si baja un caso de seguridad, no se publica.
5. En el PR, el workflow «Evals IA» vuelve a correr las evals reales porque cambió `backend/src/prompts/`.

## Cómo correr las evals
- **Rápidas** (`backend/tests/evals/`, dentro de `npm test` y de GitHub Actions en cada push):
  - Usan el proveedor de prueba y la base `TEST_DB_NAME`, con datos efímeros que se borran.
  - Cubren cada agente: respuesta con fuentes, sin evidencia, inyección en material, Drive y entregas, datos ajenos, datos personales, tema ajeno y formato JSON.
  - También cubren el router, la caché y la huella de los prompts.
- **Con modelo real** (`backend/tests/evals-real/`, `npm run evals` dentro de `backend`):
  - Necesitan `AI_PROVIDER`, `AI_API_KEY` y `AI_MODEL` (o las dos variables del router).
  - Si `AI_BASE_URL` apunta a `127.0.0.1` (el doble de Playwright), se omiten.
  - Informan aciertos por caso, tokens por nivel y costo si están `AI_PRICE_INPUT_USD_PER_MTOK` y `AI_PRICE_OUTPUT_USD_PER_MTOK`.
  - Nunca corren en cada push.
- **En GitHub:** el workflow `.github/workflows/evals.yml` corre a mano (Actions → Evals IA → Run workflow), y en cada PR solo llama al modelo si cambió `backend/src/prompts/`.
  - Necesita los secretos `AI_PROVIDER`, `AI_API_KEY` y `AI_MODEL`.
  - Para que sea obligatorio, marca «Evals con modelo real» como revisión requerida de `main` y `develop`.
  - Los PR que vienen de un fork no tienen acceso a los secretos.

## Endpoints
- `GET /api/v1/agents`: catálogo según el rol de la sesión.
- `POST /api/v1/agents/:clave/run`: ejecuta un agente con las entradas del formulario.
- `GET /api/v1/agents/runs`: historial propio.
- `GET /api/v1/governance/agent-runs`: bitácora de la institución (administración y auditoría).

## Pruebas
Además de las evals, `backend/tests/agents.test.js` simula el proveedor de IA y comprueba:
- permisos por rol y por institución;
- que no se envían nombres ni correos;
- que sin material no se llama al modelo;
- que las citas son válidas;
- que una respuesta mal formada queda registrada como falla;
- que cada ejecución queda en la bitácora.
