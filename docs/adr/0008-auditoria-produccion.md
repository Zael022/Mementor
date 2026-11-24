# ADR 0008 — Correcciones de la auditoría de salida a producción

Fecha: 2026-11-23 · Estado: aceptada

## Contexto
Una tercera auditoría (`Auditoria_Mementor_Produccion_2026-11-23.md`, con la prueba `prueba_regresion_ia_mementor.mjs`) concluyó que el proyecto no está listo para usuarios reales con datos académicos o de menores. Confirmó dos falsos positivos del validador del tutor y señaló una baja de cuenta que podía quedar a medias. Esta decisión cubre lo que se resuelve en código. Lo que requiere infraestructura real queda como pendiente al final.

## Decisiones

**H-01 · El validador del tutor revisa a qué se refiere cada número y el sentido de la frase.**
- Antes bastaba con que los números de la respuesta aparecieran en algún lugar de la fuente. Así pasaban «nota 80 y asistencia 70» cuando la fuente decía lo contrario, y también la negación completa de la regla.
- `claimCheck.js` ahora mira los términos más cercanos a cada número, sin pasar de otro número. Si el contexto de un número en la respuesta se parece claramente más (2 términos o más) al de otro número de la fuente, la oración se rechaza (`number_context_mismatch`).
- Una negación («no», «ni», «nunca», «jamás», «tampoco», «ningún», «nadie», «nada») se compara contra la oración de la fuente que más se parece. Si la respuesta niega lo que la fuente afirma, o afirma lo que la fuente niega, se rechaza (`negation_mismatch`). «Sin» no cuenta, porque suele ser parte del tema.
- «Por ciento» ya no se lee como el número 100.
- La prueba de la auditoría (4 casos) pasa completa y quedó integrada en `claimCheck.test.js`, junto con casos que no deben rechazarse: paráfrasis con el número antes del sustantivo, negación compartida y omisión de una parte negada.
- La interfaz deja de decir «comprobada»: dice «revisada» y aclara bajo las fuentes que la revisión automática no garantiza que la explicación sea correcta.
- **Límite conocido:** sigue siendo una revisión léxica. Una frase con un solo número mal asignado («la asistencia mínima es 70»), sinónimos de negación («prohibido») o razonamientos de varias oraciones pueden pasar. Hace falta un conjunto de preguntas revisadas por docentes con el modelo real.

**H-02 · La baja se completa en el servidor antes de responder.**
- Antes, con `DELETION_PROCESSOR=n8n`, el servidor daba la baja por delegada en cuanto el webhook respondía 200. Pero n8n responde al recibir, antes de ejecutar el workflow: si un nodo fallaba después, la solicitud quedaba `pending` para siempre.
- Ahora la anonimización ocurre siempre en el servidor, en una transacción, y n8n solo envía el correo de confirmación. Si el webhook no responde, el correo sale desde el servidor. La llamada de n8n a `/process` es idempotente.
- `reconcilePendingDeletions` corre con la retención diaria y completa cualquier solicitud que haya quedado pendiente por un corte del servidor. Como la cuenta aún no se anonimizó, el aviso llega al correo original.

**H-03 · La interfaz solo cierra la sesión cuando la baja terminó.** Con `completed` se borra la sesión y se muestra «Cuenta eliminada». Con cualquier otro estado, la sesión sigue y se explica que la solicitud aún no terminó.

**H-04 · Recordatorios completos, sin repetir y con opción de apagarlos.**
- Antes había un tope de 5000 matrículas y 500 personas, sin orden: quien pasaba del tope no recibía nada.
- `GET /integrations/daily-reminders?after=&limit=` recorre las personas por id con un cursor (`meta.nextCursor`). El workflow de n8n usa la paginación del nodo HTTP hasta que el cursor llega `null`.
- `reminder_deliveries` (migración `20261123000300`) guarda por persona y día si el correo salió o falló. Quien ya lo recibió hoy no vuelve a aparecer; un reintento solo incluye fallidos y faltantes. Un «enviado» nunca se vuelve «fallido».
- Cada página y cada registro de envíos queda en `integration_runs` con la cantidad revisada, enviada y fallida.
- Nueva preferencia `emailReminders` (Configuración → Metas de estudio).

**H-05 · La copia de datos incluye lo académico propio.**
- `exportMyData` agrega cursos, intentos y respuestas de evaluaciones, entregas, notas de trabajo en clase, asistencia, progreso, dominio, recomendaciones, repasos, planes, partidas, prácticas, racha, bonos, comentarios, conversaciones con el tutor y preferencias.
- Cada consulta filtra por la persona que pide la copia. No incluye quién calificó ni las claves de respuesta.
- El archivo incluye un campo `scope` que dice qué queda fuera (bitácora de seguridad y registros técnicos) y cómo pedirlo. La interfaz y la política de privacidad dicen lo mismo.

**H-06 · Límites por cuenta además de por IP.** `limiter({ key })` permite contar por cuenta o por correo:
- máximo 5 enlaces de recuperación por correo cada hora;
- máximo 10 cambios de contraseña o de correo por cuenta cada hora.

Junto con el bloqueo tras 5 intentos fallidos de inicio de sesión, una IP falsa en `X-Forwarded-For` ya no sirve para atacar una cuenta concreta. El valor correcto de `TRUST_PROXY` en cada camino (Vercel o Render directo) queda como comprobación obligatoria del despliegue (`docs/despliegue.md` §3).

**H-08 · Migraciones que se pueden revertir sin deshacerlas.**
- Regla «ampliar y luego contraer»: una versión solo agrega; lo que se borra o renombra va en una versión posterior.
- La guía ya no recomienda `db:migrate:undo` en producción.
- `render.yaml` explica que en un plan de pago la migración va en `preDeployCommand`, que el plan gratuito no tiene.

**H-09 · Observabilidad básica.**
- Una línea JSON por solicitud con `requestId`, la plantilla de la ruta (sin ids ni parámetros), el estado y la duración. Los errores 500 salen también como JSON.
- `GET /api/v1/ops/metrics`, solo para la cuenta de la plataforma, da p50, p95 y p99, los conteos 4xx y 5xx y las rutas más lentas de la instancia.

**H-10 · Límite de Vercel corregido.** El proxy de Vercel espera hasta 120 s el primer byte y luego mantiene la conexión mientras llegue algo al menos cada 120 s. El tutor envía su primer evento enseguida y una señal cada 15 s.

## Pendiente (fuera del código)
- **H-07:** servicio que no se duerma, y un proceso aparte con cola persistente para las tareas periódicas.
- **H-09:** sistema central de métricas y alertas (las métricas actuales son por instancia y se pierden al reiniciar).
- **H-11:** entorno de *staging* con TiDB, Cloud Storage, SMTP y n8n reales; migraciones y suite del backend contra TiDB.
- **H-06:** prueba de `X-Forwarded-For` por los dos caminos en el despliegue real.
- **H-12:** inventario de datos personales por campo, revisión del ciclo de baja con respaldos y aprobación institucional para datos de menores.
- **H-01:** validación humana de un conjunto de preguntas educativas con el modelo real.
