# CRM de admisiones

Implementación local del encargo de CRM y mejoras de MENTOR AI. Mantiene React/Vite, Express, Sequelize/MySQL y la sesión httpOnly con CSRF. No carga prospectos, cuentas ni convocatorias en desarrollo o producción. El documento original del taller se contrastó por extracción de texto; sus ejemplos no se copiaron al panel.

## Instalación y recorrido

1. Configurar `backend/.env` con las variables existentes de MySQL, `JWT_SECRET` y orígenes permitidos. Crear bases separadas para desarrollo, pruebas (`*_test`) y navegador (`*_e2e`). Nunca usar una base compartida para pruebas.
2. En backend: `npm ci`, `npm run db:migrate`, `npm run dev`. Las migraciones `20261122000100` y `20261122000200` son aditivas; no generan contenido. Respaldar antes de aplicarlas fuera del entorno local.
3. En frontend: `npm ci`, `npm run dev`. Entrar con administración de institución y abrir **Admisiones**. La administración de plataforma conserva su alcance: crea la institución e invita a su administración; no consulta las fichas personales automáticamente.
4. Crear una convocatoria con curso, sede, fechas, política autorizada/versionada, ventanas, metas opcionales, días de alerta y plazos de conservación aprobados. No hay una meta universal de 75 %. Una convocatoria apunta a un solo curso.
5. Registrar una persona y su primera solicitud, o buscar una ficha existente y crear otra solicitud en otra convocatoria. Una duplicación en la misma convocatoria produce 409.
6. Abrir la ficha, asignar una persona responsable y revisar. Registrar actividades/seguimientos y usar **Mover a** por teclado o toque. El diálogo explica efectos y requisitos; el servidor confirma la escritura antes de cambiar la pantalla.
7. Consultar Embudo y Atención. Las cohortes se definen por creación de solicitud y se separan por versión de configuración. Los filtros sin datos personales se conservan en la dirección; la búsqueda de contactos permanece en memoria.
8. Redactar manualmente o solicitar un borrador a IA; editar y aprobar la versión exacta para el destinatario y canal. El cambio de contexto exige actualizar y revisar. Copiar no constituye envío.
9. Confirmar matrícula normal con semana de prueba completada, o vincular excepcionalmente una matrícula activa existente con motivo. La cuenta nueva queda invitada, sin contraseña predeterminada. El enlace se muestra una vez, sin envío real; la persona activa y acepta sus propias políticas desde el flujo existente. Renovarlo es explícito en Usuarios.

El CRM funciona sin IA. Configurar `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` y opcionalmente `AI_BASE_URL` solamente en el servidor habilita generación real. Nunca se prueba un proveedor de pago al abrir la pantalla. Configurado no equivale a conectividad verificada.

## Etapas y estado del proceso

| Etapa de destino | Requisito para avanzar desde la anterior |
| --- | --- |
| Prospecto | Creación de solicitud e historial inicial |
| Candidato | Revisión humana y motivo |
| Agenda Campus Day | Fecha de Campus Day programada |
| Asiste Campus Day | Asistencia real, fecha efectiva y referencia de evidencia |
| Prueba Técnica | Resultado manual, fecha efectiva y evidencia de admisión; separado de notas del aula |
| Entrevista | Prueba técnica aprobada y entrevista programada |
| Admitido | Entrevista favorable con fecha y evidencia; decisión humana |
| Semana de Prueba | Fecha programada de la semana |
| Estudiante | Operación de matrícula transaccional; semana completada o vinculación excepcional identificada |

`activo`, `lista_de_espera`, `retirado` y `rechazado` son estados válidos para etapas 1–8. Solo activo puede avanzar. Administración puede reabrir un proceso o corregir hacia atrás con motivo. `matriculado` corresponde exclusivamente a Estudiante, y su estado académico se gestiona desde Matrículas. Cuenta invitada/activa/deshabilitada y matrícula activa/retirada se muestran independientemente.

Reprogramar conserva un evento con los datos previos y otro con la nueva fecha. Una reprogramación limpia el resultado anterior del estado actual sin borrar su historial. No se registra ausencia para una cita futura. El resultado debe corresponder a la actividad y tener fecha/evidencia. Un cambio de nota o revisión no reinicia `lastStageChangedAt`; cerrar un seguimiento actualiza `lastContactAt`.

## Permisos

