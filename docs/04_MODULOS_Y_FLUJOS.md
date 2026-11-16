# Módulos y flujos funcionales

## A. Identidad e instituciones
Login/logout, restablecimiento seguro de contraseña, invitaciones y flujo seguro de creación del primer administrador, roles, perfil, preferencias, administración de usuarios por institución y auditoría de cambios sensibles. Preparar integración MFA como fase posterior.

## B. Cursos y matrículas
Cursos con código, título, descripción, objetivo, categoría, período, estado `draft|published|archived`; asignación de docentes; matrícula de alumnos; autorización contextual. Docente gestiona módulos ordenados, temas con prerrequisitos y lecciones con contenido Markdown seguro.

## C. Material académico
Texto/Markdown MVP; fase siguiente carga PDF/DOCX autorizados con antivirus y extracción controlada. Versionar cambios, evitar usar información no publicada en el tutor, asociar material a tema y curso.

## D. Evaluaciones
Cuestionarios asociados a curso y tema; preguntas opción múltiple de respuesta única en MVP, dificultad, explicación, puntos y clave guardada solo en backend. Intentos de alumno, respuestas y cálculo deterministic. Rastrear error por tema y guardar snapshot de versión del examen. Una evaluación evaluada no debe cambiar retroactivamente.

## E. Dominio y refuerzo
Después del intento, calcular evidencia por tema y actualizar dominio `[0,1]`; mostrar confianza/evidencia y por qué se aconseja refuerzo. Usar prerrequisitos para sugerir siguiente tema. No convertir `dominio` en nota oficial. Permitir repetir actividades y comparar evolución.

## F. Tutor IA
Chat contextual por curso/tema, explicación paso a paso, pistas graduadas, ejemplos, preguntas de verificación y recomendaciones de fuente; no responder en nombre del docente ni inventar citas. En ejercicios evaluativos activos, restringir entrega de respuestas completas cuando la política del curso lo requiera.

## G. Plan de estudio
El alumno declara examen objetivo, fecha, minutos disponibles y días disponibles (opcional). Generar tareas usando debilidades, importancia, prerrequisitos y tiempo estimado. Permitir aceptar/editar/descartar el plan. El plan nunca revela información de otros alumnos.

## H. Analítica docente
Vista agregada por tema: intentos, distribución de puntuaciones, temas con más errores, actividades pendientes y evolución. Vista de alumno solo si el docente imparte el curso. Evitar afirmar que el estudiante "está en riesgo" como diagnóstico definitivo.

## I. Administración
Gestión de institución/usuarios, límites de uso de IA, permisos, retención y exportaciones autorizadas, bitácora de eventos.

## Flujos principales
1. Admin crea institución y asigna docente -> docente crea curso y contenido -> alumno es matriculado -> alumno inicia lección -> resuelve examen -> backend corrige -> registra dominio -> genera recomendación -> profesor ve panel.
2. Docente carga/edita material -> proceso valida/publica -> indexa trozos para recuperación -> alumno pregunta -> tutor recupera pasajes del curso -> responde con citas -> registra metadatos seguros.
3. Alumno pide plan -> motor consulta avance, fecha y tiempos -> construye secuencia con prerrequisitos -> alumno acepta/edita -> plan se actualiza con nuevos resultados.

## Eventos del dominio (no necesariamente broker en MVP)
`user.invited`, `course.published`, `enrollment.created`, `assessment.published`, `attempt.submitted`, `mastery.updated`, `recommendation.created`, `ai.interaction.completed`, `teacher.question.approved`.
