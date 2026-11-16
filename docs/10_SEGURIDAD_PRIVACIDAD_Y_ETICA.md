# Seguridad, privacidad y uso responsable de IA

## Reglas no negociables
- HTTPS en despliegue, cookies de sesión httpOnly/Secure/SameSite adecuadas y defensa CSRF si se usan cookies; CORS con origen exacto.
- Hash robusto de contraseñas, rate limit, bloqueo/retardo progresivo de login, rotación de sesión, expiración y logout.
- RBAC + autorización por recurso + `institution_id` derivado del servidor, probado con usuarios de instituciones distintas.
- SQL parametrizado, validación de entradas, limitación de payloads, sanitización HTML/Markdown, encabezados seguros y prevención XSS.
- Claves IA, smtp y DB siempre en `.env` local no versionado; ejemplos sin credenciales reales.
- Archivos subidos: lista de MIME y tamaño permitidos, ruta no ejecutable, random storage key, acceso autenticado, escaneo cuando se despliegue.
- Logs sin contraseñas, respuestas de examen completas, tokens, API keys ni chats sensibles. Auditoría de cambios de notas/permisos y publicación de contenido.

## Privacidad estudiantil
- Minimización: almacenar solamente datos útiles para la enseñanza.
- Informar qué analiza la IA y permitir mecanismos institucionales para consultar, corregir o eliminar datos según políticas aplicables.
- Retención configurable y eliminación/anonimización cuando proceda.
- Consentimiento/aviso y controles de privacidad adecuados a edades y jurisdicción; si se incluyen menores, tomar medidas específicas y revisión jurídica.
- No usar datos de alumnos para entrenamiento de terceros sin base jurídica/consentimiento apropiados y política explícita.
- No mostrar tablas comparativas nominales públicas ni rankings humillantes.

## Gobernanza de IA
- Generación de exámenes = borradores revisados por docentes.
- Tutoría = asistencia, no autoridad; afirmaciones con material del curso.
- No automatizar sanciones, calificaciones oficiales de respuestas subjetivas, expulsiones ni decisiones de alto impacto.
- Prompt injection: entradas de estudiantes y contenido de profesores son datos no confiables; herramienta LLM read-only e idempotente, sin permisos de administración.
- Presupuesto de tokens y rate limits por usuario/institución; timeout, retry limitado y apagado del proveedor.
- Posibilidad de reportar respuesta incorrecta; audit trail de versión de modelo y fuentes utilizadas.

## Seguridad del evaluador de código (futuro)
Nunca `eval`, `vm` o `child_process` sobre código del alumno en el proceso backend. Si se añade, construir servicio aislado con límites de CPU/RAM/tiempo/red, filesystem efímero, sin secretos, revisión de escape de contenedor y cola de jobs.

## Amenazas que deben tener pruebas
IDOR entre alumnos, filtración entre tenants, XSS vía lecciones, exposición de respuestas correctas, bypass de matrícula, abuso de tokens del tutor, prompt injection en documentos, modificación fraudulenta de calificaciones, upload malicioso, SQL injection.