| Rol | Alcance CRM |
| --- | --- |
| institution_admin | CRUD, decisiones y privacidad en su institución |
| teacher | Solo solicitudes asignadas explícitamente: ficha, actividades y seguimientos; no admite ni matricula ni genera IA |
| auditor | Embudo y trazabilidad sin contactos ni texto libre; sin edición |
| platform_admin / student | Sin acceso al CRM; conservan sus recorridos habituales |

El servidor obtiene la institución de la sesión, valida relaciones y responsable, y rechaza campos de control. Una referencia fuera de alcance responde 404 seguro. La clave global de n8n no abre rutas del CRM. La auditoría guarda IDs y tipos; los motivos funcionales están en eventos protegidos, no en logs técnicos.

## Métricas y configuración histórica

Se usa la primera llegada válida a una etapa y su primera transición directa posterior, sin duplicar reingresos. Los retrocesos conservan la evidencia válida anterior. Vinculaciones excepcionales no acreditan actividades intermedias. Solo cuentan eventos con fecha efectiva **y fecha de registro** anteriores al corte. Cada solicitud guarda la configuración y procedencia originales; una corrección conserva trazabilidad sin reatribuir silenciosamente la adquisición.

Por transición: `N` llegó a la etapa; `A` completó la transición; observada = 100×A/N. `M` tuvo toda la ventana antes del corte; `AM` avanzó dentro del plazo; madura = 100×AM/M. No conversión en plazo = 100×(M−AM)/M; no es abandono definitivo. Brecha comparable = meta − conversión madura, en puntos porcentuales. El panel muestra numeradores/denominadores, ventanas abiertas, pendientes vigentes/vencidos, espera, cierres, media/mediana de duración y antigüedad de pendientes. El último paso no tiene transición siguiente. Sin denominador devuelve null, nunca 0 % inventado.

Reporte por una convocatoria y versión, hasta 366 días, máximo 10000 solicitudes y 100000 eventos. Exceder límites exige acotar filtros; no trunca silenciosamente. Rangos/consultas están indexados. Los rankings distinguen cantidad sin avance, porcentaje sin conversión en plazo y brecha frente a meta. Los reportes no mezclan personas con múltiples convocatorias; la unidad es la solicitud dentro de la convocatoria seleccionada. Las metas cambian para nuevas solicitudes; se selecciona la versión anterior para comparar la cohorte previa.

Atención calcula motivos en lectura, sin crear tareas duplicadas: revisión pendiente (prioridad 2), seguimiento vencido (3), días sin avance (2), cita en 48 horas (1), cuenta invitada pendiente tras matrícula (2). Citas futuras/lista de espera no producen alerta de estancamiento; procesos rechazados o retirados se excluyen. No hay probabilidades generadas por IA. Cerrar contacto y cambiar etapa son acciones distintas.

## Matrícula y concurrencia

Transacción compartida entre solicitud, usuario invitado, matrícula, evento y auditoría. Se bloquea institución, solicitud, prospecto, cuenta y matrícula en orden; versión esperada detecta ediciones simultáneas. Índices únicos impiden duplicar persona/convocatoria o curso/estudiante. Los helpers de invitación y matrícula reciben la transacción del dominio. No hay IA, SMTP ni n8n dentro de la transacción.

- Cuenta compatible de la institución: se reutiliza conservando rol/estado; una invitada sigue pendiente de activación.
- Cuenta deshabilitada: conflicto con procedimiento de revisión en Usuarios.
- Correo de otro rol/institución: conflicto genérico sin revelar perfiles ajenos.
- Matrícula activa: modo `vincular` explícito; retirada: `reintegrar` explícito; no cuentan como nueva incorporación.
- Reintento de solicitud convertida devuelve el vínculo existente y no devuelve otro token. Dos peticiones concurrentes confirman un efecto. Un fallo intermedio revierte todo.
- Hash de token en MySQL; la renovación explícita está auditada y tiene protección ante renovaciones simultáneas. Un enlace generado no significa correo enviado.

## IA, cuotas y privacidad

Noveno agente `admissions_writer`, conservando los ocho académicos. Solo se ejecuta por el flujo que guarda borradores. Contexto autorizado con etapa, convocatoria, sede, curso, condiciones/fechas, política versionada, objetivo, canal y tono; sin ficha, contactos, notas ni historial académico. Entradas no confiables pasan por `asData`, límites y enmascarado de patrones conocidos. Salida JSON estricta con Zod. Sin clave: `AI_NOT_CONFIGURED` (503); indisponible: `AI_UNAVAILABLE` (503); inválida: `AGENT_INVALID_OUTPUT` (502). Fallas no guardan borradores válidos. El modelo no tiene herramientas de envío ni autoridad sobre decisiones académicas.

