# Diccionario de datos de MENTOR AI

Generado desde las migraciones de Sequelize (65 tablas, 619 columnas, 126 llaves foráneas). Motor: MySQL 8 (utf8mb4).

Convenciones: PK = llave primaria, FK = llave foránea, UQ = valor único. Todas las tablas tienen `created_at` y `updated_at` salvo las indicadas.

## Seguridad e identidad

### `roles`

Catálogo de roles del sistema (seguridad).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `code` | `varchar(30)` | No | PK | Código único. |
| `name` | `varchar(80)` | No |  | Nombre. |
| `description` | `varchar(255)` | No |  | Descripción. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `users`

Personas que usan la plataforma, su rol, institución y datos de perfil.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | Sí | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `email` | `varchar(190)` | No | UQ | Correo electrónico (único). |
| `password_hash` | `varchar(255)` | Sí |  | Hash bcrypt de la contraseña (nunca el texto). |
| `display_name` | `varchar(120)` | No |  | Nombre visible para otras personas. |
| `role` | `varchar(30)` | No | FK → roles.code | Código del rol (FK a roles). |
| `status` | `enum('invited','active','disabled')` | No |  | Estado del registro. |
| `invitation_token_hash` | `char(64)` | Sí | UQ | Hash del token de invitación. |
| `invitation_expires_at` | `datetime` | Sí |  | Vencimiento de la invitación. |
| `failed_login_count` | `int` | No |  | Intentos fallidos de inicio de sesión seguidos. |
| `locked_until` | `datetime` | Sí |  | Bloqueo temporal por intentos fallidos. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `first_name` | `varchar(80)` | Sí |  | Nombre de pila. |
| `last_name` | `varchar(80)` | Sí |  | Apellidos. |
| `phone` | `varchar(30)` | Sí |  | Teléfono de contacto (opcional). |
| `bio` | `varchar(500)` | Sí |  | Presentación breve escrita por la persona. |
| `avatar_file` | `varchar(64)` | Sí |  | Nombre interno del archivo de la foto de perfil. |
| `avatar_updated_at` | `datetime` | Sí |  | Fecha del último cambio de foto. |
| `anonymized_at` | `datetime` | Sí |  | Fecha en que se anonimizó la cuenta tras la baja. |

### `user_sessions`

Sesiones abiertas; el JWT lleva el identificador cuyo hash se guarda aquí para poder revocarlo.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `token_hash` | `char(64)` | No | UQ | Hash SHA-256 del token (nunca el token). |
| `csrf_token` | `char(64)` | No |  | Token anti-CSRF de la sesión. |
| `expires_at` | `datetime` | No |  | Fecha de vencimiento. |
| `revoked_at` | `datetime` | Sí |  | Fecha en que se revocó. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `password_resets`

Enlaces de un solo uso para restablecer la contraseña (solo el hash del token).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `token_hash` | `char(64)` | No | UQ | Hash SHA-256 del token (nunca el token). |
| `expires_at` | `datetime` | No |  | Fecha de vencimiento. |
| `used_at` | `datetime` | Sí |  | Fecha en que se usó. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `email_changes`

Cambios de correo pendientes de confirmar desde la nueva dirección (solo el hash del token).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `new_email` | `varchar(190)` | No |  | Correo nuevo que se aplica al confirmar el enlace. |
| `token_hash` | `char(64)` | No | UQ | Hash SHA-256 del token (nunca el token). |
| `expires_at` | `datetime` | No |  | Fecha de vencimiento. |
| `used_at` | `datetime` | Sí |  | Fecha en que se usó. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `institutions`

Instituciones educativas (aislamiento de datos) y sus topes de uso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `name` | `varchar(150)` | No |  | Nombre. |
| `slug` | `varchar(100)` | No | UQ | Identificador legible en URL. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `status` | `enum('active','inactive')` | No |  | Estado del registro. |
| `max_documents` | `int` | Sí |  | Máximo de documentos de la institución. |
| `ai_daily_question_limit` | `int` | Sí |  | Límite diario de preguntas al tutor por estudiante. |

### `user_preferences`

Preferencias de apariencia, accesibilidad y metas de cada persona.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `user_id` | `bigint unsigned` | No | PK, FK → users.id | Referencia a users.id (llave foránea). |
| `theme` | `enum('system','light','dark')` | No |  | Tema visual preferido. |
| `text_scale` | `smallint` | No |  | Tamaño de texto preferido. |
| `high_contrast` | `tinyint(1)` | No |  | Preferencia de alto contraste. |
| `reduced_motion` | `tinyint(1)` | No |  | Preferencia de movimiento reducido. |
| `reading_spacing` | `tinyint(1)` | No |  | Preferencia de espaciado de lectura. |
| `underline_links` | `tinyint(1)` | No |  | Preferencia de enlaces subrayados. |
| `time_zone` | `varchar(64)` | Sí |  | Zona horaria. |
| `daily_goal_minutes` | `smallint` | Sí |  | Meta diaria de estudio en minutos. |
| `practice_size` | `tinyint` | No |  | Cantidad de preguntas de la práctica diaria. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `email_reminders` | `tinyint(1)` | No |  | Si la persona quiere recibir recordatorios por correo. |

