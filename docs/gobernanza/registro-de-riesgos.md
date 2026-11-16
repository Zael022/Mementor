# Registro de riesgos

Última revisión: 2026-11-16 (después de aplicar las 15 mejoras de la revisión). Nivel: A alto, M medio, B bajo.

| # | Riesgo | Nivel | Mitigación aplicada | Pendiente | Responsable |
| --- | --- | --- | --- | --- | --- |
| R1 | Fuga entre cursos o instituciones en la recuperación | A | Curso resuelto desde la sesión; corpus por curso; `ragFileIds` limitados a fuentes activas; cada resultado se contrasta con MySQL; pruebas con dos cursos y dos instituciones | Repetir la prueba con un proyecto real de Google Cloud | Operador |
| R2 | Instrucciones maliciosas dentro de documentos (prompt injection) | M | `<` y `>` del texto se neutralizan, así que un documento no puede cerrar su `<fuente>` ni imitar la `<pregunta>` (prueba con documento hostil); el modelo no tiene herramientas; respuesta validada con Zod y citas | Repetir la prueba hostil contra un modelo real | Operador |
| R3 | Respuestas sin respaldo | M | Sin evidencia no se llama al modelo; sin cita válida no se muestra la respuesta | Calibrar `RAG_VECTOR_DISTANCE_THRESHOLD` con material real | Docente y operador |
| R4 | Fuente retirada que sigue apareciendo | M | Exclusión inmediata en MySQL; historial y citas marcadas; limpieza remota con reintentos | — | Docente |
| R5 | Costos de Google Cloud (Spanner de RagManagedDb, embeddings, almacenamiento) | M | Topes de documentos y consultas; modo local para desarrollo | Revisar la facturación del proyecto; pasar RagManagedDb a «Unprovisioned» al terminar pruebas | Operador |
| R6 | Costos del proveedor de generación | M | Límite diario por persona e institución con reserva atómica; registro de tokens | Fijar tarifas verificadas antes de mostrar costos | Operador |
| R7 | Región sin disponibilidad o con lista de acceso | M | `.env.example` sugiere europe-west4 (GA) | Confirmar región, cuotas y APIs habilitadas en el proyecto | Operador |
| R8 | Permisos excesivos de la identidad del servidor | M | Roles mínimos documentados; Drive solo lectura; borrado limitado al prefijo | Separar identidades de Drive y de Vertex si la institución lo exige | Operador |
| R9 | Archivos sin texto (PDF escaneado) | B | Detectado (`PDF_NO_TEXT`) y explicado al docente | OCR como mejora futura | Docente |
| R10 | Sincronización de Drive interrumpida | B | Reanudación por página; no se retiran archivos sin listar | — | Docente |
| R11 | Retención indefinida de conversaciones | B | Borrado automático tras 365 días sin actividad (configurable); consumo resumido por mes; texto de versiones sin citas borrado a los 30 días | Exportación o borrado a pedido de la persona | Administración |
| R12 | Dependencias con avisos de seguridad | B | `npm audit` revisado | Avisos heredados de `sequelize` (`uuid`) | Desarrollo |
| R13 | Límites por IP compartidos por todos detrás de un proxy | M | `TRUST_PROXY` configurable (rechaza `true`); prueba con dos IP distintas detrás del proxy | Configurarlo en cada despliegue | Operador |
| R14 | Archivos con extensión falsa | B | Validación de los primeros bytes antes de guardar; el archivo rechazado se borra | — | Desarrollo |
| R15 | Varias instancias duplicando tareas o límites | B | Turno de tareas en MySQL; `RATE_LIMIT_STORE=mysql` comparte los límites | — | Operador |
| R16 | IP guardadas en `rate_limit_hits` | B | Solo con el almacén compartido; se borran una hora después de vencer | — | Operador |
| R17 | Lectores de pantalla en el chat en vivo | M | El borrador ya no es región viva; un aviso único dice «Respuesta lista» | Probar con NVDA y VoiceOver | Desarrollo |
