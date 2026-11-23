# ADR 0007 — Correcciones de la revisión independiente del 23 de noviembre

Fecha: 2026-11-23 · Estado: aceptada

## Contexto
Una revisión independiente (`REPORTE_REVISION_MENTOR_AI.md`) consideró el proyecto sólido como MVP académico, pero señaló pendientes antes de llamarlo servicio de producción. Esta decisión cubre lo que se puede resolver en código. Lo que necesita personas o infraestructura real queda como pendiente al final.

## Decisiones

**Archivos de Office revisados por dentro (P1).**
- Antes bastaba con que un `.docx`, `.pptx` o `.xlsx` empezara con `PK`. Un ZIP cualquiera renombrado pasaba la revisión.
- `utils/ooxml.js` lee el directorio central del ZIP sin descomprimir todo y exige las partes propias de cada formato (`word/document.xml`, `ppt/presentation.xml`, `xl/workbook.xml` y `[Content_Types].xml`).
- Rechaza cifrado, métodos de compresión raros, ZIP64, rutas con `..` o absolutas, nombres repetidos y archivos comprimidos anidados.
- Pone límites: 2000 entradas, 100 MB descomprimidos en total y una razón de compresión de 100 a 1 para entradas grandes. Al leer una entrada se corta la descompresión en el tamaño declarado, así un tamaño falso no sirve para colar una «bomba ZIP».
- Se usa en la subida (`fileSignature.js`) y antes de `mammoth` al extraer texto, también para lo que llega de Drive.

**Fechas reales (P2).** `utils/dates.js` comprueba que una fecha `AAAA-MM-DD` exista en el calendario (el 31 de febrero no existe). Se aplica en los esquemas Zod, en las APIs externas (tipo de cambio y feriados) y en `clock.addDays`.

**Presupuesto del Coach de estudio (P2).** El modelo recibe el límite de minutos en la instrucción, pero no se confía en que lo respete. `fitPlanToBudget` recorta el plan en el servidor manteniendo el orden, acorta la actividad que se pasa y marca `adjusted`. La interfaz muestra «Total: X de Y min disponibles».

**Turnos de tareas de fondo (P2).**
- Antes, una tarea lenta podía tardar más que el turno de 90 s, y otra instancia empezaba la misma tarea en paralelo.
- `coordination.runExclusive` renueva el turno cada 30 s mientras la tarea corre. Si otra instancia se lo quedó, la tarea recibe una señal de cancelación y no libera un turno ajeno.
- Cada tarea (indexación, archivos, Drive, retención) tiene su propio turno, así una lenta no bloquea a las demás.

**Estado del despliegue (P2).** El README ya no dice «En producción». Dice que el despliegue está pendiente de verificar hasta completar el registro de aceptación agregado en `docs/despliegue.md` §6.

**Cambio de correo con verificación (P3).**
- Antes, el correo de acceso cambiaba en cuanto se escribía la contraseña. Con una contraseña robada, alguien podía quedarse con la cuenta y la persona dueña no se enteraba.
- Ahora `POST /me/email` crea una solicitud en `email_changes` (migración `20261123000200`): nuevo correo, hash del token, vencimiento a 60 minutos. El enlace va a la nueva dirección y la dirección actual recibe un aviso.
- `POST /auth/email/confirm` consume el token con una actualización condicionada, igual que la recuperación de contraseña: un enlace usado dos veces a la vez solo cambia el correo una vez. Si otra cuenta tomó esa dirección mientras tanto, responde 409. Al confirmar se avisa también a la dirección anterior.
- Pedir un cambio nuevo anula el enlace anterior. La baja de la cuenta borra las solicitudes pendientes.
- La página `/confirmar-correo` pide un clic en vez de confirmar al cargar, porque algunos filtros de correo abren los enlaces solos.

## Consecuencias
- El cambio de correo necesita SMTP. Sin SMTP responde 503 con un mensaje claro, igual que la recuperación de contraseña.
- Un `.docx` dañado que antes se aceptaba y luego fallaba al indexar ahora se rechaza al subirlo, con un mensaje claro.

## Pendiente (fuera del código)
- **Despliegue real** y su registro de aceptación: health, inicio de sesión, tutor, archivo tras reinicio, correos, n8n y restauración de respaldos.
- **Plan gratuito:** respuestas largas del tutor frente al corte de 30 s de Vercel, Render dormido y n8n intermitente. Para uso real hacen falta planes de pago o una cola persistente.
- **Pruebas con personas:** 3–5 docentes y 5–10 estudiantes en el recorrido «crear curso → publicar → matricular → evaluar → ver recomendación», midiendo tiempo y errores.
- **Experiencia de uso:**
  - código del curso como dato secundario en los banners;
  - inicio del estudiante con tres acciones;
  - recorrido guiado para el primer docente;
  - explicar por qué se recomienda algo.
- **Accesibilidad:** probar con NVDA o VoiceOver en pantallas con sesión.
- **Privacidad:** ocultar cédulas, teléfonos, correos y enlaces no es anonimizar. Los nombres propios escritos en un texto pueden llegar a la IA. Falta validar con la institución el tratamiento de datos de menores.
