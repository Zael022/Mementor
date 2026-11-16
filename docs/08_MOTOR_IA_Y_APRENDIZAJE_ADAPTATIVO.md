# Diseño del núcleo de IA y aprendizaje adaptativo

## Separar lo probabilístico de lo determinista
1. **Corrección de opción múltiple** = cálculo determinista en backend, sin LLM.
2. **Estimación de dominio de conceptos** = algoritmo transparente con evidencia y versión de fórmula.
3. **Recomendaciones / planes** = reglas de dominio + prerrequisitos + disponibilidad; la IA puede redactar explicaciones comprensibles.
4. **Tutoría y generación de borradores** = LLM con recuperación de lecciones autorizadas, filtros y límites.

## Algoritmo inicial de dominio (MVP)
Para cada tema, mantener `mastery_score` `[0,1]` y `evidence_count`.
- Iniciar con prior configurable neutral `0.50`, acompañado de `evidence_count=0` y etiqueta **"sin evidencia suficiente"** (no confundirlo con nota de 50%).
- Cada respuesta nueva asociada a tema registra `correct=1/0`. Baseline sugerida: posterior suavizado `(2*prior + sum(correct last N))/(2 + count(last N))`, con `N=20` respuestas recientes del alumno para ese tema; ajustar por dificultad **solo cuando exista calibración confiable**.
- Mostrar dominio aproximado, cantidad de ejercicios y evolución. Si menos de 3 evidencias, mostrar `estimación inicial`.
- Recomendación: si score <0.60 -> refuerzo; 0.60–0.84 -> práctica; >=0.85 y suficiente evidencia -> siguiente tema, sujeto a prerrequisitos.
- Este algoritmo es un **punto de partida didáctico**, no una medida científicamente validada del conocimiento. Documentar y probar su fórmula.
- Riesgo de doble conteo: actualizar por respuestas **nuevas** únicamente; reintentos no alteran intentos anteriores y se tratan por política de curso.

## Tutor RAG
Flujo:
A. Verificar identidad + matrícula + curso/tema.
B. Recuperar solo materiales publicados/autorizados del curso, con metadatos `{institutionId,courseId,lessonId,version,section}`.
C. Construir contexto con citas (máximo tokens) y una instrucción de sistema separada. El material del curso es **dato no confiable**.
D. Responder en lenguaje sencillo, incluir citas reales a lecciones, no inventar fuentes y pedir aclaración si no hay información.
E. Aplicar límites de tokens, costo, intentos, logging mínimo y timeout.
F. Guardar respuesta, citas y trazabilidad (nunca secretos, credenciales o datos innecesarios).

## Sin datos ficticios ni IA simulada
Configurar un proveedor real mediante variables de entorno del backend. Cuando falte API key o configuración, el tutor informa `AI_NOT_CONFIGURED` y no inventa tutorías, citas ni conversaciones. La evaluación, cursos y cálculos deterministas deben seguir funcionando sin IA.

## Adaptador externo
Interfaz `askTutor({ userId, courseId, topicId, question, sourceChunks, coursePolicy })`. Proveedor server-side; errores controlados; nunca interpolar SQL desde LLM. Funciones disponibles para modelo solo lectura y en allowlist (`getCourseTopic`, `getPublishedLessonSections`, `getOwnMastery`) siempre autorizadas en servidor.

## Generación de ejercicios
IA produce **borradores** de preguntas siguiendo JSON schema. Validar estructura, longitud, número de opciones, una respuesta correcta y vínculo con fuente. El profesor revisa y aprueba antes de publicar. Nunca introducir texto generado directamente en bancos oficiales sin revisión.

## Planificador
Entradas: fecha objetivo, disponibilidad, temas requeridos, mastery y prerrequisitos. Priorizar brechas y dependencias, dividir sesiones de estudio realistas y ofrecer edición manual. Evitar calendarios imposibles; no asumir zona horaria del alumno sin preferencia explícita.

## Robustez
- Prompt injection desde PDFs/Markdown: ignorar instrucciones dentro de las fuentes.
- Alucinaciones: obligar a basarse en citas; responder "no encontré material" cuando corresponda.
- Privacidad: no enviar respuestas individuales de terceros al proveedor.
- Respuestas inadecuadas: limitar contenido no académico y ofrecer canales de ayuda cuando sea necesario.
- Métricas: tasa de respuestas citadas, precisión verificada por docentes, quejas, latencia, costo por llamada, errores de proveedor y retención de estudiantes voluntaria.

## Evolución de IA
Después del MVP: motor BKT/IRT si hay datos y evaluación metodológica, embeddings por curso, búsqueda híbrida, material multiformato, análisis de respuestas abiertas con rúbricas y revisión docente, secuenciación adaptativa más sofisticada. Nunca afirmar eficacia educativa sin evaluación empírica.