## Gobernanza y bitácoras

### `consent_records`

Aceptación de cada versión de términos y política de privacidad.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `document` | `enum('terms','privacy')` | No |  | Documento aceptado (términos o privacidad). |
| `version` | `varchar(20)` | No |  | Versión del documento. |
| `accepted_at` | `datetime` | No |  | Fecha y hora de aceptación. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `data_deletion_requests`

Solicitudes de baja, su procesamiento y lo que se conservó.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `institution_id` | `bigint unsigned` | Sí | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `status` | `enum('pending','completed','rejected')` | No |  | Estado del registro. |
| `reason` | `varchar(500)` | Sí |  | Motivo indicado por la persona. |
| `identity_confirmed_at` | `datetime` | No |  | Fecha en que se confirmó la identidad (contraseña). |
| `processed_at` | `datetime` | Sí |  | Fecha en que se procesó. |
| `processed_via` | `enum('app','n8n')` | Sí |  | Medio que procesó la baja (app o n8n). |
| `retained_summary` | `text` | Sí |  | Qué datos se conservan y por qué (obligación legal). |
| `notification_status` | `enum('sent','not_configured','failed')` | Sí |  | Estado del aviso enviado a la persona. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `audit_logs`

Bitácora de auditoría de acciones importantes.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | Sí | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `actor_id` | `bigint unsigned` | Sí | FK → users.id | Referencia a users.id (llave foránea). |
| `action` | `varchar(80)` | No |  | Acción registrada. |
| `resource_type` | `varchar(60)` | No |  | Tipo de recurso afectado. |
| `resource_id` | `bigint unsigned` | Sí |  | Identificador del recurso afectado. |
| `metadata_json` | `json` | Sí |  | Datos adicionales en JSON. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |

### `agent_runs`

Bitácora de cada ejecución de un agente de IA (sin contenido).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | Sí | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `course_id` | `bigint unsigned` | Sí | FK → courses.id | Referencia a courses.id (llave foránea). |
| `agent` | `varchar(40)` | No |  | Clave del agente de IA ejecutado. |
| `status` | `enum('running','completed','no_evidence','failed')` | No |  | Estado del registro. |
| `provider` | `varchar(40)` | Sí |  | Proveedor de IA. |
| `model` | `varchar(120)` | Sí |  | Modelo de IA utilizado. |
| `input_chars` | `int` | No |  | Caracteres de entrada enviados al agente. |
| `output_chars` | `int` | Sí |  | Caracteres de salida del agente. |
| `input_tokens` | `int` | Sí |  | Tokens de entrada informados por el proveedor. |
| `output_tokens` | `int` | Sí |  | Tokens de salida informados por el proveedor. |
| `latency_ms` | `int` | Sí |  | Duración en milisegundos. |
| `error_code` | `varchar(40)` | Sí |  | Código del error, si hubo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `prompt_version` | `varchar(80)` | Sí |  | Versión del prompt usada (por ejemplo tutor@1.0.0). |
| `model_tier` | `varchar(20)` | Sí |  | Nivel de modelo elegido por el router (rapido o avanzado). |
| `cache_hit` | `tinyint(1)` | No |  | Si la respuesta vino de la caché de MENTOR. |
| `guard_outcome` | `varchar(40)` | Sí |  | Resultado de los guardrails de salida (pass, alert_… o blocked_…). |
| `cache_read_tokens` | `int` | Sí |  | Tokens leídos de la caché del proveedor. |
| `cache_write_tokens` | `int` | Sí |  | Tokens escritos en la caché del proveedor. |

### `integration_runs`

Bitácora de llamadas a APIs externas y de entradas desde n8n.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `integration` | `varchar(40)` | No |  | Nombre de la integración (hacienda, nager, n8n). |
| `direction` | `enum('outbound','inbound')` | No |  | Dirección de la llamada (entrada o salida). |
| `status` | `enum('ok','error')` | No |  | Estado del registro. |
| `detail` | `varchar(255)` | Sí |  | Detalle legible del evento. |
| `latency_ms` | `int` | Sí |  | Duración en milisegundos. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `exchange_rates`

Tipo de cambio de referencia del dólar por día y fuente.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `rate_date` | `date` | No |  | Fecha del tipo de cambio. |
| `source` | `varchar(30)` | No |  | Fuente del dato. |
| `buy` | `decimal(10,4)` | No |  | Tipo de cambio de compra (CRC por USD). |
| `sell` | `decimal(10,4)` | No |  | Tipo de cambio de venta (CRC por USD). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `reminder_deliveries`

