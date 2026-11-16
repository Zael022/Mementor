# Modelo de datos conceptual (MySQL)

**Implementar con modelos, asociaciones y migraciones Sequelize** en `backend/src/models/` y `backend/database/migrations/`. Esta lista es conceptual: no insertar filas predefinidas durante migraciones. No usar `sequelize.sync({force: true})` en entornos persistentes.

## Núcleo
`institutions(id,name,slug,status)`
`users(id,institution_id,email,password_hash,display_name,role,status)`
`user_sessions(id,user_id,token_hash,expires_at,revoked_at)`
`courses(id,institution_id,code,title,description,status,created_by)`
`course_teachers(course_id,user_id)`
`enrollments(course_id,student_id,status)`
`modules(id,course_id,title,position)`
`topics(id,module_id,title,position,learning_objective)`
`topic_prerequisites(topic_id,prerequisite_topic_id)`
`lessons(id,topic_id,title,body_md,status,position)`
`lesson_progress(id,student_id,lesson_id,status,completed_at)`
`materials(id,course_id,topic_id,filename,storage_key,mime_type,status,version)`

## Evaluaciones
`assessments(id,course_id,topic_id,title,status,passing_score,max_attempts)`
`questions(id,assessment_id,topic_id,stem,explanation,points,position)`
`question_options(id,question_id,body,is_correct,position)`
`assessment_attempts(id,assessment_id,student_id,status,score_pct,submitted_at)`
`attempt_answers(id,attempt_id,question_id,selected_option_id,is_correct,earned_points)`

## Personalización
`topic_mastery(id,student_id,topic_id,mastery_score,evidence_count,updated_at)`
`learning_recommendations(id,student_id,topic_id,type,reason,status)`
`study_plans(id,student_id,course_id,title,target_date,status)`
`study_plan_items(id,study_plan_id,topic_id,description,minutes,scheduled_date,status)`

## IA y trazabilidad
`ai_threads(id,user_id,course_id,title)`
`ai_messages(id,thread_id,role,content,citations_json,created_at)`
`ai_generation_drafts(id,teacher_id,course_id,type,payload_json,status)`
`audit_logs(id,institution_id,actor_id,action,resource_type,resource_id,metadata_json,created_at)`

## Invariantes estrictas
- **Misma institución** para usuario, curso y cualquier operación cruzada; no confiar en `institution_id` recibido del cliente; derivarlo de sesión verificada.
- `teacher` solo puede escribir en cursos asignados; `student` solo puede leer cursos matriculados, excepto catálogo autorizado.
- `question_options.is_correct` nunca se incluye en GET para estudiantes antes de submit.
- Una pregunta publicada/contestada no se modifica silenciosamente: bloquear edición o generar nueva versión.
- Evitar duplicate `attempt_answers`; integridad referencial de opciones con pregunta (validar en transacción).
- Los `ai_messages` no deben guardar textos innecesarios ni datos sensibles sin justificación.
- Un usuario que cambie institución no hereda accesos; mantener IDs/relaciones consistentes.

## Índices imprescindibles
Únicos `(institution_id,email)`, `(institution_id,code)`; búsqueda `(course_id,status)`, `(student_id,status)`, `(topic_id,student_id)` y logs `(institution_id,created_at)`. Para relaciones cross-tenant: complementar FK con consultas scope y pruebas, o crear claves compuestas si la arquitectura lo permite.

## Evolución
Membresías multi-institución, rúbricas de ensayos, badges, calendario, analítica histórica, índice RAG, embeddings, notifications, consentimientos y exportación de datos en migraciones posteriores.
