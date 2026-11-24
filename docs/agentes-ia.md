# Agentes de inteligencia artificial de MENTOR AI

Los ocho agentes académicos y el nuevo redactor de admisiones viven en `backend/src/services/agents/` (el tutor, en `tutorService.js`). Todos comparten estas reglas:
- Cada agente vuelve a comprobar en el servidor el rol, la institución y el acceso al curso o recurso.
- El material del curso entra al modelo como dato (`asData`), nunca como instrucción.
- La respuesta del modelo debe ser JSON y se valida con Zod antes de mostrarse.
- Si falta material del curso, el agente no llama al modelo y lo dice. Si no hay clave de IA, responde con un error claro (503).
- Cada ejecución queda en la tabla `agent_runs`: agente, persona, curso, resultado, modelo, tokens y latencia, sin el contenido.
- Límite diario por persona: `AGENT_DAILY_LIMIT_PER_USER` (30 por defecto); el tutor tiene su propia cuota.

**Modelo o proveedor:** el que se configure en `AI_PROVIDER` y `AI_MODEL`. Por defecto es Anthropic Claude; también se acepta un servicio compatible con OpenAI.

| # | Agente (clave) | Objetivo | Rol que lo usa | Entradas | Resultado | Protección de datos personales |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tutor del curso (`tutor`) | Responder dudas con el material autorizado del curso, citando cada fuente | Estudiante (y docente para probar) | Curso de la sesión y pregunta | Respuesta en vivo con citas verificables | No envía nombre ni correo; sin evidencia no llama al modelo |
| 2 | Generador de preguntas (`question_generator`) | Proponer preguntas de opción múltiple para quizzes | Docente, administración | Curso, tema, cantidad (1 a 8) | Preguntas con la respuesta correcta, una explicación y la cita; se pueden convertir en un quiz en borrador | Solo usa material del curso; descarta las preguntas sin cita válida |
| 3 | Asistente de retroalimentación (`feedback_assistant`) | Borrador de retroalimentación para una entrega | Docente, administración | Entrega | Fortalezas, mejoras, texto para el estudiante y una nota orientativa (nunca mayor que el máximo) | No envía el nombre ni el correo del estudiante; la nota la decide el docente |
| 4 | Analista del curso (`course_analyst`) | Informe en lenguaje natural de las estadísticas del curso | Docente, administración | Curso | Resumen, puntos destacados, riesgos y recomendaciones | Solo datos agregados; los nombres se cambian por «Estudiante 1, 2…» |
| 5 | Asistente de cumplimiento (`compliance_checker`) | Revisar un texto frente a la política de privacidad (Ley 8968) | Docente, administración, auditoría | Texto | Nivel de riesgo, hallazgos y cómo corregirlos | Detecta en el servidor cédulas, teléfonos y correos y los muestra enmascarados |
| 6 | Redactor de anuncios (`announcement_writer`) | Generar anuncios o publicaciones para redes | Docente, administración | Curso, indicación, tono, formato | Título, texto y etiquetas; se puede publicar como anuncio | Envía solo la indicación y el nombre del curso |
| 7 | Coach de estudio (`study_coach`) | Plan de estudio para hoy | Estudiante | Curso, minutos disponibles | Pasos con minutos y motivo, y un mensaje de motivación | Usa solo los datos propios del estudiante, sin nombre ni correo |
| 8 | Resumen de lección (`lesson_summarizer`) | Sintetizar una lección y proponer autoevaluación | Estudiante, docente | Lección | Resumen, ideas clave y preguntas con su respuesta | Solo el contenido de una lección que la persona puede ver |
| 9 | Redactor de admisiones (`admissions_writer`) | Borrador para el siguiente contacto | Administración de institución | Solicitud explícita, canal, objetivo y tono | Texto pendiente de revisión guardado en CRM, vinculado a agent_runs | Contexto institucional construido por servidor, sin nombre/correo/teléfono/notas/historial; JSON y asData |

El agente de admisiones solo se ejecuta mediante `POST /crm/prospectos/:id/mensaje`, para guardar un borrador funcional con revisión versionada. Desde Asistentes se enlaza al CRM. Sin IA sigue disponible la redacción manual. La IA no admite, rechaza, mueve etapas, matricula, califica ni envía. Contexto/destinatario/canal o texto diferentes invalidan el uso de una aprobación anterior.

El asistente de cumplimiento ahora enmascara correos, teléfonos y cédulas en el texto **antes de la llamada al proveedor**; la prueba inspecciona el payload, no solo la pantalla. La detección es acotada y no certifica cumplimiento de la Ley 8968.

Cuota separada de la del tutor: `AGENT_DAILY_LIMIT_PER_USER` y `AGENT_DAILY_LIMIT_PER_INSTITUTION` (500 por defecto institucional). Reservas y fallas cuentan en ventana móvil de 24 h; avisos sin evidencia y `agent=tutor` se excluyen. Se bloquea institución antes de usuario para concurrencia. El costo combinado usa `agent_runs` una vez por ejecución; tarifas por proveedor/modelo y tokens desconocidos producen valores nulos, sin facturación inventada.

## Endpoints
- `GET /api/v1/agents`: catálogo según el rol de la sesión.
- `POST /api/v1/agents/:clave/run`: ejecuta un agente con las entradas del formulario.
- `GET /api/v1/agents/runs`: historial propio.
- `GET /api/v1/governance/agent-runs`: bitácora de la institución (administración y auditoría).

## Pruebas
`backend/tests/agents.test.js` simula el proveedor de IA y comprueba:
- permisos por rol y por institución;
- que no se envían nombres ni correos;
- que sin material no se llama al modelo;
- que las citas son válidas;
- que una respuesta mal formada queda registrada como falla;
- que cada ejecución queda en la bitácora.
