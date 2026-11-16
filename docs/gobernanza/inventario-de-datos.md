# Inventario de datos

Última revisión: 2026-11-16 (retención y coordinación entre instancias). El material importado se trata como **datos**, nunca como instrucciones.

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
| Auditoría | MySQL `audit_logs` | MENTOR | Administración | Sin contenido de documentos | Administración de la institución |

## Qué recibe el proveedor de generación
El prompt del sistema, hasta 6 fragmentos (máximo 1800 caracteres cada uno) con título y página o sección, la pregunta y hasta 6 mensajes previos del mismo hilo. Se omiten los turnos que citaron fuentes retiradas. No se envían nombres, correos ni identificadores.

## Qué no se registra
El registro técnico (`ai_usage_events` y la línea `tutor.consulta` del servidor) no guarda credenciales, preguntas, respuestas ni contenido de documentos. Las claves viven en `.env` (no versionado) o en ADC.

## Retención automática
Una vez al día (`RETENTION_INTERVAL_MINUTES`), la instancia con el turno de tareas aplica las reglas anteriores. Con `0` en un plazo, esa regla no borra nada. Borrar una conversación también quita sus citas, así que el contador «usada en respuestas» del docente baja en consecuencia.
