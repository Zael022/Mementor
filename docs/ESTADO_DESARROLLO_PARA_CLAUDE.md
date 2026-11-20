# Estado de desarrollo — mantener actualizado

**Última actualización** — 2026-11-20. Requisitos del Proyecto Final FWD: bcrypt y JWT, gobernanza (Ley 8968) y rol auditor, 8 agentes de IA, APIs externas y n8n, catálogo de roles, configuración de despliegue, nueva identidad visual y documentos entregables.

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
| Nuevo logotipo (burbuja azul con «m» de dos arcos y chispa lima), favicon y set de íconos propios (PR #8) | `Logo.jsx`, `Iconos.jsx`, `public/` | Vitest y Playwright |
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
