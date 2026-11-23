# Inventario de datos

Última revisión: 2026-11-20 (gobernanza Ley 8968, agentes de IA, integraciones y catálogo de roles). El material importado se trata como **datos**, nunca como instrucciones.

| Dato | Dónde | Quién lo crea | Quién lo ve | Retención | Responsable |
| --- | --- | --- | --- | --- | --- |
| Cuentas, roles, sesiones (hash) | MySQL `users`, `user_sessions` | Administración | La propia persona y la administración de su institución | Mientras la cuenta exista; sesiones hasta su vencimiento | Administración de la institución |
| Cursos, lecciones, evaluaciones, notas, dominio | MySQL | Docentes y estudiantes | Según rol y matrícula | Mientras exista el curso | Docente del curso |
| Archivos subidos | Disco `backend/storage/uploads` | Docentes | Matriculados (descarga protegida) | Hasta que se borre el material o la lección; los huérfanos se reconcilian cada hora | Docente |
| Fuentes y versiones con **texto extraído** | MySQL `knowledge_sources`, `source_versions` | Al publicar una lección, subir un PDF/DOCX/TXT o sincronizar Drive | Docentes y administración (panel); estudiantes solo el pasaje citado | Las versiones citadas conservan su texto; el de versiones reemplazadas o retiradas sin citas se borra a los `VERSION_TEXT_RETENTION_DAYS` (30) | Docente |
| **Copia de texto** por versión | Cloud Storage, bucket `RAG_GCS_BUCKET`, prefijo `RAG_GCS_PREFIX` | MENTOR (modo Vertex) | Solo la identidad del servidor y el agente de servicio de RAG Engine | Se borra al reemplazar o retirar la versión (con reintentos) | Operador de la plataforma |
| **Índice** de fragmentos y embeddings | RAG Engine, un corpus por curso (RagManagedDb) | MENTOR (modo Vertex) | Identidad del servidor | Se borra el archivo del corpus al reemplazar o retirar la versión | Operador de la plataforma |
| Originales de Drive | Google Drive de la institución | La institución | Según los permisos de Drive | MENTOR no los modifica ni borra | Administración de la institución |
| Fragmentos enviados al **proveedor de generación** | Proveedor configurado (`AI_PROVIDER`) | MENTOR por consulta | Proveedor, según su contrato | Según la política del proveedor; MENTOR no envía nombres ni correos | Operador de la plataforma |
| Conversaciones y citas | MySQL `ai_threads`, `ai_messages`, `ai_message_sources` | Estudiante o docente y tutor | Solo quien conversa (y su versión citada) | Se borran tras `AI_CHAT_RETENTION_DAYS` (365) días sin actividad, con sus citas | Administración de la institución |
| Consumo técnico | MySQL `ai_usage_events` y registro del servidor | MENTOR | Administración de la institución | Detalle por `AI_USAGE_DETAIL_DAYS` (90); después, solo el resumen mensual (`ai_usage_monthly`) | Operador |
| Contadores de límites por IP | MySQL `rate_limit_hits` (solo con `RATE_LIMIT_STORE=mysql`) | MENTOR | Nadie desde la interfaz | Se borran una hora después de vencer la ventana | Operador |
| Turno de tareas | MySQL `job_leases` | MENTOR | Nadie desde la interfaz | Una fila por tarea, sin datos personales | Operador |
| Quizzes rápidos y partidas | MySQL `quick_quizzes`, `quick_quiz_*`, `quiz_plays`, `quiz_play_answers` | Docente (quizzes) y estudiante (partidas) | Docente: todo. Estudiante: sus partidas y la tabla de posiciones del quiz (nombre visible y puntaje de compañeros) | Mientras exista el curso | Docente del curso |
| Práctica diaria, racha y bono | MySQL `daily_practices`, `daily_practice_answers`, `course_streaks`, `grade_bonus_events` | Estudiante | El propio estudiante y los docentes del curso | Mientras exista el curso | Docente del curso |
| Trabajo en clase y pesos de la nota | MySQL `class_work_items`, `class_work_grades`, `course_grade_policies` | Docente | Docente: todo. Estudiante: solo sus propias notas | Mientras exista el curso | Docente del curso |
| Preferencias de apariencia, accesibilidad y metas | MySQL `user_preferences`; copia en `localStorage` del navegador | La propia persona | Solo la propia persona | Mientras exista la cuenta; la copia local se borra al cerrar sesión | La propia persona |
| Repaso espaciado (estado por tema e historial con origen de la nota) | MySQL `topic_reviews`, `topic_review_logs` | MENTOR al enviar evaluaciones y el estudiante al autoevaluarse | Solo el propio estudiante | Mientras exista el curso o la cuenta (borrado en cascada) | Docente del curso |
| Planes de estudio y sus sesiones | MySQL `study_plans`, `study_plan_items` | Estudiante | Solo el propio estudiante | Mientras exista el curso; los planes archivados se conservan | Docente del curso |
| Datos personales (nombres, apellidos, teléfono, presentación) | MySQL `users` | La propia persona | Nombres y teléfono: la persona y la administración. Presentación: también docentes y compañeros de curso | Mientras exista la cuenta | La propia persona |
| Foto de perfil | Disco `UPLOAD_DIR/avatars` (nombre aleatorio; solo PNG, JPG o WebP de hasta 2 MB validados por contenido) | La propia persona | Personas de la misma institución, con sesión | Se borra al cambiarla o quitarla | La propia persona |
| Auditoría | MySQL `audit_logs` | MENTOR | Administración y rol auditor (solo lectura) | Sin contenido de documentos | Administración de la institución |
| Catálogo de roles | MySQL `roles` (FK desde `users.role`) | Migración (dato de referencia) | Nadie lo edita desde la interfaz | Permanente | Operador |
| Restablecimiento de contraseña (hash del token) | MySQL `password_resets` | La propia persona al pedirlo | Nadie desde la interfaz | Vence a los 60 minutos y sirve una vez | Operador |
| Cambio de correo pendiente (nuevo correo y hash del token) | MySQL `email_changes` | La propia persona al pedirlo | Nadie desde la interfaz | Vence a los 60 minutos y sirve una vez; se borra con la baja de la cuenta | Operador |
| Aceptación de términos y privacidad (versión, fecha) | MySQL `consent_records` | La propia persona al activar la cuenta o reaceptar | La persona; administración y auditoría de su institución | Se conserva como evidencia aun después de la baja | Administración de la institución |
| Solicitudes de baja y qué se conservó | MySQL `data_deletion_requests` | La propia persona (confirmando su contraseña) | Administración y auditoría | Permanente, sin datos personales tras anonimizar | Administración de la institución |
| Ejecuciones de agentes de IA (agente, resultado, modelo, tokens, latencia; sin contenido) | MySQL `agent_runs` | MENTOR | La persona (su historial); administración y auditoría | Mientras exista la institución | Operador |
| Llamadas a integraciones (Hacienda, Nager.Date, n8n) | MySQL `integration_runs`, `exchange_rates` | MENTOR y n8n | Administración | Sin datos personales | Operador |
| Recordatorios por correo (nombre, correo, títulos de pendientes) | n8n (en memoria durante la ejecución) y servidor SMTP | Workflow 2 | La propia persona | n8n guarda el historial de ejecuciones según su configuración | Operador |

## Qué recibe el proveedor de generación
El prompt del sistema, hasta 6 fragmentos (máximo 1800 caracteres cada uno) con título y página o sección, la pregunta y hasta 6 mensajes previos del mismo hilo. Se omiten los turnos que citaron fuentes retiradas. No se envían nombres, correos ni identificadores.

## Qué no se registra
El registro técnico (`ai_usage_events` y la línea `tutor.consulta` del servidor) no guarda credenciales, preguntas, respuestas ni contenido de documentos. Las claves viven en `.env` (no versionado) o en ADC.

## Retención automática
Una vez al día (`RETENTION_INTERVAL_MINUTES`), la instancia con el turno de tareas aplica las reglas anteriores. Con `0` en un plazo, esa regla no borra nada. Borrar una conversación también quita sus citas, así que el contador «usada en respuestas» del docente baja en consecuencia.
