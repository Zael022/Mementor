# Estado de desarrollo — mantener actualizado

**Última actualización** — 2026-11-27. Rama `despliegue-nube`: Vercel + Render + Supabase (ADR 0012) y, en `feature/configuracion-mentor-ia`, Configuración con sesión y documentos, logo «MENTOR IA», mapa con más diseño y mascotas interactivas; antes, 2026-11-26: modo de prueba con cuentas por rol y acceso rápido (rama `feature/cuentas-de-prueba`); antes, 2026-11-25: Mapa del curso, rango de avance, mascotas Orbi y Pausa, sticker de papel y Parejas (rama `feature/mapa-mascota-parejas`); antes, las 8 capas de la IA (rama `feature/capas-ia`, con `main` integrado: CRM de admisiones y de plataforma); antes, CRM institucional y seguridad OWASP (PR #13); antes, correcciones de la auditoría de salida a producción (rama `fix/auditoria-produccion`); antes, correcciones de la revisión independiente (rama `fix/revision-independiente`); antes, asignación de seguridad web (rama `feature/seguridad-web`); antes, correcciones de la auditoría técnica (rama `fix/auditoria`); antes, logo «M con birrete» en la página; GSAP y microinteracciones; antes, logo oficial y requisitos del Proyecto Final FWD: bcrypt y JWT, gobernanza (Ley 8968) y rol auditor, 8 agentes de IA, APIs externas y n8n, catálogo de roles, configuración de despliegue, nueva identidad visual y documentos entregables.

## Sesión 2026-11-27 · Rama `despliegue-nube`: Vercel + Render + Supabase
Daisy pidió (por el profesor) que el proyecto se publique como en JJ SecureVault: Vercel, Render y Supabase. Además tiene que seguir abriéndose en la computadora. Las demás ramas quedan como estaban. Decisiones en `docs/adr/0012-despliegue-vercel-render-supabase.md` y guía en `docs/despliegue.md`.
- **Dos motores con el mismo código:**
  - `config/connection.cjs`: `DB_DIALECT`, `DATABASE_URL`, TLS verificado con `DB_SSL_CA` o `DB_SSL_CA_PEM`, y `DB_POOL_MAX`.
  - `src/utils/sql.js`: `runSql`, `nowMinus`, `nowPlus`, `yearMonth`, `affectedRows` y `likeOp`.
  - `database/compat.cjs`: `cambiarEnum`. Además, TINYINT pasa a SMALLINT en PostgreSQL y `dropTable` recibe `{}`.
  - En PostgreSQL, las listas sin orden explícito se ordenan por `id`.
- **Supabase:** la migración `20261127000200-proteger-esquema-supabase` aplica RLS y quita permisos a los roles de la Data API; el servidor lo repite al arrancar (`protegerEsquema` en `database/compat.cjs`). `STORAGE_DRIVER=supabase` usa un bucket privado (`src/services/supabaseStorage.js`). `render.yaml` apunta a la rama `despliegue-nube`.
- **Pruebas nuevas:** `supabaseStorage.test.js` y `supabaseSeguridad.test.js`. Las de coordinación, CRM y registro técnico ahora funcionan en los dos motores. CI tiene un trabajo nuevo con PostgreSQL 17.
- **Verificación (local, registrada):**
  - Backend: 261/261 en PostgreSQL 16 y 260/260 en MySQL (la prueba de RLS se omite en MySQL).
  - Playwright: 47/47 con la API en PostgreSQL y 47/47 en MySQL.
  - Migraciones en PostgreSQL: aplicar, deshacer todo y volver a aplicar, sin errores.
  - Arranque con `DEMO_MODE=on` sobre PostgreSQL: crea las cuentas y el curso de prueba.
- **Pendiente:** probar contra un proyecto real de Supabase, Render y Vercel, y llenar el registro de aceptación de `docs/despliegue.md` §5.

## Sesión 2026-11-27 · Configuración, logo «MENTOR IA», mapa con más diseño y mascotas interactivas
Rama `feature/configuracion-mentor-ia` (desde `develop`).
- **Cerrar sesión, Privacidad y Términos** salen de la barra superior y del menú lateral; viven en Configuración, sección «Documentos y sesión».
- **Logo «MENTOR IA»** (juego de palabras con «mentoría»): en los cuatro SVG de `public/marca` se intercambiaron las letras de la insignia (mismos trazos, sin redibujar). El nombre visible pasó a «MENTOR IA» en la interfaz, el título de la página y los correos. Los prompts del tutor y la documentación histórica conservan «MENTOR AI».
- **Mapa del curso:** resumen con barra de avance y leyenda; zonas de color por módulo con adornos (destellos, planetas y nubes); senda ancha con línea punteada; carteles «Módulo N» con mini barra y estrella al completar; hitos de inicio y meta; halo giratorio en la parada siguiente.
- **Orbi y Pausa interactivos** (`hooks/useMascotaViva.js`): las pupilas siguen al puntero, en reposo Orbi flota y Pausa se balancea, y al tocarlos reaccionan y dicen una frase de `FRASES_TOQUE` (región viva, botón con nombre «Saludar a …»). En el mapa, tocar a Orbi lleva el foco a la parada siguiente. Con «Menos movimiento» no se mueven.
- Verificación: frontend 91/91 + lint + build; backend 257/257; Playwright 47/47 (la prueba del mapa ahora toca a Orbi); capturas y mockups regenerados.

## Sesión 2026-11-26 · Modo de prueba: cuentas por rol y acceso rápido
Rama `feature/cuentas-de-prueba` desde `main` (1234bcd). Daisy pidió quitar la regla que prohibía las cuentas de prueba y tener un botón discreto para entrar rápido. Decisiones en `docs/adr/0011-modo-de-prueba.md`; la regla 4 de `CLAUDE.md`, `AGENTS.md`, los documentos 00, 01, 12 y 15, el README y `despliegue.md` quedaron actualizados.

| Pieza | Dónde | Cómo se comprobó |
| --- | --- | --- |
| Migración `20261127000100-cuentas-de-prueba` (`users.is_demo`) | `backend/database/migrations/` | Subir, bajar y volver a subir en una base aislada; también en el e2e, que recrea la base desde cero |
| Interruptor `DEMO_MODE` y `DEMO_PASSWORD` | `utils/demo.js`, `.env.example` | `tests/demo.test.js` |
| Cuentas por rol en «Institución de prueba», sin duplicar y sin tomar cuentas reales; se crean al arrancar o con `npm run demo:cuentas` | `services/demoService.js`, `server.js`, `scripts/createDemoAccounts.js` | `demo.test.js` |
| Con el modo apagado no entran (ni con contraseña) y sus sesiones caen; `admin:create` ignora el admin. de prueba | `authService.js`, `createPlatformAdmin.js` | `demo.test.js` |
| `GET/POST /auth/demo` | `authRoutes.js`, `authController.js`, `schemas.js` | `demo.test.js` |
| Enlace plegado «Acceso rápido de prueba» con un botón por rol | `Componentes/AccesoRapido.jsx`, `Login.jsx`, `SesionContext.jsx` | `AccesoRapido.test.jsx`; recorrido en navegador con `DEMO_MODE=on` (claro y oscuro, axe sin fallos, entra como docente) |

Ejecutado el 2026-11-26:
- Backend: lint y 257/257 (7 nuevas en `demo.test.js`).
- Frontend: lint, 89/89 (4 nuevas) y build; JS inicial comprimido 99 310 bytes.
- Playwright: 47/47 con el modo apagado (el uso normal no cambia).
- Modelo de datos (76 tablas, con `users.is_demo`) y entregables en Word y PDF regenerados.

Ampliación del mismo día (Daisy pidió un curso de ejemplo con «simulaciones de cómo las funciones ayudan a estudiar», y eligió las dos opciones: historial simulado y recorrido guiado):

| Pieza | Dónde | Cómo se comprobó |
| --- | --- | --- |
| Curso «Matemática 7° · curso de prueba» con actividad simulada, hecho con los servicios reales; reloj movido solo para los días pasados; `--reiniciar` archiva el anterior | `services/demoCourseService.js`, `services/demoContent.js`, `server.js`, `scripts/createDemoAccounts.js` | `demo.test.js`: rango Luz 45 %, racha 4 en riesgo, 6 parejas, tarea con 88, analítica con 3 estudiantes, sin duplicar y con archivo al reiniciar |
| Compañeros simulados Sofía y Diego (sin acceso rápido) | `demoService.js` | `demo.test.js` |
| `isDemo` en el usuario público | `authService.js` | Recorrido automático en el navegador |
| Recorrido guiado: 3 pasos en inicio y 10 en el curso, con cambio de pestaña, portal, teclado, foco y menos movimiento | `RecorridoGuiado.jsx`, `BotonRecorrido.jsx`, `hooks/useRecorrido.js`, `utils/pasosRecorrido.js`, `EstudianteInicio.jsx`, `EstudianteCurso.jsx` | `Recorrido.test.jsx`; recorrido completo en escritorio y móvil con `DEMO_MODE=on`, axe sin fallos y capturas revisadas |

Corrección encontrada en la revisión visual: el resaltado salía corrido porque el contenedor de la página tiene `transform` por la animación de entrada; el recorrido ahora va en un portal sobre `<body>`.

Pendiente:
- El tutor IA del curso de prueba necesita una clave de IA real; no se simulan respuestas.

## Sesión 2026-11-25 · Mapa del curso, rango, mascotas y Parejas
Rama `feature/mapa-mascota-parejas` desde `main` (04af749). Reúne tres encargos aprobados: mapa con rango y Parejas, mascotas oficiales Orbi y Pausa, y animaciones de papel del sticker de Orbi. Decisiones en `docs/adr/0010-mapa-rango-mascotas-parejas.md`; contrato en `docs/07_CONTRATOS_API.md`; ficha de marca en `docs/marca/mascotas/`.

| Pieza | Dónde | Cómo se comprobó |
| --- | --- | --- |
| Migración `20261125000100-mascotas-y-parejas` (`show_mascots`, `show_big_celebrations`, tabla `memory_games`) | `backend/database/migrations/` | Subir, bajar y volver a subir en una base aislada |
| Rango de avance (Destello, Brillo, Luz, Estrella, Constelación) calculado al consultar; antes y después en completar lección y entregar tarea; avance del módulo con `justCompleted` | `progressRankService.js`, `courseService`, `homeService`, `analyticsService`, `contentService`, `assignmentService` | `tests/mapaParejas.test.js` |
| Última actividad real y días sin actividad (`/me/home`) | `homeService.js` | `mapaParejas.test.js` |
| Parejas: fuente segura (claves ya visibles), tablero en el servidor, tiempo con `clock.js`, sin bono ni racha; copia de datos y baja | `memoryGameService.js`, `gamificationRoutes.js`, `governanceService.js` | `mapaParejas.test.js`, `Parejas.test.jsx`, e2e `recorrido.spec.js` |
| Tema opcional de una tarea (ubicación en el mapa) | `CursoTareas.jsx` | Unitarias y e2e |
| Orbi, Pausa y `Mascota` (estados por partes del mismo SVG, burbuja de texto, preferencia de ocultar) y mensajes centralizados | `Componentes/Orbi.jsx`, `Pausa.jsx`, `Mascota.jsx`, `utils/mensajesMascota.js` | `Mascotas.test.jsx`, `Preferencias.test.jsx` |
| Mapa del curso: paradas reales (lecciones, tareas, Parejas, «Tareas del curso»), camino SVG en zigzag o vertical, Orbi con `MotionPathPlugin` | `RutaLecciones.jsx`, `utils/caminoMapa.js`, `utils/avanceMapa.js`, `utils/gsapMapa.js`, `Recorrido.css` | `Mapa.test.jsx`, e2e con axe |
| Rango en el encabezado (sticker que se despega con el mouse o el foco), inicio y analítica; celebración (pegar, doblar, volar) | `RangoAvance.jsx`, `Celebracion.jsx` | Unitarias, e2e y revisión visual |
| Bienvenida de Pausa (7 días), estados vacíos y aviso junto a «Menos movimiento»; «Mostrar mascotas» y «Celebraciones grandes» en Configuración | `BienvenidaRegreso.jsx`, `EstadoVacio.jsx`, `Configuracion.jsx` | Unitarias y revisión visual |
| `OrbiSticker`: pegar, despegar, soltar, doblar, desdoblar, arrugar, alisar, saltar y volar | `OrbiSticker.jsx` | `OrbiSticker.test.jsx`; medición con CPU 4× |

Pulido después de la revisión visual (escritorio y móvil, claro y oscuro, con y sin mascotas):
- Contraste del encabezado del curso. Con el color verde azulado, morado o azul medio, el texto lavanda quedaba bajo 4.5:1. Ahora el texto es blanco y la caja del rango usa un velo oscuro.
- Nombres accesibles de las tarjetas del mapa y de las cartas. axe pega las partes del texto visible sin espacios, así que ahora llevan un espacio real entre ellas (WCAG 2.5.3).
- Foco en la primera carta al empezar Parejas, sin depender del orden de pintado.
- Tarjetas del mapa con ancho parejo; «0 de 1 parada» en singular; «Continúa aquí» legible en oscuro cuando el tema sigue al sistema.
- El mapa se acerca antes del viaje de Orbi; el confeti queda dentro de la tarjeta; ícono del rango sin duplicar cuando las mascotas están ocultas.
- Cartas más bajas (el tablero de 12 cabe en escritorio); el sticker se pega al completar el tablero.
- `MotionPathPlugin` en su propio bloque (`vendor-gsap-camino`, 9,35 kB comprimidos): el bloque común de GSAP vuelve a medir lo mismo que en `main`.
- El e2e de accesibilidad de las pantallas públicas mide con «menos movimiento» para no evaluar a mitad de un fundido.

Ejecutado el 2026-11-25:
- Backend: lint y 250/250.
- Frontend: lint, 85/85 y build.
- Playwright: 47/47 (también 30/30 al repetir dos veces `recorrido` y `accesibilidad`).
- Peso del JS inicial (comprimido): 97 983 bytes en `main` frente a 98 314 en esta rama.
- Sticker con la CPU reducida 4× (Chrome sin pantalla, servidor de desarrollo): todas las animaciones a 55–61 cuadros por segundo y menos de 1 s; el peor cuadro fue de 33 ms, en «pegar».
- Mockups regenerados: 49 por formato, con el mapa (13b), Parejas (18b) y la celebración de rango (27b).
- Modelo de datos: 76 tablas, 765 columnas y 159 llaves foráneas; entregables en Word y PDF regenerados.

Después del PR #19 (mismo día):
- Pausa saluda en la portada pública (iniciar sesión, recuperar y activar). Se agarra con una mano del borde inferior de la barra del logo, sin su rama (`Pausa rama={false}`, con palma y garras sobre el borde), saluda una vez con la otra mano y dice «¡Hola! Qué bueno verte por aquí.».
- Se carga aparte con `lazy`, así que el formulario no espera a GSAP. Carga inicial comprimida: 99 009 bytes.
- Se revisó en 1440, 1000 y 390 px, en claro y oscuro. Al lado del título dejaba el título en una columna demasiado angosta a 1000 px; por eso cuelga de la barra, sobre la columna del formulario.
- Lint; frontend 85/85; Playwright `accesibilidad` y `acceso` 15/15; mockups 01–03 regenerados.

Pendiente:
- La bienvenida de Pausa no está en los mockups, porque necesita 7 días sin actividad. Se revisó en una base efímera con fechas movidas.
- El estado «descanso» de Orbi está dibujado pero todavía no tiene una pantalla.
- Validar con estudiantes que las mascotas no distraen.

## Sesión 2026-11-24 · Las 8 capas de la IA
Rama `feature/capas-ia` (desde `main`; luego se integró el PR #13 del CRM y el agente `admissions_writer` pasó también por las capas: prompt versionado, nivel rápido y guardrails de datos personales, enlaces y cifras). Decisiones en `docs/adr/0009-capas-ia.md`; guía en `docs/agentes-ia.md`.

| Capa | Cambio (dónde) | Cómo se comprobó |
| --- | --- | --- |
| 1 Prompt | `src/prompts/` (tutor, comunes y 7 agentes) con `version`; `prompts.lock.json`; `npm run prompts:lock`; `prompt_version` en `agent_runs` y `ai_usage_events` (migración `20261124000300-ai-layers`) | `tests/evals/prompts.test.js` (huella por versión, textos usados por los agentes, reglas de seguridad) |
| 2 RAG | Sin cambio de diseño; la consulta al buscador sale sin datos personales (`searchQuery`) | `tests/evals/agentes.test.js` (sin evidencia, cero llamadas; citas reales del curso; pregunta con datos encuentra la lección) |
| 3 Herramientas | Sin tool use; contexto solo de `buildContext` | Evals por agente |
| 4 Accesos | Sin cambios de código | Evals: otra institución (404), otro docente (403), compañero (403), curso sin matrícula (403/404), lección sin publicar (403), preguntas por datos ajenos |
| 5 Guardrails | `src/utils/outputGuard.js`; guard por agente en `agentRegistry.js`; tutor con pista y bloqueo de clave de evaluación abierta; `claimCheck` más preciso en negaciones; lección enviada sin datos personales | `tests/evals/guardrails.test.js`, `agentes.test.js`, `drive.test.js` (inyección en material, Drive y entregas), `claimCheck.test.js` |
| 6 Caché | `ai_response_cache` y `services/agents/responseCache.js` (solo el resumen de lección); invalidación en `contentService`; purga en retención; `AI_PROMPT_CACHE` con `cache_control` | `agentes.test.js` (segunda persona sin llamada, sin cuota, no entre instituciones, invalidación al editar, nunca el tutor), `router.test.js` |
| 7 Router | `modelForTier`, `readAiConfig({ tier })`, `tierFor` con `AI_TIER_<AGENTE>`; `.env.example`, `render.yaml`, `docs/despliegue.md` | `router.test.js` y evals por agente (`model_tier` y `model` en la bitácora) |
| 8 Observabilidad y evals | Columnas `model_tier`, `cache_hit`, `guard_outcome`, `cache_read_tokens` y `cache_write_tokens`; resultado `guard_blocked`; `tests/evals/` y `tests/evals-real/`; `npm run evals`; `.github/workflows/evals.yml` | Suite completa |

Ejecutado el 2026-11-24:
- Migraciones up, down y up en la base de pruebas.
- Backend: lint y 209/209.
- Frontend: lint, 58/58 y build.
- Playwright: 38/38.
- Prueba de la auditoría anterior: 4/4.

Después de integrar `main` (PR #13, CRM), el 2026-11-24:
- Backend: lint y 241/241.
- Frontend: lint, 65/65 y build.
- Playwright: 44/44.
- La migración de capas de IA se renombró a `20261124000300-ai-layers.js` para no compartir fecha con `20261124000100-platform-crm.js`.
- `crmMigrations.test.js` necesita que el usuario de pruebas pueda crear su base temporal; en CI corre como root.

Evals con modelo real: **no se ejecutaron**. El `.env` local apunta `AI_BASE_URL` al doble de Playwright (`127.0.0.1:4599`) y no tiene una clave real. El runner ahora lo detecta y omite los 13 casos.
Entregables regenerados: modelo de datos con 75 tablas en 7 módulos (se agregó «CRM de admisiones y plataforma»).

Pendiente:
- Correr `npm run evals` con una clave real.
- Cargar los secretos y marcar la revisión requerida en GitHub.
- Medir `cache_read_tokens` con `AI_PROMPT_CACHE=on`.
- Validación docente de las respuestas del tutor.

## Integración de auditoría de main en feature-CRM

Se integraron los cambios de seguridad y producción con admisiones y el CRM de plataforma. La copia de datos mantiene la información de admisiones y excluye respuestas de evaluaciones pendientes; se conserva la anonimización y la retención de CRM. El diccionario y los diagramas se regeneraron a partir de una base MySQL temporal migrada (74 tablas), que se eliminó después. Frontend: lint y build correctos; 65 pruebas correctas al repetir con dos procesos tras agotarse tiempos en una primera ejecución bajo carga. Backend: lint correcto y 57 pruebas específicas de agentes, admisiones, gobernanza, integraciones, seguridad y CRM de plataforma correctas con MySQL temporal. El Node local es 24.14.0, inferior al mínimo 24.15.0 indicado por la versión integrada. No se ejecutó la suite completa del backend ni pruebas en navegador y no se aplicaron migraciones a la base de uso.

## Integración de main en feature-CRM

Se conservaron los antecedentes de ambas ramas y se combinaron los estilos accesibles del CRM con los colores de marca, GSAP y animaciones limitadas de `main`. Frontend: `npm run lint`, `npm test` (57 pruebas) y `npm run build` correctos. La prueba de navegador no se ejecutó: la revisión automática de permisos no pudo completarse por el límite de uso. El servidor frontend volvió a iniciarse.

## Sesión 2026-11-24 · CRM de instituciones de plataforma, avance parcial

Se añadió una ficha separada del CRM de admisiones: lista de instituciones con búsqueda y paginación, creación explícita idempotente de ficha, edición versionada y registro de contactos con clave de reintento. Acceso y auditoría son de plataforma. Se agregaron la migración aditiva `20261124000100`, modelos, servicio, rutas, pantalla y pruebas. No se ha migrado la base de uso. La implementación sigue incompleta: faltan tareas, casos, actividades, pasos verificables, panel, edición/supresión de contactos y conservación; no introducir contactos reales mientras falten controles de privacidad. Detalles en `docs/adr/0007-crm-instituciones.md`.

Verificación: lint de ambos proyectos; frontend 53 pruebas y build correctos. Suite backend completa: 170 pruebas correctas con MySQL local y base temporal descartable (`NODE_ENV=test node --test --test-concurrency=1 tests/**/*.test.js`), incluidas las pruebas de admisiones y del nuevo módulo. Navegador: `playwright test e2e/platform-crm.spec.js`, 2 pruebas correctas en escritorio y móvil, con base descartable. La primera corrida del módulo usó un esquema anterior porque la migración se editó durante esa ejecución; la repetición aislada con esquema definitivo pasó. Las primeras corridas de navegador fallaron por el consentimiento inicial de la cuenta temporal y se corrigió su preparación; la repetición pasó. No se ejecutaron todas las pruebas de navegador ni comparación visual de capturas.

## Sesión 2026-11-24 · Seguridad Express complementaria, avance parcial

Se revisó la presentación de 27 diapositivas y el estado actual. Se exige vencimiento, sujeto e identificador en JWT; el login de cuenta inexistente verifica un hash ficticio representativo; bcrypt no acepta costes menores a 10 fuera de test (valor inválido vuelve a 12). Lint en ambos proyectos, tres pruebas unitarias nuevas, 51 pruebas frontend y build pasaron. La matriz y sus pendientes están en `docs/seguridad/SEGURIDAD_EXPRESS_COMPLEMENTARIA.md`. MFA, validación de correo y política de contraseñas del encargo siguen pendientes. No se cambió el diseño ni se añadieron migraciones.

Suite completa backend: 166 pruebas correctas con MySQL local en base temporal creada y eliminada para esta corrida. Playwright `e2e/acceso.spec.js`: 3 pruebas correctas con otra base temporal eliminada y proveedores dobles; no se ejecutó toda la suite e2e.

## Sesión 2026-11-24 · Seguridad OWASP, avance parcial

Se añadieron bloqueos transaccionales a recuperación y activación, límite de 72 bytes UTF-8 para nuevas contraseñas y rechazo de propiedades heredadas como agentes. El scrypt largo no se migra automáticamente a bcrypt. La revisión, riesgos pendientes y resultados de auditoría están en `docs/seguridad/REVISION_OWASP_2025.md`. No se cambiaron estilos ni navegación. La revisión de las diez categorías no está terminada; Drive y OOXML requieren atención prioritaria.

Verificación: lint backend y frontend correctos; suite backend MySQL 162 pruebas correctas (incluye recuperación concurrente); frontend 51 pruebas y build correctos; Playwright `e2e/acceso.spec.js` 3 pruebas correctas en escritorio/móvil con servicios locales y base `_e2e`. No se ejecutó toda la suite e2e ni se probó Google real. La prueba de activación concurrente se agregó después de iniciar la suite completa y pasó en una ejecución separada de `tests/security.test.js` (9 pruebas).

**Antecedentes** — 2026-11-23. Logo «M con birrete» en la página; GSAP y microinteracciones; antes, logo oficial y requisitos del Proyecto Final FWD: bcrypt y JWT, gobernanza (Ley 8968) y rol auditor, 8 agentes de IA, APIs externas y n8n, catálogo de roles, configuración de despliegue, nueva identidad visual y documentos entregables.
**Última actualización** — 2026-11-23. Correcciones de la auditoría de salida a producción (rama `fix/auditoria-produccion`); antes, correcciones de la revisión independiente (rama `fix/revision-independiente`); antes, asignación de seguridad web (rama `feature/seguridad-web`); antes, correcciones de la auditoría técnica (rama `fix/auditoria`); antes, logo «M con birrete» en la página; GSAP y microinteracciones; antes, logo oficial y requisitos del Proyecto Final FWD: bcrypt y JWT, gobernanza (Ley 8968) y rol auditor, 8 agentes de IA, APIs externas y n8n, catálogo de roles, configuración de despliegue, nueva identidad visual y documentos entregables.

## Sesión 2026-11-23 (noche) · Auditoría de salida a producción
Rama `fix/auditoria-produccion` (sobre `fix/revision-independiente`). Decisiones en `docs/adr/0008-auditoria-produccion.md`.

| Hallazgo | Cambio | Prueba |
| --- | --- | --- |
| H-01 validador del tutor | `claimCheck.js`: contexto de cada número, negaciones contra la oración más parecida, «por ciento»; texto de la interfaz sin prometer corrección | `claimCheck.test.js` (los 4 casos de la auditoría y paráfrasis que no deben rechazarse) |
| H-02 baja pendiente | Baja en el servidor antes de responder; n8n solo avisa; `reconcilePendingDeletions` en la retención | `integrations.test.js` (webhook 200, webhook caído, pendiente conciliada) |
| H-03 sesión cerrada antes de tiempo | `PrivacidadDatos.jsx` distingue `completed` | `PrivacidadDatos.test.jsx` |
| H-04 recordatorios truncados | Cursor `after`/`limit`, `reminder_deliveries` (migración `20261123000300`), `POST /integrations/daily-reminders/deliveries`, preferencia `emailReminders`, workflow 02 con paginación y registro | `integrations.test.js` |
| H-05 copia incompleta | `exportMyData` con 19 secciones de aprendizaje y `scope` | `integrations.test.js` |
| H-06 IP falsa | `limiter({ key })` por correo y por cuenta | `coordination.test.js` |
| H-08 migraciones | Regla ampliar y luego contraer; sin `undo` en producción; `preDeployCommand` documentado | — |
| H-09 observabilidad | `requestLog` JSON, `utils/requestMetrics.js`, `GET /ops/metrics` | `observability.test.js` |
| H-10 Vercel | 120 s para el primer byte en guía y Plan de Producción | — |

Ejecutado el 2026-11-23: backend lint + 176/176, frontend lint + 58/58 + build, Playwright 38/38. Prueba de la auditoría: 4/4. Entregables regenerados (modelo de datos con 64 tablas).
Pendiente: H-07 (servicio sin suspensión y cola), H-11 (staging con TiDB y servicios reales), prueba de `TRUST_PROXY` en el despliegue, H-12 (inventario por campo y aprobación institucional), validación docente del tutor con el modelo real.

## Sesión 2026-11-23 (noche) · Correcciones de la revisión independiente
Rama `fix/revision-independiente` (sobre `feature/seguridad-web`). Decisiones en `docs/adr/0007-revision-independiente.md`.

| Hallazgo | Cambio | Prueba |
| --- | --- | --- |
| P1 OOXML | `utils/ooxml.js`: directorio central, partes obligatorias, rutas seguras, sin cifrado ni anidados, límites de entradas, tamaño y razón; usado en `fileSignature.js` y antes de `mammoth` | `ooxml.test.js` (válidos reales, ZIP renombrado, truncado, bomba de 30 MB, anidado, `..`, tamaño falsificado) |
| P2 fechas | `utils/dates.js` en esquemas, tipo de cambio, feriados y `clock.addDays` | `dates.test.js` |
| P2 Coach | `fitPlanToBudget` recorta el plan al presupuesto; la interfaz muestra el total | `agents.test.js` |
| P2 tareas de fondo | `runExclusive` con renovación del turno y cancelación; un turno por tarea | `coordination.test.js` (tarea lenta, turno perdido) |
| P2 despliegue | README «Despliegue: pendiente de verificar»; registro de aceptación en `docs/despliegue.md` §6 | — |
| P3 correo | `email_changes` (migración `20261123000200`), `emailChangeService.js`, `POST /auth/email/confirm`, página `/confirmar-correo`, avisos a la dirección anterior | `profile.test.js` (pendiente hasta confirmar, enlace reemplazado, usado, vencido, dirección tomada), `Perfil.test.jsx` |

Ejecutado el 2026-11-23: backend lint + 167/167, frontend lint + 56/56 + build, Playwright 38/38.
Pendiente: despliegue real con su registro de aceptación, pruebas con docentes y estudiantes, mejoras de experiencia (código del curso, inicio con tres acciones, recorrido guiado, explicación de recomendaciones), lector de pantalla y validación institucional de datos de menores.

## Sesión 2026-11-23 (tarde) · Asignación de seguridad: SQL, XSS, CSRF y CORS
Rama `feature/seguridad-web` (sobre `fix/auditoria`). Todo en `docs/seguridad/`.

| Paso | Cambio | Prueba o evidencia |
| --- | --- | --- |
| SQL | Búsqueda de Usuarios (`GET /users?q=`) con `Op.like` y comodines escapados; `consentSummary` sin fragmentos de SQL; interfaz con buscador | `webSecurity.test.js`, `e2e/seguridad.spec.js` |
| XSS | CSP estricta en `vercel.json` (también en `vite preview`); prueba de `Markdown` con etiquetas | `Markdown.test.jsx`, `frontend/scripts/verificar-csp.mjs`, `evidencias/csp.txt` |
| CSRF | Sin cambios de código (token por sesión, SameSite=Lax, Origin); pruebas nuevas | `webSecurity.test.js`, `evidencias/csrf-cors.txt` |
| CORS | `config/cors.js`: lista de orígenes, 403 `ORIGIN_NOT_ALLOWED`, métodos y encabezados limitados | `webSecurity.test.js` |
| Investigación | `investigacion-inyeccion-sql.md` con fuentes | — |
| Simulación | `backend/laboratorio/inyeccion-sql/` (`npm run lab:sqli`): solo 127.0.0.1, base `_lab`, datos efímeros; versión vulnerable solo ahí | Capturas 01–07 y `demostracion-inyeccion-sql.mp4` |
| Presentación | `Presentacion_Seguridad_MENTOR_AI.pptx` (23 diapositivas con notas del orador, estilo de la clase, IBM Plex) | Validada y revisada visualmente |

Ejecutado el 2026-11-23: backend 156/156 y lint, frontend lint + 54/54 + build, Playwright 38/38.

## Sesión 2026-11-23 (tarde) · Correcciones de la auditoría técnica
La auditoría externa (`Auditoria_tecnica_MENTOR_AI.pdf`) se atendió en la rama `fix/auditoria`. Decisiones en `docs/adr/0006-correcciones-auditoria.md`.

| Hallazgo | Cambio | Prueba |
| --- | --- | --- |
| M01 originales en disco temporal | `services/fileStore.js` (`STORAGE_DRIVER=local\|gcs`), materiales y avatares en Cloud Storage, `materials.content_sha256` (migración `20261123000100`), descarga con `X-Content-SHA256`; guía en `docs/despliegue.md` §2 | `storage.test.js`: original binario, borrado del disco y descarga con la misma huella |
| M02 migrador ausente en producción | `sequelize-cli` en `dependencies` | `NODE_ENV=production npm ci` en directorio limpio: `sequelize-cli --version` responde |
| M03 fila con archivo borrado | Carga en tres pasos; fila y auditoría en una transacción; la indexación fallida no borra | `storage.test.js`: bitácora caída → 0 filas y 0 objetos; indexación fallida → material descargable |
| M04 notas infladas | Máximo bloqueado con entregas calificadas (409), cambio auditado, bloqueo al calificar, tope de 100 % por entrega | `classroom.test.js` |
| M05 falsedad con cita real | Texto retenido hasta validar (`progress` en lugar de `delta`); `utils/claimCheck.js` compara números y términos por oración | `claimCheck.test.js`, `stream.test.js`, `useChatTutor.test.jsx`, `MensajeTutor.test.jsx` |
| M06 datos hacia la IA | `utils/personalData.js` oculta cédulas, teléfonos, correos y enlaces en tutor, entregas, cumplimiento y anuncios; aviso de privacidad 2026-11-23 con tabla por asistente | `agents.test.js` |
| M07 aceptación solo en la interfaz | `middlewares/consent.js`: escrituras con documentos pendientes → 403 `CONSENT_REQUIRED`; la interfaz reabre el diálogo | `governance.test.js`, `api.test.js` |
| M08 tokens no atómicos | Recuperación y activación con bloqueo y actualización condicionada | `security.test.js`: dos peticiones simultáneas, una gana |
| M10 `agent_runs` sin purga | `purgeOldAgentRuns` a los 90 días | `coordination.test.js` |
| M12 Node/jsdom | `engines` `^22.22.2 \|\| >=24.15.0`; Node 22.22.2 en Render y CI | — |
| M13 citas S0/S01 | IDs exactos; todo descartado → `no_evidence` (cuenta para la cuota) | `agents.test.js` |
| M14 401 distinto en SSE | `errorDeRespuesta` compartido; error de proxy → «El servicio no está disponible» | `api.test.js` |
| M16 objetivo táctil | `.enlace-tactil` (24 px) en acceso y recuperación; logo móvil a 38 px (≥ 160 px de ancho) | `e2e/accesibilidad.spec.js` con axe-core en 390, 768 y 1280 |
| M18 residuos en el ZIP | `scripts/empaquetar.sh` (solo archivos versionados) | — |
| M19 teardown ruidoso | `stream.test.js` cierra solo lo que abrió | — |

Documentación: portadas con grupo 67, Rossman Rivera y Erian Fallas, profesor Steven Ledezma; sin la nota de «Actualizar campo». Mockups (92) regenerados, modelo de datos (62 tablas, 579 columnas, 123 FK), plan de producción (Cloud Storage, P-11) y riesgos R29–R32.

Ejecutado el 2026-11-23 con Node 22.23.4 y MySQL 8.0: backend 149/149, frontend lint + 53/53 + build, Playwright 36/36, capturas 10/10.

Pendiente: M09 (OOXML), M11 (paginación de recordatorios), M15 (sinónimos y números en la búsqueda local), M17 (`uuid` de Sequelize), restauración conjunta con acta, lectores de pantalla, pruebas con usuarios y validación con la institución.

## Sesión 2026-11-23 · Logo «M con birrete»
- La cabecera usa la opción 1: la «M» con birrete oficial ocupa el lugar de la M de «MENTOR» (sin órbita ni estrella). Archivos en `frontend/public/marca/logo-horizontal-*.svg`; las cuatro opciones y la nota de cómo se rellenaron los huecos de la órbita están en `docs/marca/m-birrete/`.
- Alto del logo: 44 px (50 px en la portada, 36 px en móvil).
- Ejecutado: lint limpio, 50/50 pruebas de frontend, build correcto y captura de `/login` en tema claro y oscuro. No se volvieron a correr las e2e.
- Documentación actualizada: 46 mockups en escritorio y 46 en móvil regenerados (`npx playwright test -c playwright.capturas.config.js`, 10/10), láminas de marca, paleta con el naranja botón `#C2410C`, libro de marca, anteproyecto, modelo de datos y plan de producción en Word y PDF (portada con el logo nuevo y fila del cronograma del 23/11).

## Sesión 2026-11-20 · GSAP, microinteracciones y accesibilidad

| Cambio | Dónde | Cómo se comprobó |
| --- | --- | --- |
| GSAP es el motor de `Animaciones.jsx` (Revelar, Contador, AnilloPuntaje, TarjetaInteractiva) con la misma API: React pinta el estado final y GSAP anima «desde»; con movimiento reducido no hay animación | `utils/gsap.js`, `Componentes/Animaciones.jsx`, `hooks/useMovimiento.js` | `tests/Animaciones.test.jsx` (4 pruebas) |
| Revelar usa solo opacidad (no `visibility`) para que el contenido siga alcanzable con el teclado; opción `inmediato` para respuestas a una acción | `Animaciones.jsx`, `Asistentes.jsx` | Playwright 24/24 (detectó y se corrigió un resultado oculto) |
| Se quitó el CSS que competía con GSAP (`.revelar`, transform de `.tarjeta-enlace`, transición del anillo); la tarjeta sube también con el foco | `styles.css` | Revisión y Vitest |
| Rejilla de la portada cargada con `React.lazy` solo cuando entra en pantalla; chunk `vendor-gsap` | `Portada.jsx`, `RejillaRasgos.jsx`, `vite.config.js` | Medición con el build |
| Anunciador global (`aria-live`) para guardados, resultados, cambios de sección y retroalimentación de quizzes y práctica; el foco pasa al botón «Siguiente» | `Anunciador.jsx`, `Estados.jsx`, `OpcionesQuiz.jsx`, `JugarQuiz.jsx`, `PracticaDiaria.jsx`, `EstudianteCurso.jsx`, `Pendientes.jsx` | Vitest y Playwright |
| Esqueletos de carga con forma de contenido y textos concretos; botones con `aria-busy` y «Guardando…»; aviso de éxito con ✓; fila nueva o guardada resaltada; panel de sección con entrada suave; racha que «salta» al subir | `Estados.jsx`, `Asistentes.jsx`, `AdminUsuarios.jsx`, `CursoCalificaciones.jsx`, `EstudianteTarea.jsx`, `styles.css` | Vitest y Playwright |
| Accesibilidad: naranja de botones `#c2410c` (5,2:1 con blanco); efectos de hover también con `:focus-visible`; animaciones infinitas limitadas a una entrada o 3 ciclos; `.boton-texto` de 24 × 24 px como mínimo | `styles.css` | Revisión |

### Peso del JavaScript inicial
- Carga inicial de `index.html` (entrada + precargas): antes **297,1 kB (95,5 kB gzip)**, después **296,2 kB (95,1 kB gzip)**.
- Todo lo que descarga `/login` al abrir: antes **310,2 kB (100,9 kB gzip)**, después **309,3 kB (100,6 kB gzip)**. GSAP no se descarga hasta que la rejilla de la portada entra en pantalla.
- `vendor-gsap`: 115,3 kB (45,7 kB gzip), solo en las páginas que lo usan.

### Resultados
- Frontend: `npm run lint` sin errores; `npm test` **50 de 50**; `npm run build` compila; `npm run test:e2e` **24 de 24**.
- Backend: `npm run lint` sin errores; `npm test` **139 de 139** (sin cambios en el backend).

### Pendiente
- Probar con NVDA o VoiceOver los anuncios del anunciador global (se revisaron en el árbol de accesibilidad, no con un lector real).
- Revisar en un navegador real la vista 390 × 844 y 1280 × 900 en modo oscuro y alto contraste.

## Sesión 2026-11-20 · CRM de admisiones y mejoras obligatorias

Encargo contrastado con `PROMPT_CODEX_CRM_Y_MEJORAS_MENTOR_AI.md` y texto del taller original. Implementación local; guía, contratos, supuestos, matriz de requisitos y backlog en [CRM.md](CRM.md). No se publicaron cambios, enviaron mensajes reales ni cargaron registros de evaluación en bases compartidas.

| Cambio | Archivos relevantes | Evidencia |
| --- | --- | --- |
| Convocatorias por curso, fichas mínimas, solicitudes independientes y nueve etapas | `models/Crm.js`, migraciones `20261122000100`/`20261122000200`, `crmSchemas`, `crmService`, `crmAccessService` | Permisos cruzados, correspondencia prospecto/solicitud, duplicados, versiones concurrentes, requisitos/retrocesos y fechas futuras |
| Ficha, historial, tablero/lista, filtros, atención, responsables y seguimientos | `Pages/Crm*`, `Componentes/Crm/*`, `crmRoutes`, `crmController` | Integración, componentes y navegador escritorio/móvil; historial y listas paginados, sin búsqueda personal persistida en la dirección |
| Embudo histórico y cohorte madura | `crmMetricsService`, snapshots de configuración/procedencia, ADR 0006 | Prueba 120/26; ventanas completas, cero/última etapa, cortes y configuración histórica; cerrar convocatoria no cambia la versión métrica |
| Matrícula atómica | `crmConversionService`, `enrollmentMutationService`, `userService`, `courseService` | Nueva/invitada/compatible/inhabilitada/otra institución/rol, vinculación, reintegro, doble petición simultánea y rollback con fallo de evento |
| Redactor de admisiones y revisión humana | `agents/admissionsAgent`, registro/runner, `crmDraftService`, `crmContextService` | Contexto sin contactos, JSON validado, sin clave/caído/inválido, edición/aprobación/contexto obsoleto, cuota simultánea. Solo doble de proveedor |
| Consentimientos, derechos y conservación | `crmPrivacyService`, `governanceService`, retención por leases, casos de verificación | Copia/corrección/supresión sin cuenta, exportación propia y anonimización de cuenta vinculada, cierre independiente y excepción de conservación |
| Privacidad efectiva y costos | `personalData`, compliance checker, `agentRunner`, `usageService`, `costService` | Payload enmascarado antes del proveedor; límites persona/institución con reservas y orden institución→usuario; tutor excluido de cuota de asistentes; tarifas por modelo y desconocidos nulos |
| Formularios e invitaciones | `useEnvio`, `useDatos`, `Campo`, `AdminUsuarios`, `EnlaceInvitacion` | Bloqueo sincrónico de dobles clics, cancelación/respuestas obsoletas, errores ligados al control, enlaces vencidos/renovación explícita, texto preservado ante conflicto |
| Accesibilidad | `styles.css`, diálogos nativos, lista/columna móvil | 12 estados medidos por dispositivo: botón mínimo 5,178:1, campo 3,929:1, texto seleccionado 8,584:1, indicador 4,792:1, foco 5,660:1; teclado, retorno de foco y reflujo a 360px/200 % |
| Regresión de práctica diaria | `streakService`, `gamification.test` | La segunda lectura tras bloquear matrícula ahora es una lectura actual; REPEATABLE READ conservaba una ausencia inicial en aperturas simultáneas. No cambió la fórmula de notas ni bonos |
| Documentación y fuentes generadas | `CRM.md`, contratos, ADR, agentes, APIs, inventario/riesgos, `docs/datos`, `docs/mockups` | Modelo desde esquema aislado: **70 tablas, 689 columnas, 148 FKs**. Capturas inspeccionadas, SVG/PNG de CRM y general generados |

### Validación real de la sesión

- Entorno: Windows, Node **24.14.0**, MySQL local **8.0**, Vite 7, Chromium de Playwright. No se cambió el stack.
- Backend: `npm run lint` sin errores; `npm test` **159/159**. Incluye **18 pruebas CRM** y una prueba de migraciones que crea/elimina una base descartable, verifica esquema sin contenido, preserva un registro previo y ejecuta down/up. Repetición final focalizada: **18/18** CRM.
- Frontend: `npm run lint` sin errores; `npm test` **51/51**; `npm run build` compila.
- Navegador: `npm run test:e2e` **28/28** en escritorio/móvil, con backend/MySQL reales aislados y proveedores falsos. Subconjunto CRM tras la mejora de conservación de texto en conflictos: **4/4**; lint, 51 pruebas de componentes y compilación repetidos con éxito.
- Escenario CRM40: **40** solicitudes con distribución actual **6/5/5/5/5/4/4/3/3**; agenda→asiste **24/29 = 82,7586 %**, brecha frente a meta de prueba 75 % **−7,7586 pp**, **3 matrículas nuevas**. Reloj simulado, todas las escrituras por la API, limpieza al terminar; no es dataset entregado para producción.
- Bases separadas de `mentor`; limpieza de registros de integración y navegador al terminar. El catálogo `roles` y `SequelizeMeta` se preservan. La prueba de migraciones elimina exclusivamente su base recién creada.
- MySQL local `mentor`: se aplicaron las dos migraciones aditivas, **8 tablas CRM y 0 filas CRM**. API reiniciada y `/api/v1/health` confirmó conexión. Frontend local devuelve HTTP 200 en `127.0.0.1:5173`.
- IA, SMTP, Hacienda, feriados y nube se prueban con dobles; **ningún proveedor real de pago o correo real fue usado**. IA local sigue sin configurar. Configuración/conectividad se distinguen en Consumo.
- Advertencias observadas: jsdom informa `scrollTo` no implementado en pruebas existentes; una conexión cancelada produjo aviso de express-rate-limit por IP no disponible, sin fallar la prueba. No se ocultan como pruebas fallidas ni se confunden con conectividad de servicios reales.

### Pendiente comprobado

- Word/PDF de `docs/entregables`: fuentes actualizadas, **binarios sin regenerar**. No hay Python instalado (`py -0p`), LibreOffice ni cargador de dependencias de documentos accesible para el renderer. Alcance exacto y pasos de render/inspección en `entregables/ACTUALIZACION_CRM.md`.
- Evaluación manual con NVDA/VoiceOver y auditoría integral de accesibilidad; no se afirma conformidad integral WCAG ni cumplimiento legal certificado.
- Verificación con proveedor IA real y MySQL 8.4, activación de integraciones, revisión institucional de políticas/plazos, respaldos/exportaciones y tarifas; no forman parte de las llamadas automáticas de prueba.
- Formulario público, campañas/gastos/atribución, bonus social, WhatsApp, publicación y automatizaciones externas/programas multicurso permanecen en el backlog opcional descrito en `CRM.md`.

El acceso de plataforma se mantiene operativo sin acceso automático al CRM personal. Para usar Admisiones, crear una institución e invitar a su administración mediante el flujo habitual. No se crearon cuentas ficticias ni contenido académico en desarrollo.

## Sesión 2026-11-20 · Requisitos FWD y entregables

| Cambio | Dónde | Cómo se comprobó |
| --- | --- | --- |
| Contraseñas con bcrypt (12 rondas, rehash de scrypt), sesión JWT HS256 en cookie httpOnly revocable, recuperación de contraseña por correo (PR #1) | `utils/security.js`, `utils/jwt.js`, `authService`, `passwordResetService`, `RecuperarClave.jsx`, `RestablecerClave.jsx` | `security.test.js` |
| Gobernanza: consentimientos versionados, copia de datos, baja con anonimización y aviso, rol auditor de solo lectura, páginas de privacidad y términos (PR #2) | `consentService`, `governanceService`, `Privacidad.jsx`, `Terminos.jsx`, `PrivacidadDatos.jsx`, `Gobernanza.jsx` | `governance.test.js`, Playwright |
| 8 agentes de IA con permisos por rol, salida validada, cuota diaria y bitácora `agent_runs` (PR #3) | `services/agents/`, `Asistentes.jsx`, `docs/agentes-ia.md` | `agents.test.js` con proveedor simulado |
| APIs externas (tipo de cambio de Hacienda, feriados de Nager.Date) y endpoints para 3 workflows de n8n (PR #4) | `services/external/`, `integrationService`, `n8n/*.json` | `integrations.test.js` con respuestas simuladas |
| Configuración de despliegue: Render (Virginia), Vercel con reescritura `/api`, TiDB Cloud con TLS (PR #5) | `render.yaml`, `frontend/vercel.json`, `docs/despliegue.md` | Revisión; **no desplegado todavía** |
| Catálogo `roles` con FK desde `users.role` (PR #6) | migración `20261121000500` | Migraciones up/down/up; suite completa |
| Set de íconos propios y primer logotipo (PR #8; el logotipo lo reemplaza el logo oficial) | `Logo.jsx`, `Iconos.jsx`, `public/` | Vitest y Playwright |
| Logo oficial (entregado por la estudiante en SVG, sin redibujar): «M» con birrete, órbita y estrella; versiones horizontal y vertical, claro y oscuro; favicon e ícono de app. Colores de la interfaz alineados: `#181B3E`, `#3452E1`, `#C5EF6A` (y `#6F86FF` para la órbita en fondo oscuro) | `Logo.jsx`, `public/marca/`, `favicon.png`, `icono-192.png`, `apple-touch-icon.png`, `icono-512.png`, `docs/marca/oficial/`, libro de marca | Vitest 46/46, Playwright 24/24, capturas en escritorio y móvil |
| Modelo de datos (ER general y 6 por módulo, diccionario), mockups de 46 pantallas en escritorio y móvil, libro de marca, anteproyecto, plan de producción en Word y PDF | `docs/datos/`, `docs/mockups/`, `docs/marca/`, `docs/produccion/`, `docs/entregables/`, `frontend/capturas/` | PDF renderizados y revisados página por página |

### Resultados
- Backend: `npm run lint` sin errores; `npm test` **139 de 139**.
- Frontend: `npm run lint` sin errores; `npm test` **46 de 46**; `npm run build` compila.
- Navegador: `npm run test:e2e` **24 de 24**; capturas de mockups 10 de 10.
- Todo lo anterior usa dobles para la IA, Hacienda y Nager.Date: **ninguna integración se probó todavía contra el servicio real.**

### Pendiente
- Desplegar (TiDB, Render, Vercel, n8n), confirmar las URLs y tomar las capturas de las pruebas posteriores para el Plan de Producción.
- Verificar en vivo el formato de la API de Hacienda y la importación de los tres workflows en n8n.
- Crear desde la aplicación las cuentas de prueba por rol para el profesor (no se versionan).
- Completar grupo y profesor en las portadas de los documentos.

## Sesión 2026-11-20 · Personalización

| Cambio | Dónde | Cómo se comprobó |
| --- | --- | --- |
| Migración `20261120000100`: `user_preferences`, `topic_reviews`, `topic_review_logs`, `study_plans`, `study_plan_items` | `database/migrations`, `models/Personalization.js` | Pruebas sobre base nueva; aplicada en desarrollo |
| Preferencias en la cuenta (tema, tamaño de texto, alto contraste, menos movimiento, espaciado de lectura, subrayar enlaces, zona horaria, metas) | `preferenceService.js`, `GET/PATCH /me/preferences`, `Configuracion.jsx`, `services/preferencias.js` | `personalization.test.js`, `Preferencias.test.jsx`, capturas en Chrome |
| Tema oscuro y alto contraste: los colores fijos de `styles.css` pasaron a variables; el texto escala con `%` | `styles.css` | Capturas claro, oscuro, alto contraste y móvil (sin desborde horizontal) |
| Repaso espaciado FSRS-4.5 por tema: se programa en la transacción del envío; autoevaluación solo cuando toca | `utils/spacedRepetition.js`, `reviewService.js`, `assessmentService.js` | `personalizationUnits.test.js` (valores calculados), `personalization.test.js` (reloj simulado) |
| Plan de estudio determinista (`planner-1`): prioriza brechas, respeta prerrequisitos, no supera los minutos y avisa lo que no cabe | `utils/studyPlanner.js`, `studyPlanService.js`, `EstudiantePlan.jsx` (ruta `/estudiante/plan`) | Pruebas unitarias e integración; plan creado en Chrome |
| Práctica diaria de 5, 10 o 15 preguntas (el mínimo de la racha sigue en 5) | `streakService.js` | Suite completa sin cambios en `gamification.test.js` |
| ADR 0005, gobernanza (R21 a R23) y `docs/07` (rutas reales del plan) | `docs/` | Revisión |
| Perfil: foto (validada por contenido, servida con `nosniff` y solo dentro de la institución), nombres, apellidos, teléfono, presentación, cambio de correo y de contraseña con la contraseña actual (mismo bloqueo que el inicio de sesión; cierra las demás sesiones). Migración `20261120000200` | `profileService.js`, `profileRoutes.js`, `EditorPerfil.jsx`, `Avatar.jsx` | `profile.test.js`, `Perfil.test.jsx`, captura en Chrome |
| Reintegrar estudiantes retirados: botón en Matrículas que reactiva la misma matrícula (conserva el historial); auditoría `enrollment.reinstated`; con la cuenta deshabilitada se explica por qué no se puede | `courseService.enrollStudent`, `CursoMatriculas.jsx` | `enrollment.test.js`, `Matriculas.test.jsx` |
| Correcciones encontradas al verificar: `cleanDatabase` vaciaba `SequelizeMeta` en Windows (nombre en minúsculas); el arranque e2e no corría en Windows (`npx` y `import()` de ruta); el aviso «Calificaciones guardadas» se borraba al recargar | `tests/helpers.js`, `e2e/support/start-backend.mjs`, `CursoCalificaciones.jsx` | La suite completa ahora corre en Windows |

### Resultados
- Backend: `npm run lint` sin errores; `npm test` **113 de 113**.
- Frontend: `npm run lint` sin errores; `npm test` **46 de 46**; `npm run build` compila.
- Navegador: `npm run test:e2e` **16 de 16** (con `E2E_CHROME_PATH` y la base vacía `mentor_ai_e2e`).

### Pendiente
- Probar el modo oscuro y el alto contraste con NVDA/VoiceOver y medir contraste con una herramienta (se revisó a ojo en capturas).
- Las preguntas no tienen dificultad ni los quizzes tema: la práctica no se adapta por dificultad y los repasos solo nacen de evaluaciones.
- Ajustar los parámetros de FSRS con `topic_review_logs` cuando haya datos reales.
- El naranja de los botones principales (`#f0591a`) tiene 3,3:1 con texto blanco en el tema normal; solo el alto contraste lo corrige. Decidir si se oscurece para todos.

## Sesión 2026-11-19 · Aula, quizzes, racha y nota

| Cambio | Dónde | Cómo se comprobó |
| --- | --- | --- |
| Migración `20261119000100`: pesos de nota, trabajo en clase, quizzes, partidas, práctica diaria, racha y eventos de bono | `database/migrations`, `models/Gamification.js` | Pruebas sobre base nueva |
| Quiz con tiempo medido por el servidor, clave protegida, bono de 0,1 una vez por quiz y tabla de posiciones | `quickQuizService.js` | `gamification.test.js` (reloj simulado) y Playwright |
| Práctica diaria de 5 preguntas, racha que avanza, se pone en riesgo y se reinicia; +0,09 por día | `streakService.js`, `utils/clock.js` | Prueba de cuatro días simulados y Playwright |
| Nota de 0 a 10: evaluaciones, tareas y trabajo en clase con pesos; bono con tope; reparte el peso de lo no calificado | `gradeService.js`, `classWorkService.js` | Prueba con valores exactos (8,05) y Playwright (8,19) |
| Personas sin correos para el alumno, calendario semanal, pendientes / por revisar y perfil | `workspaceService.js` | `gamification.test.js` |
| Barra lateral con clases, pestañas tipo aula, calendario, pendientes y configuración | `Layout.jsx`, `BarraLateral.jsx`, `EstudianteCurso.jsx`, `EncabezadoCurso.jsx`, `Pages/*` | Capturas de escritorio y móvil |
| Juego con figuras y colores, cuenta regresiva, puntos animados, confeti y llama de racha (todo se apaga con «menos movimiento») | `JugarQuiz.jsx`, `PracticaDiaria.jsx`, `OpcionesQuiz.jsx`, `TarjetaRacha.jsx`, `styles.css` | `Juego.test.jsx` y Playwright |
| ADR 0004 y gobernanza (R18 a R20) | `docs/` | Revisión |

### Resultados
- Backend: `npm run lint` sin errores; `npm test` **89 de 89**.
- Frontend: `npm run lint` sin errores; `npm test` **34 de 34**; `npm run build` compila.
- Navegador: `npm run test:e2e` **16 de 16** (escritorio y móvil).

### Pendiente
- Que la institución confirme la escala (0 a 10) y los valores del bono, que se pueden cambiar por curso.
- Clases archivadas en la barra lateral, notificaciones por correo y comentarios privados en tareas (vistos en la referencia de aula, no incluidos todavía).

## Sesión 2026-11-17 · Pulido de interfaz y accesibilidad

| Cambio | Dónde | Cómo se comprobó |
| --- | --- | --- |
| Ícono propio (`favicon.svg`), descripción, `theme-color` y aviso `noscript` | `frontend/public`, `frontend/index.html` | Compilación |
| Ilustraciones SVG propias por tema (libro, calendario, tarea, gráfica, chat, búsqueda), con flotación suave que respeta «menos movimiento» | `Componentes/Ilustracion.jsx`, `EstadoVacio.jsx`, `Portada.jsx` | Capturas en navegador |
| Página «no encontrada» dentro del diseño (antes redirigía en silencio al inicio) | `Pages/NoEncontrada.jsx`, `Rutas.jsx` | Vitest y Playwright |
| Límite de errores: si una página falla o no se descarga tras publicar otra versión, aparece un aviso con «Recargar» en vez de una pantalla en blanco | `Componentes/LimiteErrores.jsx`, `App.jsx`, `Layout.jsx` | Vitest (error común y descarga fallida) |
| Título de pestaña por sección y foco al contenido al cambiar de página; enlace «Saltar al contenido» | `utils/titulos.js`, `Layout.jsx`, `Portada.jsx` | Vitest y Playwright |
| `actions/checkout`, `setup-node` y `upload-artifact` en v5 (Node 24) | `.github/workflows/ci.yml` | Corrida de GitHub Actions |

### Resultados
- Frontend: `npm run lint` sin errores; `npm test` **31 de 31**; `npm run build` compila.
- Navegador: `npm run test:e2e` **12 de 12** (escritorio y móvil).
- Backend sin cambios en esta sesión (80 de 80 en la corrida anterior de CI).

## Sesión 2026-11-16 · Las 15 mejoras de la revisión

| # | Mejora | Dónde | Cómo se comprobó |
| --- | --- | --- | --- |
| 1 | `<` y `>` del texto de fuentes, preguntas e historial se neutralizan (`asData`); la pregunta va en `<pregunta>` | `tutorService.js` | Prueba con documento hostil que intenta cerrar su fuente y fingir la pregunta |
| 2 | `TRUST_PROXY` configurable (rechaza `true`) | `config/proxy.js`, `app.js` | Prueba unitaria y prueba con dos IP distintas detrás del proxy |
| 3 | Primeros bytes del archivo (PDF, ZIP de Office, PNG, JPEG, texto UTF-8 sin NUL) | `utils/fileSignature.js`, `courseBoardService.js` | Prueba con cuatro archivos renombrados (422, no quedan en disco) y prueba en navegador |
| 4 | El historial que recibe el modelo va sin marcas `[S#]` | `tutorService.js` | Prueba de historial |
| 5 | «Entrar» se activa con un temporizador al instante exacto de apertura, inicio y fin | `hooks/useEstadoClase.js`, `utils/clases.js` | Pruebas con reloj simulado y prueba en navegador (ventana que se abre a los 6 s) |
| 6 | Números escritos con letras como palabras vacías (también tras quitar el plural) | `utils/textChunks.js` | Prueba de términos |
| 7 | Comentario SSE `: ping` cada `SSE_PING_MS`; los errores rápidos siguen como JSON | `knowledgeController.js` | Prueba de streaming con pings y prueba del cliente que los ignora |
| 8 | Caché por id de versión; se piden metadatos y el texto solo de lo que falta | `retrievalService.js`, `knowledgeService.js` | Prueba: tres preguntas leen el texto de MySQL una sola vez |
| 9 | Una lectura del corpus por curso y ronda para confirmar importaciones y limpiezas | `vertexRagClient.js`, `knowledgeService.js` | Prueba: tres importaciones confirmadas con una sola lectura |
| 10 | Turno de tareas en MySQL (`job_leases`) y límites compartidos (`RATE_LIMIT_STORE=mysql`); liberación del turno al apagar | `coordination.js`, `rateLimitStore.js`, `backgroundJobs.js`, `server.js` | Pruebas de turno entre dos instancias y de límite compartido entre dos apps |
| 11 | Retención: texto de versiones sin citas (30 días), consumo resumido por mes (90), chats sin actividad (365) | `retentionService.js`, migración `20261116000500` | Prueba que respeta la versión citada y la vigente |
| 12 | El borrador deja de ser región viva; un aviso único anuncia «Respuesta lista con N fuentes» | `TutorCurso.jsx`, `useChatTutor.js` | Prueba del hook y prueba en navegador. **Pendiente: NVDA y VoiceOver reales** |
| 13 | Pruebas Playwright en `frontend/e2e` (escritorio y móvil) y GitHub Actions con MySQL 8.4 | `frontend/e2e`, `.github/workflows/ci.yml` | 11 de 11 en local |
| 14 | `/health` informa tutor, modo de búsqueda y Google Cloud sin datos sensibles | `healthController.js` | Prueba de flujo |
| 15 | Pruebas de `CargaArchivo` (rechazos, una petición, reintento) y `CursoFuentes` | `frontend/tests` | 5 pruebas nuevas |

### Resultados (Node 22, MySQL 8.0.46)
- Backend: `npm run lint` sin errores; `npm test` **80 de 80**.
- Frontend: `npm run lint` sin errores; `npm test` **27 de 27**; `npm run build` compila.
- Navegador: `npm run test:e2e` **11 de 11** (escritorio 1280 px y Pixel 7).
- Migraciones: base nueva sin filas de contenido; las migraciones nuevas se revierten y se vuelven a aplicar.
- MySQL 8.4: confirmado por GitHub Actions (servidor 8.4.13): backend **80 de 80**.

## Sesión 2026-11-16 · Optimización de rendimiento

### Cambios realizados

- `utils/textChunks.js` conserva rangos exactos del original y solapamiento entre fragmentos. Corrige la pérdida del final del pasaje cuando hay varias líneas en blanco, reconoce siglas cortas y exige que el pasaje remoto completo exista en el texto guardado. La normalización mantiene las posiciones de Unicode.
- `retrievalService.js` reutiliza fragmentos y conjuntos de términos en una caché acotada a 128 textos y 4.000.000 de caracteres. La autorización se consulta en MySQL en cada pregunta. En modo Vertex se leen primero metadatos y después el texto de las versiones recuperadas.
- `homeService.js` calcula avance mediante agregados, filtra la asistencia por estudiante y usa columnas explícitas y resultados planos. `courseBoardService.js` aplica el mismo criterio a anuncios y materiales. `analyticsService.js` agrupa respuestas y dominio antes de unirlos a los temas.
- La migración `20261116000400-optimize-read-indexes.js` añade índices en `class_sessions(course_id, status, starts_at)`, `assessment_attempts(assessment_id, status, student_id)`, `attempt_answers(question_id, is_correct)` y `ai_threads(user_id, course_id, id)`. Permite reanudar una aplicación parcial y revertirla conservando los índices que necesitan las claves foráneas. Se mantienen los índices previos de progreso y consumo.
- `app.js` negocia compresión HTTP con `compression`. El filtro omite `text/event-stream` para que los eventos lleguen de inmediato.
- `useChatTutor.js` mantiene el borrador fuera del historial, agrupa deltas cada 32 ms y cancela las cargas al salir. `TutorCurso.jsx` y `MensajeTutor.jsx` evitan renderizar mensajes anteriores durante el streaming. El lector SSE libera sus recursos ante cancelaciones y errores, y admite UTF-8 y CRLF entre paquetes.
- `useAhora.js` detiene los relojes al ocultar la pestaña. La ventana de acceso a las clases se revisa cada 15 segundos y al volver a la pestaña. La cuenta regresiva conserva su actualización por segundo. `ShapeGrid.jsx` atiende cambios de movimiento reducido durante la sesión.
- `Rutas.jsx` difiere 26 de las 27 páginas. El formulario de ingreso está en la entrada principal. `vite.config.js` separa React, Motion y React Spring en archivos con hash de contenido.

### Mediciones

| Comprobación | Versión recibida | Versión optimizada |
| --- | --- | --- |
| Búsqueda local con 100 documentos, mediana de 15 ejecuciones tras preparar la caché | 62,85 ms | 1,74 ms |
| JavaScript inicial completo, con dependencias estáticas | 283,15 kB | 282,50 kB |
| JavaScript inicial completo con gzip | 90,59 kB | 90,71 kB |

Los documentos de la medición son sintéticos, de unos 17.000 caracteres cada uno. El tiempo medido corresponde a la selección en memoria de fragmentos. El tiempo completo de una pregunta incluye además MySQL, red y generación. La mejora de empaquetado permite reutilizar las dependencias entre versiones. El tamaño gzip inicial aumenta 125 bytes.

### Validación de esta sesión

- Node.js 24.22.1 y MySQL 8.0.46 en una instancia aislada de pruebas.
- `npm run lint` pasa en `backend/` y `frontend/`.
- `npm test` en `backend/` pasa con **68 pruebas**. Incluyen los casos anteriores, rangos exactos, siglas, coincidencias parciales rechazadas, citas completas, avance por estudiante, compresión JSON y SSE sin compresión.
- `npm test` en `frontend/` pasa con **17 pruebas**. Incluyen citas, dominio, historial estable durante los deltas, cancelación, nueva conversación, UTF-8, cierre del lector SSE y reloj al volver a la pestaña.
- `npm run build` en `frontend/` pasa.
- Tras cambiar el texto de la página de ingreso y recompilar, los archivos de React, Motion y React Spring conservaron sus hashes. El cambio temporal se revirtió antes de empaquetar.
- Las migraciones se aplican sobre una base nueva y dejan **35 tablas de aplicación y cero filas de contenido**. La nueva migración se revierte y reaplica. Ejecutar su `up` dos veces mantiene un solo índice de cada nombre.
- Recorrido con Chromium Headless en 1280 × 900 y 390 × 844. Se comprobaron acceso, carga diferida de animaciones, pregunta sobre IA, tres citas desplegables con teclado, apertura del pasaje completo, detener la generación, nueva conversación, cambio de curso, aviso sin evidencia y ruta de activación. Se registraron dos cancelaciones en el generador de prueba y cero errores JavaScript. La vista móvil se mantiene dentro del ancho disponible.
- El recorrido usa el backend y MySQL reales con un generador de pruebas. Las pruebas de Vertex y Drive usan dobles. La llamada a Google Cloud, Drive y al proveedor con credenciales reales, junto con MySQL 8.4, sigue pendiente.

## Versión recibida · Tutor con fuentes, RAG Engine, Drive, streaming y consumo

### Entrega 1 · Tutor y aula
- `utils/textChunks.js`: fragmenta sin perder texto (párrafos largos por oraciones, con posiciones exactas) y exige un mínimo de coincidencias. Sin evidencia hay aviso `NO_EVIDENCE`, cero citas y ninguna llamada al modelo.
- «Dame una pista» y «Explica diferente» envían `intent`: la búsqueda usa la pregunta anterior del mismo hilo.
- La respuesta del proveedor se valida con Zod (`AI_INVALID_FORMAT`, 502). Las citas se contrastan con los fragmentos entregados; sin ninguna válida, aviso `NO_VALID_CITATIONS` en vez de la respuesta.
- `TutorCurso.jsx` + `hooks/useChatTutor.js`: el chat se monta con `key={courseId}`, «Nueva conversación» queda en estado explícito (`null`) y cada turno se cancela o descarta si cambia el hilo o el curso.
- `ClasesEnVivo.jsx` y `EstudianteInicio.jsx` calculan la ventana de 15 minutos con un reloj local (`utils/clases.js`, `hooks/useAhora.js`). El servidor sigue validando.
- `assessmentService.submitAttempt` bloquea la evaluación y rechaza un intento pendiente si ya está cerrada (`ASSESSMENT_CLOSED`); cerrar espera a la entrega en curso.

### Entrega 2 · RAG Engine de extremo a extremo
- Migración `20261116000200`: `course_rag_corpora` (un corpus por curso), `knowledge_sources`, `source_versions` (texto extraído, URI de Cloud Storage, archivo del corpus, operación), `ai_message_sources` y topes por institución.
- `knowledgeService.js`: lecciones publicadas, materiales PDF/DOCX/TXT (incluidos los existentes con «Indexar ahora») y Drive. Cada versión: objeto privado `mentor-ai/i{inst}/c{curso}/s{fuente}/v{versión}.txt` → `ragFiles.import` → se confirma el archivo en el corpus (`fileStatus`) antes de marcarla lista. Una sola versión activa; la anterior pasa a limpieza.
- `retrievalService.js`: autoriza en MySQL, llama a `retrieveContexts` solo con los `ragFileIds` activos, descarta resultados de origen desconocido o retirado y verifica el pasaje dentro de la versión publicada. Sin fuentes autorizadas no se consulta Google. `RAG_UNAVAILABLE` (falla) es distinto de `NO_EVIDENCE` (sin coincidencias).
- Cita protegida `GET /tutor/messages/:id/citations/:n` y página `CitaTutor.jsx`: pasaje, título, página o sección, versión y aviso si hay una más nueva. La URI interna nunca sale del servidor.
- Retiro inmediato (docente, borrador, borrado). El historial marca «fuente retirada» y el modelo no recibe esos turnos. Al borrar una lección se reconcilian el archivo local, el objeto privado y el archivo del corpus, con reintentos y solo sobre recursos administrados.
- Pantalla docente `CursoFuentes.jsx`: estado, motivo, reintento, retiro, versiones y uso en respuestas.

### Entrega 3 · Drive, chat y consumo
- Migración `20261116000300`: carpetas habilitadas por la institución, vínculo por curso con sincronización reanudable y `ai_usage_events`.
- `driveSyncService.js`: recorre todas las páginas, exporta Google Docs a texto, descarga PDF/DOCX/TXT, no reindexa lo que no cambió, reanuda desde la página guardada sin declarar borrados, retira lo que salió de la carpeta y desactiva todo si se pierde el acceso (404). Solo lectura.
- `aiProvider.streamWithProvider` con el SDK oficial de Anthropic; SSE en `POST /tutor/threads/:id/messages/stream`; cancelación al salir o con «Detener». Un flujo interrumpido no se guarda. OpenAI conserva su ruta JSON.
- `usageService.js`: reserva atómica con bloqueo de fila (institución y luego usuario). Límite por persona (`RATE_LIMITED`) y por institución (`INSTITUTION_QUOTA`), ambos 429. Tope de documentos (`DOCUMENT_LIMIT`). Registro de modelo, latencia y tokens sin contenido. Pantalla `AdminConsumo.jsx` (sin costos: no hay tarifas verificadas).
- Tareas periódicas (`backgroundJobs.js`): revisión de importaciones, limpieza remota, reconciliación de archivos y sincronización de Drive opcional.

### Mejoras de interfaz
| Biblioteca | Archivo | Resultado observado en el navegador |
| --- | --- | --- |
| Motion (`motion/react`, `LazyMotion` + `m`) | `Componentes/MensajeTutor.jsx` | Primera cita visible; «Ver 2 fuentes más» con `aria-expanded` y `aria-controls`; se abre con Enter. Las citas aparecen al llegar la respuesta validada; el texto en curso usa el mismo formato que el final |
| React Bits · Shape Grid (JS + CSS desde el repositorio oficial) | `Componentes/Portada.jsx`, `Componentes/ShapeGrid.jsx` | Se carga aparte; el formulario acepta escritura de inmediato; capa `aria-hidden` sin eventos de puntero; 0 cuadros de animación después de la entrada y con la pestaña oculta; estática con movimiento reducido |
| Aceternity UI · File Upload (adaptado) + `react-dropzone` | `Componentes/CargaArchivo.jsx`, `Componentes/Materiales.jsx` | Arrastrar o elegir; nombre y tamaño; «Cambiar archivo»; rechazo de más de 10 MB; doble clic produce 1 petición; error del servidor visible y «Reintentar subida»; estado de indexación cuando la API lo informa |
| React Spring (`useSpring`, `animated.div`) | `Componentes/MedidorDominio.jsx` | Texto 67 % desde el inicio y barra que llega a 67 %; inmediata con movimiento reducido; se quitaron el contador y la transición CSS de la barra |

JavaScript inicial: **353,08 kB (105,37 kB gzip) antes → 283,15 kB (90,59 kB gzip) después**, gracias a la carga de páginas por ruta y a `LazyMotion`.

### Pruebas ejecutadas (2026-11-16, Node 22.23, MySQL 8.0.46)
Todas con **dobles** (Google Cloud en memoria y generador de prueba); ninguna con servicios reales.
- `backend: npm test` → **59 de 59**: las 28 anteriores, 7 del tutor y el cierre (`tutor.test.js`), 11 de RAG (`rag.test.js`: dos cursos y dos instituciones con plazos distintos y sinónimos, citas protegidas, versión usada visible para el docente, sin respaldo sin generador, falla de Google distinta, reimportación idempotente, retiro con limpieza fallida y reintento, PDF con y sin texto, DOCX, borrado de lección, permisos de carga), 6 de Drive (`drive.test.js`) y 7 de streaming y consumo (`stream.test.js`: SSE, cancelación, cuota concurrente 3 de 6, tope institucional 429, registro sin contenido).
- `backend: npm run lint`, `frontend: npm run lint` → sin errores.
- `frontend: npm test` → 10 de 10 (Vitest + jsdom: medidor 0,72 → 72 %, 0 → 0 %, null → n/a, movimiento reducido, límites; citas con 3, 1 y 0 fuentes, texto en curso y fuente retirada).
- `frontend: npm run build` → compila.
- Migraciones: base nueva → 35 tablas y **0 filas**; revertir las tres migraciones nuevas y volver a aplicarlas funciona.
- Navegador (Chrome headless, escritorio 1280 px y móvil 390 px, teclado y movimiento reducido), modo local, con un doble local del API de Anthropic con streaming: recorridos de las entregas 1, 2 y 3 y de las cuatro mejoras sin errores de consola (solo los 401 esperados antes de iniciar sesión).

### Comprobaciones pendientes con servicios reales
- **MySQL 8.4:** no se pudo descargar en el entorno (Docker Hub y repo.mysql.com bloqueados). Comprobación: `npm run db:migrate` y `npm test` contra 8.4.
- **Google Cloud (modo vertex):** con un proyecto de prueba en `europe-west4`: crear un corpus, importar un TXT, comprobar `fileStatus.state = ACTIVE`, recuperar con `retrieveContexts` filtrando por `ragFileIds`, confirmar que `sourceUri` coincide con `gs://…` y calibrar `RAG_VECTOR_DISTANCE_THRESHOLD`. Verificar que `roles/aiplatform.user` alcanza para `ragCorpora.*` y `ragFiles.*`.
- **Drive real:** compartir una carpeta con la cuenta de servicio, exportar un Google Doc y comprobar ADC con alcance `drive.readonly` (suplantación de cuenta de servicio).
- **Proveedor real:** streaming con una clave de Anthropic y el modelo vigente; uso real de tokens.
- **Interfaz con datos reales en modo vertex** (solo se probó en modo local).
- `npm audit` (backend, producción): 2 avisos moderados heredados de `sequelize` (`uuid`). Frontend: 0.
- No existe `CONTEXTO_CHAT_MENTOR_AI.md` en el ZIP recibido; el historial se contrastó con este archivo y con el código.
- React Bits Background Studio y el registro de Aceternity no fueron accesibles desde el entorno: los parámetros de Shape Grid se ajustaron a mano y File Upload se adaptó a partir de su estructura publicada.

## Checklist
- [x] Estructura React `Componentes / Pages / Rutas / App.jsx / main.jsx / index.html`
- [x] Backend Node/Express en capas
- [x] Conexión Sequelize a MySQL y migraciones de esquema
- [x] MySQL sin datos precargados ni usuarios demo
- [x] Provisionamiento seguro de primer administrador (`npm run admin:create`)
- [x] Auth + roles + aislamiento institucional
- [x] Cursos, módulos, temas, lecciones, matrículas y evaluaciones
- [x] Tutor IA real con errores explícitos sin configuración (ver "Sin verificar")
- [x] Progreso y recomendaciones con evidencia
- [x] Tests, lint, build, documentación
- [x] Aula: clases en vivo con asistencia, video en lecciones, materiales, anuncios, preguntas por lección, tareas con nota, inicio del estudiante
- [x] Tutor con fuentes: RAG Engine (Google Cloud) o búsqueda local, citas protegidas, Drive, streaming, cuota y consumo
- [x] Planificador de estudio (`study_plans`), repaso espaciado y preferencias de accesibilidad
- [ ] Borradores de preguntas generados por IA con aprobación docente
- [ ] Restablecimiento de contraseña, MFA, notificaciones por correo, entrega de tareas con archivo

## Decisiones (2026-11-10)
- **Correo único en toda la plataforma** (no por institución) para iniciar sesión sin elegir institución.
- **Cuentas por invitación:** quien administra crea la cuenta y recibe un enlace de un solo uso (72 h); la persona define su contraseña. No hay envío de correo todavía.
- **Sesión** con cookie httpOnly + token CSRF en cabecera `x-csrf-token`; se guarda solo el hash del token. Bloqueo de 15 min tras 5 intentos fallidos.
- **Contraseñas** con scrypt (módulo `crypto` de Node), sin dependencias extra.
- **Validación** con zod en `src/validators/schemas.js`.
- `topics` y `lessons` guardan `course_id` para validar el acceso por curso en cada consulta.
- **Evaluaciones:** las preguntas solo se editan en borrador; al publicar quedan bloqueadas. La clave se muestra al estudiante cuando agota sus intentos o la evaluación se cierra.
- **Dominio:** fórmula `baseline-1` de `docs/08` en `src/utils/mastery.js`; se recalcula dentro de la misma transacción del envío.
- **Tutor:** recuperación por coincidencia de palabras sobre lecciones publicadas (sin embeddings); el modelo debe responder JSON y las citas se validan contra las fuentes enviadas. Límite diario por usuario (`AI_DAILY_LIMIT_PER_USER`).
- El administrador de plataforma no accede a contenido académico.

## Aula de clases (2026-11-13)
Migración `20261113000100-create-classroom.js`: columna `lessons.video_url` y tablas `class_sessions`, `session_attendance`, `announcements`, `materials`, `lesson_comments`, `assignments`, `assignment_submissions`.

Endpoints nuevos (`src/routes/classroomRoutes.js`):
- Clases: `GET/POST /courses/:id/sessions`, `PATCH/DELETE /sessions/:id`, `POST /sessions/:id/join`, `GET /sessions/:id/attendance`.
- Anuncios: `GET/POST /courses/:id/announcements`, `DELETE /announcements/:id`.
- Materiales: `GET/POST /courses/:id/materials`, `POST /courses/:id/materials/upload`, `GET /materials/:id/download`, `DELETE /materials/:id`.
- Preguntas: `GET/POST /lessons/:id/comments`, `DELETE /comments/:id`.
- Tareas: `GET/POST /courses/:id/assignments`, `GET/PATCH/DELETE /assignments/:id`, `POST /assignments/:id/submission`, `PATCH /submissions/:id/grade`.
- Inicio del estudiante: `GET /me/home`.

Decisiones:
- La videollamada ocurre en Meet/Zoom/Teams; MENTOR guarda el enlace, lo entrega al pulsar "Entrar" (desde 15 min antes) y ahí registra la asistencia. El listado para estudiantes no incluye el enlace.
- Video de lección solo de YouTube o Vimeo; el backend calcula la dirección para incrustar (`src/utils/links.js`).
- Archivos en `backend/storage/uploads` (fuera de Git), nombre aleatorio, máximo 10 MB, tipos: pdf, docx, pptx, xlsx, png, jpg, txt. La descarga pasa por un endpoint que valida el acceso al curso.
- Todos los enlaces guardados deben ser `https://`.
- Una entrega se puede corregir hasta que el docente la califica.
- Al borrar una lección se borran los registros de sus materiales, pero el archivo queda en disco (pendiente de limpieza).

## Rediseño (2026-11-13)
- Sistema de color con un papel por color: azul para estructura, naranja solo para la acción principal, lima para avance y completado, tinta oscura para texto y bloques destacados.
- Tipografías instaladas con el proyecto (ya no dependen de internet): Bricolage Grotesque en títulos y Figtree en texto (`@fontsource-variable/*`, importadas en `src/main.jsx`).
- Inicio del estudiante: la próxima clase es el bloque principal, con cuenta regresiva y botón para entrar.
- Curso del estudiante: las lecciones se muestran como una ruta numerada que se llena con el avance (`Componentes/RutaLecciones.jsx`).
- Páginas del docente: los formularios de creación se abren bajo un botón (`Componentes/Desplegable.jsx`) y se muestran solos cuando la lista está vacía; primero se ve el contenido.
- Menos tarjetas idénticas y menos animaciones automáticas; se conservan las que responden a una acción.

## Estilo y animaciones (2026-11-10)
- Rediseño visual: navegación superior, azul intenso con botones naranja tipo píldora, tarjetas redondeadas y banners; tipografía Poppins desde Google Fonts (con fuente del sistema como respaldo).
- Animaciones sin librerías: `src/hooks/useMovimiento.js` y `src/Componentes/Animaciones.jsx` (aparición al hacer scroll, contadores, anillo de puntaje, tarjetas que se inclinan con el cursor) y `Portada.jsx` (fichas flotantes que siguen al cursor).
- Todas se desactivan con `prefers-reduced-motion`.
- Se usó como referencia de estilo un sitio externo; no se copiaron su marca, imágenes ni textos.

## Archivos principales
- Migraciones: `backend/database/migrations/2026111000010x..0400`.
- Modelos: `backend/src/models/*` (asociaciones en `index.js`).
- Servicios: `auth`, `user`, `institution`, `access`, `course`, `content`, `assessment`, `mastery`, `analytics`, `tutor`, `aiProvider`, `audit`.
- Rutas: `authRoutes`, `adminRoutes`, `courseRoutes`, `learningRoutes`.
- Frontend: 23 páginas en `src/Pages`, componentes en `src/Componentes`, sesión en `src/context`, hooks en `src/hooks`.

## Pruebas ejecutadas (2026-11-13)
- `backend: npm test` → 28 de 28 (las 20 anteriores + 8 del aula: video, clases y asistencia, anuncios, subida y descarga de archivos, comentarios, tareas y notas, inicio del estudiante, aislamiento).
- Lint de backend y frontend sin errores; el frontend compila.
- Recorrido del aula en navegador con docente y estudiante sin errores de consola.
- Sin verificar: reproducción real del video (el entorno de prueba no tiene internet) y apertura de una reunión real de Meet/Zoom.

## Pruebas ejecutadas (2026-11-10, MySQL 8.0.46, Node 22)
- `backend: npm run db:migrate` sobre base vacía → 21 tablas, 0 filas de contenido.
- `backend: npm test` → 20 de 20 pruebas pasan (5 unitarias de dominio, 15 de integración: sesión, CSRF, invitaciones, permisos, aislamiento entre instituciones, clave oculta, corrección, idempotencia, intentos, analítica, tutor sin configurar, citas, auditoría, bloqueo).
- `backend: npm run lint` y `frontend: npm run lint` → sin errores.
- `frontend: npm run build` → compila.
- Recorrido completo en navegador (plataforma → institución → docente → estudiante → analítica) sin errores de consola.

## Sin verificar
- **Llamada real al proveedor de IA:** no se probó con una clave real. Se probó el error `AI_NOT_CONFIGURED`, la selección de fuentes y la validación de citas con la llamada externa sustituida dentro de la prueba.
- Ocultamiento de la contraseña al escribirla en `admin:create` en una terminal de Windows.
- MySQL 8.4 (se probó en 8.0).
- `npm audit` reporta 2 avisos moderados heredados de `sequelize` (dependencia `uuid`).

## Próximo paso
1. Ejecutar las comprobaciones pendientes con servicios reales (arriba).
2. Borradores de preguntas con IA revisados por el docente (Fase 4).
3. Política de retención y borrado de conversaciones; OCR para PDF escaneados; restablecimiento de contraseña y envío de invitaciones por correo.
