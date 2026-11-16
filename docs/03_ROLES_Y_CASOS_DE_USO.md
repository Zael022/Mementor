# Roles, permisos e historias de usuario

## Roles
- `platform_admin`: configura la plataforma y crea instituciones. Por defecto **no** accede al contenido personal de alumnos; accesos excepcionales auditados.
- `institution_admin`: administra usuarios, cursos y docentes de su institución; no modifica calificaciones sin procedimiento autorizado.
- `teacher`: administra sus cursos, publica material y evaluaciones, visualiza intentos de estudiantes de sus cursos y revisa preguntas de IA.
- `student`: accede solo a cursos donde está matriculado, ve sus propios resultados y utiliza tutor y plan de estudio.
- `academic_advisor` (futuro): acceso parcial para seguimiento consentido, sin poder alterar notas.

## Matriz resumida
| Recurso | Platform admin | Institution admin | Teacher asignado | Student matriculado |
|---|---|---|---|---|
| Crear institución | Sí | No | No | No |
| Gestionar usuarios de institución | No por defecto | Sí | No | No |
| Crear curso | No por defecto | Sí | Sí, según política | No |
| Editar lecciones | No | Configurable | Sí, cursos propios | No |
| Publicar cuestionario | No | No por defecto | Sí, cursos propios | No |
| Resolver cuestionario | No | No | No | Sí |
| Consultar resultados individuales | No por defecto | Solo si se justifica | Sí, cursos propios | Solo propios |
| Tutor IA | No | Solo contexto autorizado | Pruebas de curso | Sí, cursos propios |
| Ver audit logs | Operativos | Propios institución | Solo eventos propios autorizados | No |

**Implementar autorización por rol + propiedad del recurso + pertenencia a institución**, no solo roles.

## Historias esenciales
**Estudiante:** inicia sesión; ve sus cursos; abre tema y material; completa evaluación; ve corrección y dominio; pregunta al tutor; solicita un plan para examen; consulta su progreso y privacidad.

**Profesor:** crea un curso, objetivos, módulos y temas; configura prerrequisitos; publica lección, adjunta material y cuestionario; ve estadísticas; aprueba preguntas sugeridas por IA y asigna refuerzo.

**Administrador:** crea asignaciones docentes, invita usuarios, supervisa matrícula, configura límites de IA y ve estadísticas agregadas de uso.

## Escenarios límite
- Usuario de institución A consulta recurso de B mediante ID: **403 o 404 seguro**, sin fuga.
- Estudiante no matriculado intenta ver lección privada: rechazado.
- Docente de otro curso intenta modificar evaluación: rechazado.
- No hay contenido fuente: tutor informa la limitación, no inventa referencia.
- Cuestionario inactivo: no permitir respuestas, ni revelar clave correcta.
- Usuario con plan de estudio propone cambios: plan editable, estudiante conserva agencia.
- Fallo de proveedor de IA: registrar error de forma segura y continuar funcionalidades principales.