Recordatorios diarios enviados o fallidos por persona y día (evita repetirlos al reintentar).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `reminder_day` | `date` | No |  | Día del recordatorio (AAAA-MM-DD). |
| `status` | `enum('sent','failed')` | No |  | Estado del registro. |
| `attempts` | `int unsigned` | No |  | Intentos de envío registrados. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `rate_limit_hits`

Contadores compartidos de límites por IP (varias instancias).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `rate_key` | `varchar(255)` | No | PK | Clave del límite de solicitudes. |
| `hits` | `int` | No |  | Cantidad de solicitudes en la ventana. |
| `reset_at` | `datetime(3)` | No |  | Momento en que se reinicia el contador. |

### `job_leases`

Turno de tareas periódicas entre instancias del servidor.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `name` | `varchar(60)` | No | PK | Nombre. |
| `owner` | `varchar(64)` | Sí |  | Propietario del registro. |
| `expires_at` | `datetime(3)` | Sí |  | Fecha de vencimiento. |

## Cursos y contenido

### `courses`

Cursos de una institución.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `code` | `varchar(40)` | No |  | Código único. |
| `title` | `varchar(180)` | No |  | Título visible. |
| `description` | `text` | Sí |  | Descripción. |
| `status` | `enum('draft','published','archived')` | No |  | Estado del registro. |
| `created_by` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `course_teachers`

Relación N:M entre cursos y docentes.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `course_id` | `bigint unsigned` | No | PK, FK → courses.id | Referencia a courses.id (llave foránea). |
| `user_id` | `bigint unsigned` | No | PK, FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `enrollments`

Relación N:M entre cursos y estudiantes (matrícula).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `status` | `enum('active','withdrawn')` | No |  | Estado del registro. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `modules`

Módulos de un curso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `topics`

Temas de un módulo.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `module_id` | `bigint unsigned` | No | FK → modules.id | Referencia a modules.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `learning_objective` | `varchar(500)` | Sí |  | Objetivo de aprendizaje. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `topic_prerequisites`

Relación N:M de prerrequisitos entre temas.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `topic_id` | `bigint unsigned` | No | PK, FK → topics.id | Referencia a topics.id (llave foránea). |
| `prerequisite_topic_id` | `bigint unsigned` | No | PK, FK → topics.id | Referencia a topics.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `lessons`

Lecciones de un tema (contenido en Markdown).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `topic_id` | `bigint unsigned` | No | FK → topics.id | Referencia a topics.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `body_md` | `mediumtext` | No |  | Contenido de la lección en Markdown. |
| `status` | `enum('draft','published')` | No |  | Estado del registro. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `video_url` | `varchar(500)` | Sí |  | Enlace de video. |

### `lesson_progress`

Lecciones completadas por cada estudiante.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `lesson_id` | `bigint unsigned` | No | FK → lessons.id | Referencia a lessons.id (llave foránea). |
| `status` | `enum('completed')` | No |  | Estado del registro. |
| `completed_at` | `datetime` | No |  | Fecha en que se completó. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `lesson_comments`

Comentarios en las lecciones.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `lesson_id` | `bigint unsigned` | No | FK → lessons.id | Referencia a lessons.id (llave foránea). |
| `author_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `parent_id` | `bigint unsigned` | Sí | FK → lesson_comments.id | Referencia a lesson_comments.id (llave foránea). |
| `body` | `text` | No |  | Texto del contenido. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `materials`

Materiales del curso (archivos o enlaces).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `lesson_id` | `bigint unsigned` | Sí | FK → lessons.id | Referencia a lessons.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `kind` | `enum('link','file')` | No |  | Tipo de registro. |
| `url` | `varchar(500)` | Sí |  | Dirección web (HTTPS). |
| `file_name` | `varchar(200)` | Sí |  | Nombre original del archivo. |
| `stored_name` | `varchar(120)` | Sí |  | Nombre interno del archivo guardado. |
| `mime_type` | `varchar(120)` | Sí |  | Tipo de archivo (MIME). |
| `size_bytes` | `int` | Sí |  | Tamaño en bytes. |
| `content_sha256` | `char(64)` | Sí |  | Huella SHA-256 del archivo original para comprobar que una descarga o restauración es idéntica. |
| `uploaded_by` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `announcements`

Anuncios del curso (Novedades).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `author_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `body` | `text` | No |  | Texto del contenido. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `class_sessions`

Clases en vivo programadas.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `topic_id` | `bigint unsigned` | Sí | FK → topics.id | Referencia a topics.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `description` | `text` | Sí |  | Descripción. |
| `starts_at` | `datetime` | No |  | Fecha y hora de inicio. |
| `duration_minutes` | `int` | No |  | Duración en minutos. |
| `meeting_url` | `varchar(500)` | No |  | Enlace de la clase en vivo. |
| `recording_url` | `varchar(500)` | Sí |  | Enlace de la grabación. |
| `status` | `enum('scheduled','cancelled')` | No |  | Estado del registro. |
| `created_by` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `session_attendance`

