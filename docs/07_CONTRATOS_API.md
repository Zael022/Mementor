# Contrato API REST MVP

Prefijo: `/api/v1`. JSON: `{ "data": ... , "meta": ... }` éxito; `{ "error": {"code":"...","message":"...","details":...}, "requestId":"..." }` error. Fechas ISO8601 UTC. Sesión preferible con cookie httpOnly + CSRF para mutaciones; permisos backend obligatorios.

## Salud y sesión
| Método | Ruta | Acceso | Operación |
|---|---|---|---|
| GET | `/health` | Público | API+DB salud sin credenciales |
| POST | `/auth/login` | Público | Crear sesión |
| POST | `/auth/logout` | Autenticado | Cerrar sesión |
| GET | `/auth/me` | Autenticado | Perfil y rol actuales |
| GET | `/auth/csrf` | Público/session | Token CSRF si aplica |

## Instituciones / cursos
| Método | Ruta | Acceso |
|---|---|---|
| GET | `/courses` | Cursos propios/autorizados |
| POST | `/courses` | Teacher permitido / admin institución |
| GET | `/courses/:courseId` | Matriculado/teacher/admin |
| PATCH | `/courses/:courseId` | Teacher asignado/admin |
| POST | `/courses/:courseId/enrollments` | Admin / docente permitido |
| GET | `/courses/:courseId/enrollments` | Docente asignado/admin |
| POST | `/courses/:courseId/modules` | Docente asignado |
| POST | `/topics/:topicId/lessons` | Docente asignado |
| GET | `/topics/:topicId/lessons` | Participante autorizado |

## Exámenes
| Método | Ruta | Acceso |
|---|---|---|
| POST | `/courses/:courseId/assessments` | Docente asignado |
| POST | `/assessments/:id/questions` | Docente asignado |
| POST | `/assessments/:id/publish` | Docente asignado |
| GET | `/assessments/:id` | Participante autorizado, sin claves para alumno |
| POST | `/assessments/:id/attempts` | Estudiante matriculado |
| POST | `/attempts/:id/submit` | Estudiante propietario (transacción e idempotencia) |
| GET | `/attempts/:id/result` | Propietario / docente asignado |

## IA / progreso / estudio
| Método | Ruta | Acceso |
|---|---|---|
| GET | `/me/mastery?courseId=` | Estudiante propio |
| GET | `/me/recommendations?courseId=` | Estudiante propio |
| POST | `/courses/:courseId/tutor/threads` | Participante autorizado |
| POST | `/tutor/threads/:id/messages` | Dueño y curso autorizado |
| GET | `/tutor/threads/:id/messages` | Dueño |
| GET | `/courses/:courseId/study-plan` | Estudiante matriculado (su plan vigente o `null`) |
| POST | `/courses/:courseId/study-plan` | Estudiante matriculado (archiva el anterior) |
| PATCH | `/study-plan-items/:id` | Dueño del plan |
| DELETE | `/study-plans/:id` | Dueño del plan (archiva) |
| GET | `/me/reviews?courseId=` | Estudiante propio (repaso espaciado) |
| POST | `/topics/:topicId/reviews` | Estudiante matriculado; solo si el repaso ya toca (`409 REVIEW_NOT_DUE`) |
| GET/PATCH | `/me/preferences` | Cualquier cuenta (solo las propias) |
| GET/PATCH | `/me/profile` | Datos personales propios |
| POST | `/me/password` · `/me/email` | Propia cuenta, con la contraseña actual |
| POST/DELETE | `/me/avatar` | Foto propia (multipart `avatar`) |
| GET | `/users/:id/avatar` | Misma institución o la propia persona |
| GET | `/teacher/courses/:id/analytics` | Docente asignado |
| POST | `/teacher/courses/:id/ai-question-drafts` | Docente asignado |
| POST | `/teacher/ai-question-drafts/:id/approve` | Docente asignado |

## Contrato de respuesta tutor
Retornar `{data: {messageId, answer, citations, grounded, suggestedTopicId}}` con datos **reales**, provenientes del curso autorizado y del proveedor configurado. Si no existe API de IA configurada, retornar `AI_NOT_CONFIGURED (503)`. No precargar respuestas ni mensajes.

