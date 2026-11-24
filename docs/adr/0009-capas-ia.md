# ADR 0009 · Las 8 capas de la IA de MENTOR

**Estado:** aceptada · 2026-11-24 · Reemplaza en parte al ADR 0001 (el modelo ya no es uno solo: lo elige el router por tarea).

## Contexto
El tutor y los 7 agentes ya tenían RAG, permisos por servidor y validación de formato, pero los prompts estaban repartidos y sin versión, la salida casi no se revisaba, no había caché ni router, y nada impedía que un cambio en un prompt rompiera una regla sin que fallara una prueba.

## Decisión, capa por capa
1. **Prompt versionado.**
   - Todos los textos que van al modelo están en `backend/src/prompts/`, con `id`, `version` y `text`: el tutor, las reglas comunes y los 7 agentes.
   - `prompts.lock.json` guarda la huella SHA-256 de cada versión. `tests/evals/prompts.test.js` falla si el texto cambia y la versión no.
   - `npm run prompts:lock` actualiza el lock y se niega si falta subir la versión.
   - `agent_runs.prompt_version` y `ai_usage_events.prompt_version` guardan la etiqueta usada, por ejemplo `tutor@1.0.0` o `lesson_summarizer@1.0.0+agentes-comun@1.0.0`.
2. **RAG.**
   - Sin cambios de diseño. Los casos «sin evidencia no se llama al modelo» y «cita fuentes reales del curso» pasan a la suite de evals.
   - La consulta al buscador sale sin datos personales ni la palabra que los presenta («mi cédula es …»). Antes iba completa hacia Vertex, y además esas palabras hacían que la pregunta no encontrara la lección.
3. **Herramientas.**
   - Sin tool use (ADR 0002). Las «herramientas» son las funciones del servidor (`buildContext`) que arman el contexto ya autorizado: el modelo nunca decide qué datos lee.
4. **Accesos.**
   - Sin cambios: rol, institución y `getCourseAccess` desde la sesión.
   - Se agregaron pruebas por agente con otra institución, otro docente de la misma institución, un compañero y un curso sin matrícula, y preguntas por datos ajenos.
5. **Guardrails.** Detalle en `src/utils/outputGuard.js`.
   - Entrada:
     - se mantienen `asData` y `redactPersonalData`, y ahora también se aplica `redactPersonalData` al cuerpo de la lección del resumen;
     - las frases típicas de inyección dejan la alerta `alert_injection_suspected`;
     - la nota sugerida queda entre 0 y el máximo.
   - Salida:
     - **Datos personales** que no vienen del material autorizado: se bloquea en el tutor y en todos los agentes. Lo que el docente publicó sí puede citarse.
     - **Enlaces externos** que no estaban en la entrada: se bloquea.
     - **Cifras y negaciones** que la fuente no respalda (`claimCheck`): en el resumen se bloquea, y en el generador se descarta solo la pregunta.
     - **Anuncio:** se bloquea si trae cifras o fechas que no están en la indicación, o si su tema es ajeno (menos del 20 % de palabras del curso o de la indicación).
     - **Evaluación abierta en el tutor:** si la pregunta coincide con una evaluación o quiz publicado (60 % de sus palabras), se pide solo una pista. Si la respuesta revela la opción correcta, se muestra el aviso `ASSESSMENT_ANSWER`.
     - **Analista y Coach:** una cifra que no está en los datos solo deja la alerta `alert_unsupported_number`, porque pueden calcular porcentajes y minutos válidos.
     - Un bloqueo responde `422 AI_OUTPUT_BLOCKED` con un mensaje claro en español (agentes) o un aviso en el chat (tutor), y nunca muestra el contenido.
   - `claimCheck`:
     - la negación exige que lo primero que se niega esté afirmado en el otro texto, junto con otra parte o el sujeto;
     - una afirmación corta que contradice la fuente también se rechaza;
     - una pregunta no se revisa por sentido.
6. **Caché.**
   - Tabla `ai_response_cache`, solo para el resumen de lección.
   - Llave: SHA-256 de institución, agente, versión del prompt, modelo y huella del system y los mensajes. Por eso cambiar la lección, el prompt o el modelo cambia la llave.
   - Al editar, despublicar o borrar la lección se borra lo guardado. Vence a los 7 días y la retención diaria limpia lo vencido.
   - Los permisos se revisan antes de leer la caché.
   - Nunca guarda el tutor ni agentes con texto escrito por personas.
   - Un resultado servido desde la caché queda con `cache_hit = true` y 0 tokens, y no consume la cuota diaria.
   - Prompt caching del proveedor: con `AI_PROMPT_CACHE=on`, el cuerpo de la lección se marca con `cache_control` si pasa el mínimo (`AI_PROMPT_CACHE_MIN_TOKENS`). Los tokens leídos y escritos en caché quedan en `cache_read_tokens` y `cache_write_tokens`. El system prompt del tutor (unos 300 tokens) no llega a ningún mínimo, así que no se marca.
7. **Router.**
   - `AI_MODEL_RAPIDO` y `AI_MODEL_AVANZADO`, con `AI_MODEL` como respaldo. No hay nombres de modelos en el código.
   - Rápido: anuncios, resúmenes, Coach y analista.
   - Avanzado: tutor, retroalimentación, generador de preguntas y cumplimiento.
   - `AI_TIER_<AGENTE>` reasigna un agente.
   - `model_tier` y `model` quedan en la bitácora.
8. **Observabilidad y evals.**
   - Columnas nuevas en `agent_runs` y `ai_usage_events`: `prompt_version`, `model_tier`, `cache_hit`, `guard_outcome`, `cache_read_tokens` y `cache_write_tokens`. Nuevo resultado `guard_blocked`.
   - Sin contenido de chats ni documentos.
   - Evals rápidas en `backend/tests/evals/`, con proveedor de prueba, dentro de `npm test` y de CI.
   - Evals con modelo real en `backend/tests/evals-real/` (`npm run evals`), con aciertos por caso, tokens y costo si hay `AI_PRICE_*`.
   - El workflow `evals.yml` corre a mano, y en PR solo llama al modelo si cambió `backend/src/prompts/`.

## Consecuencias
- Cambiar un prompt exige subir su versión, `npm run prompts:lock` y `npm run evals` con la clave real.
- La revisión de salida es léxica: no reconoce nombres propios, sinónimos de negación ni una clave dicha con otras palabras. Puede bloquear una respuesta correcta que use cifras derivadas; por eso en el analista y el Coach solo alerta.
- Para que las evals sean obligatorias hace falta configurar en GitHub los secretos y la revisión requerida.