Asistencia a clases en vivo.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `session_id` | `bigint unsigned` | No | FK → class_sessions.id | Referencia a class_sessions.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `joined_at` | `datetime` | No |  | Fecha de ingreso a la clase. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

## Evaluación y calificaciones

### `assessments`

Evaluaciones con corrección automática.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `topic_id` | `bigint unsigned` | No | FK → topics.id | Referencia a topics.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `status` | `enum('draft','published','closed')` | No |  | Estado del registro. |
| `passing_score` | `int` | No |  | Porcentaje mínimo para aprobar. |
| `max_attempts` | `int` | No |  | Intentos máximos permitidos. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `questions`

Preguntas de una evaluación.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `assessment_id` | `bigint unsigned` | No | FK → assessments.id | Referencia a assessments.id (llave foránea). |
| `topic_id` | `bigint unsigned` | No | FK → topics.id | Referencia a topics.id (llave foránea). |
| `stem` | `text` | No |  | Enunciado de la pregunta. |
| `explanation` | `text` | Sí |  | Explicación de la respuesta correcta. |
| `points` | `int` | No |  | Puntos asignados. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `question_options`

Opciones de respuesta (incluye la clave, nunca visible para el estudiante).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `question_id` | `bigint unsigned` | No | FK → questions.id | Referencia a questions.id (llave foránea). |
| `body` | `varchar(500)` | No |  | Texto del contenido. |
| `is_correct` | `tinyint(1)` | No |  | Indica si la opción o respuesta es correcta. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `assessment_attempts`

Intentos de evaluación y su puntaje.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `assessment_id` | `bigint unsigned` | No | FK → assessments.id | Referencia a assessments.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `status` | `enum('in_progress','submitted')` | No |  | Estado del registro. |
| `score_pct` | `decimal(5,2)` | Sí |  | Porcentaje obtenido. |
| `earned_points` | `int` | Sí |  | Puntos obtenidos. |
| `total_points` | `int` | Sí |  | Puntaje total. |
| `submitted_at` | `datetime` | Sí |  | Fecha de entrega. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `attempt_answers`

Respuestas de cada intento.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `attempt_id` | `bigint unsigned` | No | FK → assessment_attempts.id | Referencia a assessment_attempts.id (llave foránea). |
| `question_id` | `bigint unsigned` | No | FK → questions.id | Referencia a questions.id (llave foránea). |
| `selected_option_id` | `bigint unsigned` | Sí | FK → question_options.id | Referencia a question_options.id (llave foránea). |
| `is_correct` | `tinyint(1)` | No |  | Indica si la opción o respuesta es correcta. |
| `earned_points` | `int` | No |  | Puntos obtenidos. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `assignments`

Tareas del curso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `topic_id` | `bigint unsigned` | Sí | FK → topics.id | Referencia a topics.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `instructions` | `text` | No |  | Instrucciones de la tarea. |
| `due_at` | `datetime` | Sí |  | Fecha límite. |
| `max_points` | `int` | No |  | Puntaje máximo. |
| `status` | `enum('draft','published')` | No |  | Estado del registro. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `assignment_submissions`

Entregas de tareas y su calificación.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `assignment_id` | `bigint unsigned` | No | FK → assignments.id | Referencia a assignments.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `body` | `text` | No |  | Texto del contenido. |
| `link_url` | `varchar(500)` | Sí |  | Enlace adjunto (HTTPS). |
| `submitted_at` | `datetime` | No |  | Fecha de entrega. |
| `grade_points` | `int` | Sí |  | Puntos asignados por el docente. |
| `feedback` | `text` | Sí |  | Retroalimentación del docente. |
| `graded_by` | `bigint unsigned` | Sí | FK → users.id | Referencia a users.id (llave foránea). |
| `graded_at` | `datetime` | Sí |  | Fecha en que se calificó. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `course_grade_policies`

Pesos de la nota final y valores del bono por curso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `course_id` | `bigint unsigned` | No | PK, FK → courses.id | Referencia a courses.id (llave foránea). |
| `assessments_weight` | `int` | No |  | Peso (%) de las evaluaciones en la nota final. |
| `assignments_weight` | `int` | No |  | Peso (%) de las tareas en la nota final. |
| `classwork_weight` | `int` | No |  | Peso (%) del trabajo en clase en la nota final. |
| `quiz_bonus` | `decimal(4,2)` | No |  | Puntos extra por quizzes perfectos (0,1 c/u). |
| `streak_day_bonus` | `decimal(4,2)` | No |  | Puntos por día de racha (0,09). |
| `bonus_cap` | `decimal(4,2)` | No |  | Tope de puntos extra que fija el docente. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `class_work_items`

Actividades de trabajo en clase.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `max_points` | `int` | No |  | Puntaje máximo. |
| `work_date` | `date` | Sí |  | Fecha del trabajo en clase. |
| `created_by` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `class_work_grades`

