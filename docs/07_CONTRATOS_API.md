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
| POST | `/me/password` | Propia cuenta, con la contraseña actual |
| POST | `/me/email` | Propia cuenta, con la contraseña actual; responde `{ pending, newEmail, expiresInMinutes }` y envía el enlace a la nueva dirección |
| POST | `/auth/email/confirm` | Público con el token del enlace (un uso, 60 min); `409 EMAIL_IN_USE` si otra cuenta tomó la dirección |
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
