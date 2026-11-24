# ADR 0006 — Correcciones de la auditoría técnica del 23 de noviembre

Fecha: 2026-11-23 · Estado: aceptada

## Contexto
Una auditoría técnica independiente calificó el proyecto con 7,5/10 como proyecto académico y 3,5/10 en preparación para producción. Sus cinco riesgos principales fueron estos:
- Pérdida de los originales en el disco temporal de Render (M01/M03).
- Un aviso de privacidad que prometía menos de lo que se envía a la IA (M06/M07).
- Notas infladas al editar el puntaje máximo de una tarea (M04).
- Respuestas del tutor con citas auténticas pero contenido falso (M05).
- Un despliegue que fallaba antes de migrar (M02).

## Decisiones

**Originales duraderos (M01).**
- Se agrega un almacén con dos modos (`STORAGE_DRIVER=local|gcs`).
- En producción, los materiales y las fotos de perfil se copian a un bucket privado de Cloud Storage con ADC, la misma vía que ya usa el modo `vertex`. El disco solo es un paso temporal de multer.
- `materials.content_sha256` guarda la huella del original. La descarga la envía en `X-Content-SHA256` para comprobar restauraciones.
- Se eligió Cloud Storage y no un disco persistente de Render porque el plan gratuito no tiene disco persistente, el proyecto ya usa Google Cloud y el bucket con versionado permite recuperar borrados.

**Compensación de cargas (M03).** La carga ocurre en tres pasos:
1. Se guarda el original de forma duradera.
2. La fila del material y su auditoría se crean en una sola transacción.
3. Se indexa el material para el tutor.

El original solo se descarta si el paso 2 no se confirmó. Un error de indexación ya no borra nada: el material queda descargable y la fuente aparece con error para reintentarla.

**Migrador en producción (M02) y versión de Node (M12).**
- `sequelize-cli` pasó a `dependencies`. Así, `npm ci` con `NODE_ENV=production` deja disponible `npm run db:migrate`. Se comprobó en un directorio limpio.
- Node se fija en 22.22.2 en `render.yaml` y en CI. `engines` declara `^22.22.2 || >=24.15.0`, que es lo que exige jsdom para las pruebas del frontend.

**Notas emitidas (M04).**
- Con entregas calificadas, el puntaje máximo de la tarea no cambia (`409 GRADED_MAX_LOCKED`). El cambio permitido queda auditado.
- La calificación bloquea la fila de la tarea para que el máximo no cambie mientras se califica.
- Como defensa adicional, ninguna entrega cuenta más del 100 % en la nota.

**Tutor que valida antes de mostrar (M05, M13).**
- El streaming ya no envía texto al navegador, solo el avance (`progress`). El texto llega en `final` después de validarse. Una respuesta interrumpida no muestra nada sin validar.
- `utils/claimCheck.js` compara cada oración con contenido contra el pasaje que cita:
  - todo número de la oración debe estar en el pasaje;
  - al menos un tercio de sus términos deben aparecer en él.
- «Dos más dos son nueve» citando «dos más dos son cuatro» se rechaza. Es una verificación determinista y barata: no prueba que una explicación sea pedagógicamente buena, por eso cada cita abre su pasaje.
- El generador de preguntas acepta solo los identificadores entregados (S1…Sn). Si descarta todas las preguntas, responde `no_evidence`. Esas ejecuciones cuentan para la cuota porque sí llamaron al modelo.

**Privacidad (M06, M07, M10).**
- Antes de enviar al proveedor cualquier texto escrito por una persona, se reemplazan cédulas, teléfonos, correos y enlaces por etiquetas. Aplica a la pregunta y el historial del tutor, las entregas, los textos de cumplimiento y las indicaciones de anuncios.
- El enlace de una entrega no se envía.
- El aviso de privacidad (versión 2026-11-23) nombra a los dos proveedores posibles y detalla qué recibe cada asistente.
- Con documentos pendientes, el servidor rechaza cualquier operación de escritura (`403 CONSENT_REQUIRED`). Siguen disponibles leer, aceptar, cerrar sesión y pedir la baja. El diálogo de la interfaz ya no es la única barrera.
- El registro detallado de los asistentes (`agent_runs`) se borra a los 90 días, igual que el detalle de consumo del tutor.

**Enlaces de un solo uso (M08).** La recuperación de contraseña y la activación de una invitación bloquean la fila y la actualizan solo si sigue vigente, dentro de la transacción. Con dos solicitudes simultáneas, una gana y la otra recibe el error de enlace usado. Hay prueba con dos peticiones en paralelo.

**Detalles (M14, M16, M18, M19).**
- Un `401` del streaming se trata igual que el de una petición normal.
- Una página de error del proxy se explica como «el servicio no está disponible».
- Los enlaces sueltos de las pantallas de acceso tienen 24 px de alto efectivo. axe-core lo verifica en tres anchos dentro de las pruebas de navegador.
- El ZIP de entrega sale de `scripts/empaquetar.sh`, con solo los archivos versionados.
- La prueba de streaming ya no falla al cerrar si la preparación no llegó a abrir el servidor.

## Pendiente (fuera de este cambio)
- M09: estructura OOXML y límite de descompresión.
- M11: paginación de recordatorios para más de 500 destinatarios.
- M15: sinónimos y números en la búsqueda local.
- M17: aviso de `uuid` en Sequelize.
- Ensayo de restauración conjunta de MySQL y bucket con acta.
- Prueba con lectores de pantalla.
- Pruebas con usuarios reales.
- Validación del tratamiento de datos de menores con la institución.