Notas de trabajo en clase por estudiante.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `item_id` | `bigint unsigned` | No | FK → class_work_items.id | Referencia a class_work_items.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `points` | `decimal(6,2)` | No |  | Puntos asignados. |
| `feedback` | `varchar(1000)` | Sí |  | Retroalimentación del docente. |
| `graded_by` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `grade_bonus_events`

Bono ganado (quiz perfecto o día de racha), una vez por evento.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `kind` | `enum('quiz','streak_day')` | No |  | Tipo de registro. |
| `reference` | `varchar(40)` | No |  | Referencia externa. |
| `amount` | `decimal(5,2)` | No |  | Monto o cantidad registrada. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

## Quizzes, racha y aprendizaje

### `quick_quizzes`

Quizzes rápidos con tiempo por pregunta.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `status` | `enum('draft','published','archived')` | No |  | Estado del registro. |
| `seconds_per_question` | `int` | No |  | Segundos por pregunta del quiz. |
| `created_by` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `quick_quiz_questions`

Preguntas de un quiz rápido (banco de la práctica diaria).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `quiz_id` | `bigint unsigned` | No | FK → quick_quizzes.id | Referencia a quick_quizzes.id (llave foránea). |
| `prompt` | `varchar(500)` | No |  | Enunciado de la pregunta. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `quick_quiz_options`

Opciones de un quiz rápido.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `question_id` | `bigint unsigned` | No | FK → quick_quiz_questions.id | Referencia a quick_quiz_questions.id (llave foránea). |
| `body` | `varchar(200)` | No |  | Texto del contenido. |
| `is_correct` | `tinyint(1)` | No |  | Indica si la opción o respuesta es correcta. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `quiz_plays`

Partidas de un estudiante.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `quiz_id` | `bigint unsigned` | No | FK → quick_quizzes.id | Referencia a quick_quizzes.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `status` | `enum('in_progress','finished')` | No |  | Estado del registro. |
| `total_questions` | `int` | No |  | Cantidad total de preguntas. |
| `correct_count` | `int` | No |  | Cantidad de respuestas correctas. |
| `score` | `int` | No |  | Puntaje obtenido. |
| `perfect` | `tinyint(1)` | No |  | Indica si el quiz se respondió completo y sin errores. |
| `finished_at` | `datetime` | Sí |  | Fecha y hora de finalización. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `quiz_play_answers`

Respuestas de una partida con el momento medido por el servidor.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `play_id` | `bigint unsigned` | No | FK → quiz_plays.id | Referencia a quiz_plays.id (llave foránea). |
| `question_id` | `bigint unsigned` | No | FK → quick_quiz_questions.id | Referencia a quick_quiz_questions.id (llave foránea). |
| `option_id` | `bigint unsigned` | Sí | FK → quick_quiz_options.id | Referencia a quick_quiz_options.id (llave foránea). |
| `shown_at` | `datetime(3)` | No |  | Fecha en que se mostró. |
| `answered_at` | `datetime(3)` | Sí |  | Fecha y hora de la respuesta. |
| `is_correct` | `tinyint(1)` | Sí |  | Indica si la opción o respuesta es correcta. |
| `points` | `int` | No |  | Puntos asignados. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `daily_practices`

Práctica diaria de 5 preguntas por estudiante y curso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `practice_day` | `date` | No |  | Día de la práctica. |
| `question_ids` | `json` | No |  | Preguntas asignadas (JSON). |
| `answered_count` | `int` | No |  | Cantidad de preguntas respondidas. |
| `completed_at` | `datetime` | Sí |  | Fecha en que se completó. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `daily_practice_answers`

Respuestas de la práctica diaria.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `practice_id` | `bigint unsigned` | No | FK → daily_practices.id | Referencia a daily_practices.id (llave foránea). |
| `question_id` | `bigint unsigned` | No | FK → quick_quiz_questions.id | Referencia a quick_quiz_questions.id (llave foránea). |
| `option_id` | `bigint unsigned` | Sí | FK → quick_quiz_options.id | Referencia a quick_quiz_options.id (llave foránea). |
| `is_correct` | `tinyint(1)` | No |  | Indica si la opción o respuesta es correcta. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `course_streaks`

Racha actual y mejor racha por curso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `current_days` | `int` | No |  | Días seguidos de la racha actual. |
| `best_days` | `int` | No |  | Mejor racha alcanzada (días). |
| `last_day` | `date` | Sí |  | Último día con práctica cumplida. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `topic_mastery`

Dominio estimado por tema y estudiante.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `topic_id` | `bigint unsigned` | No | FK → topics.id | Referencia a topics.id (llave foránea). |
| `mastery_score` | `decimal(4,3)` | No |  | Dominio del tema (0 a 100). |
| `evidence_count` | `int` | No |  | Cantidad de pasajes usados como evidencia. |
| `algorithm_version` | `varchar(40)` | No |  | Versión del algoritmo de repaso espaciado. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `learning_recommendations`