## Códigos de error
`UNAUTHENTICATED(401)`, `FORBIDDEN(403)`, `NOT_FOUND(404)`, `VALIDATION_ERROR(422)`, `ALREADY_SUBMITTED(409)`, `RATE_LIMITED(429)`, `AI_UNAVAILABLE(503)`, `AI_NOT_CONFIGURED(503)`. No incluir detalles de SQL, hashes o prompts internos en respuestas.

## Requisitos transversales
Paginación (`page`,`limit`), filtros y ordering allowlist, validaciones de payload, sanitización de material, límites de tamaño, rate limiting para login e IA, requestId y tests de autorización.

El archivo `ejemplos/openapi_minimo.yaml` declara un pequeño subconjunto para orientar la primera implementación. El backend debe mantener el contrato completo actualizado durante desarrollo.

## Fuentes del tutor, RAG, Drive y consumo (2026-11-16)
Todas bajo `/api/v1`, con sesión y CSRF. El curso y su corpus se resuelven en el servidor.

| Método y ruta | Rol | Qué hace |
| --- | --- | --- |
| `GET /courses/:id/knowledge` | docente, admin. institución | Fuentes del curso con estado, versiones, uso en respuestas y lo que falta indexar |
| `POST /courses/:id/knowledge/index-existing` | docente, admin. institución | Indexa lecciones publicadas y archivos existentes |
| `POST /knowledge/versions/:id/retry` | docente, admin. institución | Reintenta una versión con error o actualiza una importación en curso |
| `POST /knowledge/sources/:id/retire` | docente, admin. institución | Retira la fuente de inmediato |
| `POST /tutor/threads/:id/messages` | estudiante, docente | Respuesta completa (JSON): `{ status: answer\|notice, answer, citations[], noticeCode }` |
| `POST /tutor/threads/:id/messages/stream` | estudiante, docente | SSE: `start`, `delta {text}`, `final {…igual que JSON}`, `error {code,message}` |
| `GET /tutor/messages/:id/citations/:n` | dueño del hilo | Pasaje de la cita, título, página o sección y versión; `410 SOURCE_RETIRED` si se retiró |
| `GET/POST /institution/drive-folders`, `POST /institution/drive-folders/:id/disable` | admin. institución | Carpetas de Drive habilitadas (se comprueba el acceso) |
| `GET/PUT/DELETE /courses/:id/drive`, `POST /courses/:id/drive/sync` | docente, admin. institución | Vincular carpeta y sincronizar (202) |
| `GET /institution/ai-usage`, `GET /institution/ai-usage/events` | admin. institución | Consumo por modelo y resultado, sin contenido |
| `PATCH /institutions/:id/limits` | admin. plataforma | `{ maxDocuments, aiDailyQuestionLimit }` (null = valor del servidor) |

Errores nuevos: `NO_EVIDENCE` y `NO_VALID_CITATIONS` (avisos con estado 200/201), `AI_INVALID_FORMAT` (502), `RAG_UNAVAILABLE` y `RAG_NOT_CONFIGURED` (503), `RATE_LIMITED` e `INSTITUTION_QUOTA` (429), `DOCUMENT_LIMIT` (409), `ASSESSMENT_CLOSED` (409, también al entregar un intento pendiente).

## CRM de admisiones (2026-11-20)

Todas las rutas tienen prefijo `/api/v1/crm`. Sesión y CSRF existentes. Cuerpos Zod estrictos: institución, actor, rol, aprobador, cuenta/matrícula creada y consumo nunca se aceptan como controles del cliente. Detalle de reglas, configuración y ejemplos reproducibles en [CRM.md](CRM.md).

