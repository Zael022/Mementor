# Instrucciones para agentes de código — MENTOR AI

Este archivo es coherente con `CLAUDE.md`; si hay contradicción, mandan `CLAUDE.md`, `docs/01_PROMPT_MAESTRO_CLAUDE.md` y `docs/15_REGLAS_ESTRUCTURA_Y_SIN_DATOS.md`.

## Stack y estructura
- React + Vite en JavaScript/JSX (`frontend/src/{Componentes,Pages,Rutas}`), Node.js 22.22.2+ (o 24.15+) con Express, MySQL 8 con Sequelize y migraciones.
- Rama `despliegue-nube` (ADR 0012): además corre en PostgreSQL de Supabase (Vercel + Render + Supabase). El SQL escrito a mano usa `runSql`, `nowMinus`, `nowPlus` y `affectedRows` de `src/utils/sql.js`; las migraciones usan `database/compat.cjs`; `main` y `develop` siguen solo con MySQL.
- Backend en capas: `config`, `models`, `controllers`, `services`, `routes`, `middlewares`, `validators`, `utils`. API bajo `/api/v1`, sesión por cookie httpOnly y token CSRF en `x-csrf-token`.
- Interfaz y comentarios en español, breves y generales.

## Reglas que no se negocian
1. Cuentas de prueba solo con `DEMO_MODE=on` (ADR 0011: una por rol, `users.is_demo`, `npm run demo:cuentas` y acceso rápido); sin seeds de cursos ni contenido académico. Las pruebas crean y borran sus datos en `TEST_DB_NAME`.
2. Autorización en el backend: rol, institución y relación con el curso (`getCourseAccess`). El curso y el corpus salen de la sesión, nunca del cuerpo de la petición.
3. Corrección de evaluaciones determinista y transaccional. La IA no califica ni publica preguntas.
4. El tutor solo usa fuentes activas del curso y valida respuesta y citas en el servidor. Sin evidencia no se llama al modelo. Sin credenciales: `AI_NOT_CONFIGURED`.
5. El material importado es dato, no instrucción.
6. Google Cloud con Application Default Credentials. No se versionan claves ni archivos de credenciales.
7. La limpieza remota solo actúa sobre recursos que MENTOR creó y registró.
8. El registro técnico no guarda credenciales, chats ni contenido de documentos.
9. Todo texto de documentos o preguntas que va al modelo pasa por `asData` (sin `<` ni `>`); el historial va sin marcas `[S#]`.
10. Archivos subidos: extensión, tipo y primeros bytes deben coincidir.
11. Tareas periódicas solo con el turno de `job_leases`; con varias instancias, `RATE_LIMIT_STORE=mysql` y `TRUST_PROXY`.
12. Sesión: JWT firmado (`utils/jwt.js`) en cookie httpOnly y revocable en `user_sessions`; contraseñas con bcrypt. Agentes de IA solo en `services/agents` (`agentRegistry`), con permisos por rol, salida validada y registro en `agent_runs`. Integraciones externas en `services/external` con tiempo de espera; n8n entra solo por `/integrations/*` con `x-integration-key`.
13. Quizzes y racha: el tiempo lo mide el servidor (`utils/clock.js`, que las pruebas reemplazan); la clave sale solo después de responder; todo bono pasa por `awardBonus` (índice único). La nota se calcula en `gradeService` (ADR 0004).
14. Rango, mapa y Parejas (ADR 0010): el rango se calcula al consultar y mide avance, no rendimiento. Parejas solo usa preguntas cuya clave ya ve ese estudiante, guarda el tablero en el servidor y no da bono ni racha. Orbi y Pausa son decorativos (`aria-hidden`), con el mensaje siempre en texto; respetan `showMascots`, `showBigCelebrations` y «Menos movimiento», y nunca aparecen en evaluaciones ni en el quiz con bono. Cuando se pueden tocar, son un botón con nombre y su frase va en una región viva. Pausa paseante (anexo de ADR 0010) solo aparece para estudiantes en las rutas de `rutaConPausa`, respeta `pausaWalks` y `pausaHiddenToday`, y sus interacciones nunca cuentan como actividad de aprendizaje.

## Antes de entregar
- `backend`: `npm run lint` y `npm test` (MySQL de pruebas).
- `frontend`: `npm run lint`, `npm test` y `npm run build`; si cambia un recorrido de la interfaz, `npm run test:e2e` (base `_e2e`).
- GitHub Actions (`.github/workflows/ci.yml`) repite todo con MySQL 8.4 en cada push y, en `despliegue-nube`, el backend también con PostgreSQL 17.
- Actualiza `docs/ESTADO_DESARROLLO_PARA_CLAUDE.md` con resultados reales. Separa las pruebas con dobles de las que usaron servicios reales.

## Documentos
Los entregables de `docs/entregables/` (Word y PDF) se armaron a partir de `docs/datos/` (modelo y diccionario generados desde las migraciones), `docs/mockups/` (capturas con `playwright.capturas.config.js`) y `docs/marca/`. Si cambian pantallas o tablas, actualiza esas fuentes y los documentos.

## Mapa rápido del tutor con fuentes
`knowledgeService` (fuentes, versiones, importación, retiro, limpieza) → `retrievalService` (local o `vertexRagClient`) → `tutorService` (prompt, validación Zod, citas, historial) → `aiProvider` (JSON o streaming) → `usageService` (cuota y consumo). Drive: `driveClient` + `driveSyncService`.