Recomendaciones de estudio generadas por reglas.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `topic_id` | `bigint unsigned` | No | FK → topics.id | Referencia a topics.id (llave foránea). |
| `next_topic_id` | `bigint unsigned` | Sí | FK → topics.id | Referencia a topics.id (llave foránea). |
| `type` | `enum('reinforce','practice','advance')` | No |  | Tipo. |
| `reason` | `varchar(500)` | No |  | Motivo indicado por la persona. |
| `status` | `enum('active','replaced','dismissed')` | No |  | Estado del registro. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `topic_reviews`

Programación del repaso espaciado (FSRS) por tema.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `topic_id` | `bigint unsigned` | No | FK → topics.id | Referencia a topics.id (llave foránea). |
| `stability` | `decimal(9,3)` | No |  | Estabilidad del recuerdo (repaso espaciado). |
| `difficulty` | `decimal(5,3)` | No |  | Dificultad estimada del tema para el estudiante. |
| `due_at` | `datetime` | No |  | Fecha límite. |
| `last_reviewed_at` | `datetime` | No |  | Fecha del último repaso. |
| `reps` | `int` | No |  | Repeticiones del repaso espaciado. |
| `lapses` | `int` | No |  | Veces que se olvidó el tema. |
| `last_grade` | `tinyint` | No |  | Última calificación del repaso. |
| `algorithm_version` | `varchar(40)` | No |  | Versión del algoritmo de repaso espaciado. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `topic_review_logs`

Historial de repasos.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `review_id` | `bigint unsigned` | No | FK → topic_reviews.id | Referencia a topic_reviews.id (llave foránea). |
| `grade` | `tinyint` | No |  | Nota obtenida. |
| `source` | `enum('assessment','self')` | No |  | Fuente del dato. |
| `elapsed_days` | `decimal(9,3)` | No |  | Días transcurridos desde el último repaso. |
| `scheduled_days` | `int` | No |  | Días hasta el próximo repaso. |
| `reviewed_at` | `datetime` | No |  | Fecha de revisión. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |

### `study_plans`