Cuota de asistentes: `AGENT_DAILY_LIMIT_PER_USER` (30) y nueva `AGENT_DAILY_LIMIT_PER_INSTITUTION` (500). Cuenta reservas en curso y fallas en ventana móvil de 24 h, excluye avisos sin evidencia y agente tutor. Bloqueo institución → usuario. Tutor conserva su cuota independiente. Costos usan una sola fuente `agent_runs`, incluido tutor una vez; tarifas opcionales `AI_MODEL_PRICES_JSON` por proveedor/modelo. Las variables de precio anteriores solo aplican al modelo actualmente configurado. Sin tarifa o tokens conocidos se informa costo desconocido. Se etiqueta como estimación con tarifa de consulta, no facturación histórica verificada.

Cumplimiento ahora sustituye correos, teléfonos y cédulas **antes** de enviar el texto. Pruebas inspeccionan el payload. No es detección infalible ni certificación legal. El proveedor y sus políticas deben ser aprobados por la institución.

Consentimientos de prospecto: admisiones y promoción separados, con finalidad, versión, referencia de evidencia, origen y aceptación/revocación. Promoción nunca preseleccionada ni copiada de otra finalidad. La aceptación de la cuenta se obtiene de la propia persona al activar. No se guardan documentos de identidad: la administración verifica por su procedimiento y registra referencia/fecha para acceso, corrección o supresión, en `crm_privacy_cases`.

La exportación propia incluye CRM vinculado y datos personales de estudio sin claves de preguntas privadas ni datos de compañeros. Supresión de prospecto o baja de cuenta elimina contactos, notas, textos de eventos, borradores y evidencia que pueda identificar; conserva vínculos y hechos estructurales mínimos para trazabilidad. La procedencia de adquisición se conserva como categoría agregada; no debe usarse como campo para datos sensibles.

Conservación por convocatoria: contactos de procesos cerrados tras plazo aprobado desde `closedAt`, borradores tras su plazo de inactividad. Editar una nota no renueva el cierre. Excepción justificada explícita impide supresión automática y permanece visible. Para personas matriculadas se mantiene el vínculo académico hasta resolver su derecho por gobernanza. Procesos abiertos deben revisarse/cerrarse por la institución; no hay un plazo legal supuesto. Trabajo en lotes rotativos dentro de la retención coordinada por `job_leases`. Sin envíos ni colas externas en esta versión; exportaciones descargadas y respaldos requieren procedimiento institucional de eliminación.

## Evaluación aislada

En `backend/.env` configurar `TEST_DB_NAME` terminada en `_test`, credenciales de pruebas y una base diferente a `DB_NAME`. `E2E_DB_NAME` debe terminar en `_e2e`; el arranque de navegador reconstruye exclusivamente esa base. **No apuntar a una base compartida.**

```powershell
cd backend
npm run lint
npm test
# Solo recorrido CRM y ejemplo numérico:
$env:NODE_ENV='test'; node --test tests/crm.test.js
# Verificación de esquema, preservación y rollback, base descartable propia:
$env:NODE_ENV='test'; node --test tests/crmMigrations.test.js
# Actualizar modelo/diccionario/SVG desde la base aislada ya migrada:
$env:NODE_ENV='test'; node src/scripts/exportDataModel.js

cd ../frontend
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`crmMigrations.test.js` crea y elimina `mentor_crm_migration_test`; exige que no exista antes. Verifica esquema vacío, actualización sobre estructura previa y down/up conservando una institución temporal. No se hace rollback sobre `mentor`.

El escenario de 40 se genera por la API con reloj simulado, dominios `.test`, fechas distintas e historial coherente; se elimina al terminar. No es dataset ni seeder para desarrollo/producción. Cumple la regla de aislamiento del repositorio; su aceptación académica como sustituto de una base precargada depende del criterio de evaluación. Las cinco rutas están cubiertas por el recorrido y las pruebas; IA, SMTP, Hacienda y feriados se sustituyen por dobles, sin llamadas de pago ni mensajes reales.

### Cinco líneas de análisis reproducible de la prueba

1. La prueba crea 40 solicitudes: actuales 6/5/5/5/5/4/4/3/3, con ventanas de siete días completamente observadas al corte.
2. Por cantidad sin avance, Prospecto concentra seis solicitudes: revisaría la atención inicial; no se declara que esas personas abandonaron.
3. Por porcentaje sin conversión en plazo, Semana de Prueba tiene 3/6 = 50 %: revisaría las condiciones de finalización y el registro del resultado.
4. Agenda→Asiste alcanza 24/29 = 82,7586 %, meta configurada 75 %, brecha −7,7586 pp; cinco sin avance no son automáticamente desertores.
5. Hay tres matrículas nuevas (3/40 = 7,5 % del escenario); sin gastos reales no se calcula costo por admitido ni se atribuye causalidad a un canal.

El ejemplo separado del taller, 120→26, solo aparece en pruebas: 21,6667 %, meta 75 % equivale a 90 asistentes esperados, diferencia 64 y brecha observada 53,3333 pp. Sin fechas suficientes no se calcula cohorte madura ni se etiquetan 94 como desertores.

## Accesibilidad y evidencias

Botón principal se oscurece a `#b83d0b` con blanco; hover `#96320b`. Alto contraste conserva `#c2410c`/`#9a3412`. Campos y foco tienen bordes reforzados; navegación, formularios, lista y diálogos admiten teclado. Diálogo nativo devuelve foco al disparador. Acciones principales de 44px; lista/columna seleccionable en móvil; preferencias y movimiento reducido conservados. Las pruebas del navegador miden contraste y reflujo, generan capturas CRM en `docs/mockups/`. La evaluación manual con NVDA/VoiceOver y revisión integral de WCAG quedan pendientes; no se afirma conformidad integral.