| Método/ruta CRM | Acceso | Contrato |
| --- | --- | --- |
| `POST /prospectos` | administración institución | `{convocatoriaId,nombre,correo,telefono?,procedencia,utm?}` → `{prospectoId,solicitudId,version}`; 409 para ficha/solicitud existente |
| `PATCH /prospectos/:id/etapa` | administración institución | `{solicitudId,etapa,versionEsperada,motivo,actividad?,fechaEfectiva?}`; URL y solicitud deben corresponder |
| `GET /embudo` | administración/auditoría | `convocatoriaId` requerido, `desde,hasta,corte,sede,procedencia,configuracionVersion`; `{cohort,cutoff,generatedAt,configVersion,configuration,stages,rankings}` |
| `GET /atencion` | administración/docente asignado | filtros de convocatoria/sede, page/limit; data/meta; motivos y prioridades deterministas |
| `POST /prospectos/:id/mensaje` | administración institución | `{solicitudId,canal,tono,objetivo}` → borrador pendiente y `agentRunId`; nunca envía |
| `GET/POST /convocatorias` | lectura institucional autorizada / administración | lista paginada; alta `{courseId,nombre,sede,inicio,fin,configuracion}` |
| `PATCH /convocatorias/:id` | administración | `{versionEsperada,nombre?,estado?,configuracion?}`; guarda historial de configuración |
| `GET /prospectos` | administración | búsqueda institucional/paginación para selección asistida de ficha existente |
| `GET/POST /solicitudes` | administración; docente solo GET asignadas | lista filtrada; alta `{prospectoId,convocatoriaId}` |
| `GET/PATCH /solicitudes/:id` | GET administración/docente asignado; PATCH administración | detalle; `{versionEsperada,responsableId?,estado?,revisada?,excepcionConservacion?,motivo}` |
| `GET /solicitudes/:id/historial` | administración/docente asignado | historial paginado ordenado por fecha efectiva e ID |
| `POST /solicitudes/:id/actividades` | administración/docente asignado | `{versionEsperada,motivo,actividad:{tipo,programada?,efectiva?,resultado?,evidencia?}}` |
| `POST /solicitudes/:id/seguimientos` | administración/docente asignado | `{versionEsperada,responsableId,vence,tipo,nota?}` |
| `PATCH /solicitudes/:id/seguimientos/:childId` | administración/docente responsable | `{versionEsperada,resultado}`; cierre y último contacto |
| `POST /solicitudes/:id/matricular` | administración | `{versionEsperada,modo:nueva/vincular/reintegrar,motivo,decisionConfirmada:true,excepcional?,actividad?}`; respuesta idempotente sin reemitir invitación |
| `POST /solicitudes/:id/borradores` | administración | `{canal,tono,objetivo,texto}`; redacción manual identificada |
| `PATCH /solicitudes/:id/borradores/:childId` | administración | `{versionEsperada,texto,canal}` invalida aprobación |
| `POST /solicitudes/:id/borradores/:childId/revision` | administración | `{versionEsperada,accion:aprobar/descartar/actualizar_contexto}` |
| `GET /solicitudes/:id/borradores/:childId/copia` | administración | solo versión aprobada y contexto vigente; texto/destinatario/canal; no implica envío |
| `POST /prospectos/:id/consentimientos` | administración | `{finalidad:admisiones/promociones,documentoVersion,evidencia,origen,aceptadoEn}` |
| `POST /prospectos/:id/consentimientos/:childId/revocar` | administración | revocación explícita auditada |
| `POST /prospectos/:id/privacidad` | administración | `{accion:acceso/correccion/supresion,verificacionRef,verificadaEn,motivo,correccion?}`; caso auditado con referencia de identidad verificada |
| `GET /trazabilidad` | administración/auditoría | eventos paginados sin contactos, notas ni motivos libres |

Las primeras cinco equivalen a las rutas del taller `/prospectos`, `/prospectos/:id/etapa`, `/embudo`, `/atencion`, `/prospectos/:id/mensaje`. No existe una implementación paralela.

Las listas usan `page` y `limit` (máximo 100). Solicitudes admiten convocatoria, sede, etapa, estado, responsable, procedencia y fechas de creación; búsqueda en servidor sin persistir contactos en la URL del navegador. Reportes no admiten filtros ambiguos de estado actual, se limitan a una convocatoria/configuración y 366 días. Por transición devuelve `N,A,M,AM,observedPct,maturePct,nonConversionPct,targetPct,gapPoints,openWindows,pendingInTime,pendingOverdue,waiting,closures,meanDays,medianDays,waitingMeanDays`; nulos con motivo cuando no hay base o no aplica. Reporte histórico exige fecha efectiva y de registro al corte.

Errores adicionales: `STALE_VERSION`, `INVALID_TRANSITION`, `PROCESS_CLOSED`, `APPLICATION_EXISTS`, `PROSPECT_EXISTS`, `STALE_CONTEXT`, `REVIEW_REQUIRED`, `CONTACT_UNAVAILABLE`, `ACCOUNT_DISABLED`, `EXISTING_ENROLLMENT`, `WITHDRAWN_ENROLLMENT`, `INVITATION_RECENT` (409); `VALIDATION_ERROR` (422); `AGENT_INVALID_OUTPUT` (502); IA no configurada/indisponible (503). Recurso ajeno 404; rol sin permiso 403; cuota 429.