Planes de estudio del estudiante.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `student_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `start_date` | `date` | No |  | Fecha de inicio. |
| `target_date` | `date` | No |  | Fecha objetivo. |
| `minutes_per_session` | `smallint` | No |  | Minutos por sesión de estudio. |
| `study_days` | `varchar(20)` | No |  | Días de la semana para estudiar. |
| `time_zone` | `varchar(64)` | No |  | Zona horaria. |
| `unscheduled_minutes` | `int` | No |  | Minutos sin asignar del plan. |
| `status` | `enum('active','archived')` | No |  | Estado del registro. |
| `algorithm_version` | `varchar(40)` | No |  | Versión del algoritmo de repaso espaciado. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `study_plan_items`

Sesiones de un plan de estudio.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `study_plan_id` | `bigint unsigned` | No | FK → study_plans.id | Referencia a study_plans.id (llave foránea). |
| `topic_id` | `bigint unsigned` | No | FK → topics.id | Referencia a topics.id (llave foránea). |
| `kind` | `enum('learn','reinforce','practice','review')` | No |  | Tipo de registro. |
| `description` | `varchar(300)` | No |  | Descripción. |
| `minutes` | `smallint` | No |  | Minutos planificados. |
| `scheduled_date` | `date` | No |  | Fecha programada. |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `status` | `enum('pending','done','skipped')` | No |  | Estado del registro. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

## Tutor IA, fuentes e integraciones

### `ai_threads`

Conversaciones con el tutor.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `title` | `varchar(180)` | No |  | Título visible. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `ai_messages`

Mensajes de una conversación con el tutor.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `thread_id` | `bigint unsigned` | No | FK → ai_threads.id | Referencia a ai_threads.id (llave foránea). |
| `role` | `enum('user','assistant')` | No |  | Código del rol (FK a roles). |
| `content` | `text` | No |  | Texto del mensaje o contenido. |
| `citations_json` | `json` | Sí |  | Citas verificadas de la respuesta (JSON). |
| `grounded` | `tinyint(1)` | Sí |  | Indica si la respuesta se basó en evidencia. |
| `model` | `varchar(120)` | Sí |  | Modelo de IA utilizado. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `kind` | `enum('answer','notice')` | No |  | Tipo de registro. |
| `notice_code` | `varchar(60)` | Sí |  | Código del aviso mostrado. |

### `ai_message_sources`

Citas de cada respuesta del tutor.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `message_id` | `bigint unsigned` | No | FK → ai_messages.id | Referencia a ai_messages.id (llave foránea). |
| `source_id` | `bigint unsigned` | No | FK → knowledge_sources.id | Referencia a knowledge_sources.id (llave foránea). |
| `source_version_id` | `bigint unsigned` | No | FK → source_versions.id | Referencia a source_versions.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `position` | `int` | No |  | Orden dentro de su grupo. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |

### `ai_usage_events`

Consumo técnico del tutor (cuota, tokens, latencia).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `user_id` | `bigint unsigned` | No | FK → users.id | Referencia a users.id (llave foránea). |
| `course_id` | `bigint unsigned` | Sí | FK → courses.id | Referencia a courses.id (llave foránea). |
| `provider` | `varchar(30)` | Sí |  | Proveedor de IA. |
| `model` | `varchar(120)` | Sí |  | Modelo de IA utilizado. |
| `retrieval_mode` | `varchar(20)` | Sí |  | Modo de recuperación de pasajes. |
| `streamed` | `tinyint(1)` | No |  | Indica si la respuesta se transmitió en vivo. |
| `outcome` | `enum('reserved','completed','no_evidence','no_citations','invalid_format','provider_error','retrieval_error','cancelled','guard_blocked')` | No |  | Resultado de la operación. |
| `latency_ms` | `int` | Sí |  | Duración en milisegundos. |
| `input_tokens` | `int` | Sí |  | Tokens de entrada informados por el proveedor. |
| `output_tokens` | `int` | Sí |  | Tokens de salida informados por el proveedor. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `prompt_version` | `varchar(80)` | Sí |  | Versión del prompt usada (por ejemplo tutor@1.0.0). |
| `model_tier` | `varchar(20)` | Sí |  | Nivel de modelo elegido por el router (rapido o avanzado). |
| `cache_hit` | `tinyint(1)` | No |  | Si la respuesta vino de la caché de MENTOR. |
| `guard_outcome` | `varchar(40)` | Sí |  | Resultado de los guardrails de salida (pass, alert_… o blocked_…). |
| `cache_read_tokens` | `int` | Sí |  | Tokens leídos de la caché del proveedor. |
| `cache_write_tokens` | `int` | Sí |  | Tokens escritos en la caché del proveedor. |

### `ai_usage_monthly`

Resumen mensual del consumo de IA.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `month` | `char(7)` | No |  | Mes del resumen (AAAA-MM). |
| `provider` | `varchar(30)` | No |  | Proveedor de IA. |
| `model` | `varchar(120)` | No |  | Modelo de IA utilizado. |
| `outcome` | `varchar(30)` | No |  | Resultado de la operación. |
| `events` | `int` | No |  | Cantidad de eventos del periodo. |
| `input_tokens` | `bigint` | No |  | Tokens de entrada informados por el proveedor. |
| `output_tokens` | `bigint` | No |  | Tokens de salida informados por el proveedor. |
| `latency_ms_total` | `bigint` | No |  | Latencia acumulada en milisegundos. |

### `ai_response_cache`

Respuestas reutilizables de agentes con entrada no personal (hoy, resúmenes de lección) por institución.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `cache_key` | `char(64)` | No | UQ | Huella de institución, agente, versión del prompt, modelo y entrada. |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `agent` | `varchar(40)` | No |  | Clave del agente de IA ejecutado. |
| `prompt_version` | `varchar(80)` | No |  | Versión del prompt usada (por ejemplo tutor@1.0.0). |
| `model` | `varchar(120)` | No |  | Modelo de IA utilizado. |
| `source_ref` | `varchar(60)` | No |  | Fuente de la que salió la respuesta (por ejemplo lesson:12). |
| `output_json` | `json` | No |  | Respuesta validada que se reutiliza. |
| `hits` | `int unsigned` | No |  | Cantidad de solicitudes en la ventana. |
| `expires_at` | `datetime` | No |  | Fecha de vencimiento. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `knowledge_sources`

Fuentes del tutor (lecciones, materiales y Drive).

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `origin` | `enum('lesson','material','drive')` | No |  | Origen del registro. |
| `source_key` | `varchar(180)` | No |  | Clave única de la fuente. |
| `lesson_id` | `bigint unsigned` | Sí | FK → lessons.id | Referencia a lessons.id (llave foránea). |
| `material_id` | `bigint unsigned` | Sí | FK → materials.id | Referencia a materials.id (llave foránea). |
| `drive_file_id` | `varchar(128)` | Sí |  | Identificador del archivo en Google Drive. |
| `title` | `varchar(200)` | No |  | Título visible. |
| `status` | `enum('active','retired')` | No |  | Estado del registro. |
| `retired_at` | `datetime` | Sí |  | Fecha de retiro. |
| `retire_reason` | `varchar(60)` | Sí |  | Motivo del retiro. |
| `active_version_id` | `bigint unsigned` | Sí |  | Versión vigente que usa el tutor. |
| `cleanup_status` | `enum('none','pending','done','error')` | No |  | Estado de la limpieza del archivo remoto. |
| `cleanup_attempts` | `int` | No |  | Intentos de limpieza del archivo remoto. |
| `cleanup_error` | `varchar(500)` | Sí |  | Último error de limpieza. |
| `created_by` | `bigint unsigned` | Sí | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `drive_link_id` | `bigint unsigned` | Sí | FK → course_drive_links.id | Referencia a course_drive_links.id (llave foránea). |
| `last_seen_run` | `varchar(36)` | Sí |  | Última sincronización en que se vio el archivo. |

### `source_versions`

Versiones indexadas de cada fuente.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `source_id` | `bigint unsigned` | No | FK → knowledge_sources.id | Referencia a knowledge_sources.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `version_no` | `int` | No |  | Número de versión. |
| `content_hash` | `char(64)` | No |  | Huella SHA-256 del contenido para detectar cambios. |
| `state` | `enum('pending','processing','ready','error','superseded','retired')` | No |  | Estado del proceso. |
| `error_code` | `varchar(60)` | Sí |  | Código del error, si hubo. |
| `error_message` | `varchar(500)` | Sí |  | Mensaje de error sin datos personales. |
| `text_content` | `longtext` | No |  | Texto extraído para el tutor. |
| `char_count` | `int` | No |  | Cantidad de caracteres del texto. |
| `pages_json` | `json` | Sí |  | Páginas del documento (JSON). |
| `mime_type` | `varchar(120)` | Sí |  | Tipo de archivo (MIME). |
| `external_revision` | `varchar(120)` | Sí |  | Revisión del archivo en el sistema externo. |
| `gcs_uri` | `varchar(500)` | Sí |  | Ubicación del archivo en Cloud Storage. |
| `rag_file_name` | `varchar(400)` | Sí |  | Nombre del archivo en el corpus RAG. |
| `import_operation` | `varchar(400)` | Sí |  | Operación de importación en Vertex AI. |
| `import_attempts` | `int` | No |  | Intentos de importación al corpus. |
| `remote_cleanup` | `enum('none','pending','done','error')` | No |  | Indica si falta limpiar el archivo remoto. |
| `ready_at` | `datetime` | Sí |  | Fecha en que quedó lista para el tutor. |
| `created_by` | `bigint unsigned` | Sí | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |
| `text_purged_at` | `datetime` | Sí |  | Fecha en que se depuró el texto. |

### `course_rag_corpora`

Corpus de RAG Engine de cada curso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `corpus_name` | `varchar(300)` | Sí |  | Nombre del corpus en Vertex AI RAG Engine. |
| `operation_name` | `varchar(400)` | Sí |  | Nombre de la operación remota. |
| `status` | `enum('pending','creating','ready','error')` | No |  | Estado del registro. |
| `last_error` | `varchar(500)` | Sí |  | Último error registrado. |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `course_drive_links`

Carpetas de Drive vinculadas a un curso.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `course_id` | `bigint unsigned` | No | FK → courses.id | Referencia a courses.id (llave foránea). |
| `drive_folder_id` | `bigint unsigned` | No | FK → institution_drive_folders.id | Referencia a institution_drive_folders.id (llave foránea). |
| `status` | `enum('active','removed')` | No |  | Estado del registro. |
| `sync_state` | `enum('idle','running','interrupted','error')` | No |  | Estado de sincronización con Drive. |
| `sync_run_id` | `varchar(36)` | Sí |  | Sincronización que lo detectó. |
| `page_token` | `text` | Sí |  | Marcador de página de la API externa. |
| `files_listed` | `int` | No |  | Archivos encontrados en la sincronización. |
| `last_sync_started_at` | `datetime` | Sí |  | Inicio de la última sincronización. |
| `last_sync_completed_at` | `datetime` | Sí |  | Fin de la última sincronización. |
| `last_error` | `varchar(500)` | Sí |  | Último error registrado. |
| `created_by` | `bigint unsigned` | Sí | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

### `institution_drive_folders`

Carpetas de Drive autorizadas por la institución.

| Campo | Tipo | Nulo | Llave | Propósito |
| --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | No | PK | Identificador único (llave primaria). |
| `institution_id` | `bigint unsigned` | No | FK → institutions.id | Referencia a institutions.id (llave foránea). |
| `folder_id` | `varchar(128)` | No |  | Identificador de la carpeta de Google Drive. |
| `label` | `varchar(180)` | No |  | Etiqueta visible. |
| `status` | `enum('enabled','disabled')` | No |  | Estado del registro. |
| `created_by` | `bigint unsigned` | Sí | FK → users.id | Referencia a users.id (llave foránea). |
| `created_at` | `datetime` | No |  | Fecha y hora de creación. |
| `updated_at` | `datetime` | No |  | Fecha y hora de la última modificación. |

## Normalización

El modelo está en tercera forma normal (3FN):

- **1FN:** cada columna guarda un valor atómico. Las listas (opciones, preguntas, notas) van en tablas hijas. Las únicas columnas JSON son metadatos técnicos o listas de identificadores que no se consultan por sus partes (`daily_practices.question_ids`).
- **2FN:** las tablas de relación (`enrollments`, `course_teachers`, `topic_prerequisites`) solo guardan datos de la relación.
- **3FN:** no hay dependencias transitivas. El nombre del curso, del rol o del docente se obtiene por llave foránea y no se copia. Las únicas excepciones son resúmenes deliberados, por rendimiento o auditoría (`ai_usage_monthly`, y el monto del bono guardado en el evento para conservar el valor vigente cuando se ganó).