Fuentes entregables: `docs/datos/modelo.json`, diccionario y SVG generados, capturas CRM, ADR e inventario. El entorno de esta sesión carece de Python instalado, LibreOffice y cargador de dependencias de documentos; no se regeneraron ni revisaron los ocho Word/PDF de `docs/entregables/`. Ver `docs/entregables/ACTUALIZACION_CRM.md` con el alcance exacto pendiente. No son artefactos actualizados.

## Backlog opcional concreto

- Formulario público: autorización de finalidad/evidencia, límites por IP, deduplicación asistida y sin enumeración de contactos.
- Campañas: objetivo, presupuesto/gasto real y atribución definida; bonus de tres textos sociales pendientes de aprobación reutilizando redactor.
- Envío SMTP/WhatsApp/redes: outbox transaccional por institución, conectores con alcance propio, reintentos/idempotencia y estados confirmados de entrega. Nunca equiparar copia con envío.
- Automatizaciones externas: credenciales institucionales y permisos por acción; no ampliar la clave global de n8n al CRM.
- Programas multicurso: entidad y decisión de acceso académica explícitas antes de ampliar convocatorias.
- Operación: monitorear reservas fallidas, revisar excepciones/solicitudes abiertas, respaldos y tarifas históricas aprobadas.

## Trazabilidad de requisitos obligatorios

| Requisito del encargo | Implementación y evidencia |
| --- | --- |
| Convocatorias, prospectos, solicitudes | Modelos/migraciones CRM, servicios, pantallas y pruebas de reutilización/duplicados |
| Nueve etapas y cinco rutas | `crmSchemas`, `crmRoutes`, reglas de actividad y pruebas de contrato |
| Ficha, historial, tablero/lista | Pages CRM, historial paginado, controles accesibles y e2e |
| Embudo y atención | Métricas de primeras llegadas, ventanas, configuración versionada; ejemplo 120/26 y escenario 40 |
| Seguimientos, fechas/resultados, asignación | Servicios con versión, autorización docente explícita y reloj |
| Matrícula segura | Transacción compartida, modos explícitos, reintento/concurrencia/rollback y activación |
| Agente y revisión humana | Noveno agente, contexto mínimo, borradores versionados, pruebas de payload/errores/cuotas |
| Consentimientos y derechos | Registros por finalidad y casos verificados, copia/supresión y retención |
| Accesibilidad, invitaciones, errores | Colores medidos, Campo, uso protegido de useEnvio/useDatos, enlaces y pruebas |
| Privacidad efectiva y consumo | Enmascarado previo, cuotas separadas con reservas, costos por modelo y desconocidos |
| Operabilidad y documentación | Paginación/límites/índices, carga bajo demanda, sin despliegue ni envíos, ADR/contratos/modelo |
| Pruebas y regresión | Suites backend/frontend/e2e y migraciones; resultados exactos en estado de desarrollo |
| Word/PDF y lectores de pantalla | Pendientes de herramientas y evaluación manual; fuentes actualizadas, sin afirmar verificación |
