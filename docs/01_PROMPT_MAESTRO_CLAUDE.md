# PROMPT MAESTRO PARA CLAUDE — MENTOR AI (STACK Y ESTRUCTURA OBLIGATORIOS)

Actúa como desarrollador senior full-stack, arquitecto de datos, ingeniero de IA, diseñador UX/UI y QA. **Tu trabajo es implementar MENTOR AI, no solamente describirlo**. Revisa todos los documentos del paquete, el estado del repositorio y la plantilla opcional `PLANTILLA_INICIAL/` antes de crear archivos.

## Visión del producto
MENTOR AI es un LMS adaptativo para instituciones, docentes y estudiantes. Administra cursos, lecciones, tareas, cuestionarios y progreso; un tutor de IA consulta material publicado del curso para dar explicaciones con fuentes, y el motor adaptativo recomienda práctica según resultados objetivos. Profesores revisan borradores generados y supervisan decisiones académicas; el sistema **no** cambia calificaciones oficiales por decisión del LLM.

## REGLAS OBLIGATORIAS — NO NEGOCIABLES
1. **Stack:** frontend React + Vite **en JavaScript/JSX**, backend Node.js + Express **en JavaScript**, MySQL 8+ como almacenamiento persistente, **Sequelize ORM** para modelos, asociaciones y migraciones. API REST con JSON. No cambiar a MongoDB, Firebase, PostgreSQL, Prisma o archivos JSON como base de datos.
2. **Carpetas de frontend con nombres EXACTOS** (importaciones respetan mayúsculas/minúsculas):
   - `frontend/src/Componentes/`: elementos reutilizables, formularios, barra lateral, cards.
   - `frontend/src/Pages/`: páginas completas según rol, página de inicio, cursos, login, tutor, progreso, evaluación.
   - `frontend/src/Rutas/`: React Router, rutas públicas/privadas y control visual por rol.
   - `frontend/src/App.jsx`: composición general de aplicación.
   - `frontend/src/main.jsx`: entrada de React con `createRoot`.
   - `frontend/index.html`: HTML raíz de Vite **ubicado en frontend, NO dentro de src/**.
   - Flujo de arranque: `index.html → src/main.jsx → src/App.jsx → src/Rutas/Rutas.jsx → Pages → Componentes`.
3. **Backend:** `backend/src/{config,models,controllers,services,routes,middlewares,validators}` con Express. Sequelize en `backend/src/config/database.js`, migraciones versionadas en `backend/database/migrations/` y configuración sin secretos en `backend/config/db.json` (solo nombres de variables/valores no sensibles). Mantener las credenciales reales exclusivamente en `.env` local ignorado por Git; incluir `.env.example` sin valores privados.
4. **SIN CONTENIDO FICTICIO:** la única excepción son las cuentas de prueba por rol del modo de prueba (`DEMO_MODE=on`, ADR 0011), que no entran con el modo apagado. Fuera de eso, no crear seeders, fixtures entregados, cursos precargados, registros simulados, `db.json` usado como JSON Server ni pantallas con métricas hardcodeadas. La base MySQL queda **vacía después de migrar**, con esquema listo. Todos los datos académicos se crean desde formularios y endpoints reales, según permisos. Muestra `EmptyState` y textos como "No hay cursos todavía" cuando no existan registros.
5. **IA REAL Y CONFIGURABLE:** el backend consume una API de IA configurada por `.env`; no incrustar claves ni fingir respuestas. Si falta proveedor/clave, indicar `AI_NOT_CONFIGURED` o `AI_UNAVAILABLE`, mostrar mensaje útil y mantener el resto de la plataforma operativa. No insertar respuestas falsas. El tutor debe respetar matrícula, curso, publicación de material, límites y trazabilidad.
6. **Buenas prácticas:** componentes pequeños, separación controller/service/model, validación de entrada, RBAC backend, aislamiento institucional en cada consulta, manejo centralizado de errores, `async/await`, transacciones Sequelize para evaluaciones, paginación, logs sin datos sensibles, manejo de estados vacío/carga/error y accesibilidad.
7. **Comentarios cortos y generales, en español**, únicamente para aclarar qué hace cada bloque o módulo. Ejemplos: `// Maneja las rutas de los cursos.`; `// Valida los datos antes de guardarlos.`; `// Muestra el contenido principal.`; `// Configura la conexión con MySQL.`. No comentar cada línea, no redactar explicaciones largas, no llenar el código de comentarios vacíos o redundantes; priorizar nombres claros.
8. **Pruebas automáticas sí** (unitarias/integración) pero nunca precargar datos en desarrollo o producción. Para pruebas de integración usar una BD de testing separada con datos temporales creados y borrados dentro de la prueba; no distribuir datasets ficticios ni cuentas de demostración.
9. **Seguridad:** contraseñas hasheadas, sesiones seguras, protección de rutas por recurso, validación de entradas, CORS y rate limit, control de costos de IA, protección ante prompt injection y auditoría. Claves correctas de preguntas nunca se envían antes de tiempo.
10. Si aparece contradicción en documentos heredados, **esta versión de prompt y `15_REGLAS_ESTRUCTURA_Y_SIN_DATOS.md` prevalecen**.

## Requisitos funcionales
Roles: admin de plataforma (restringido), admin de institución, docente, estudiante. Los usuarios autorizados pueden gestionar instituciones y usuarios; docentes crear cursos, módulos, temas, lecciones y evaluaciones; alumnos matriculados estudiar y responder; tutor IA fundamentado en material publicado; progreso y dominio por tema calculados con evidencia; panel docente con analítica real; plan de estudios personalizado; auditoría. El primer administrador se crea a través de un flujo seguro de instalación inicial mediante credencial proporcionada por el operador, **no** mediante cuenta fija ni seed.

## Estructura exacta requerida
Consulta `15_REGLAS_ESTRUCTURA_Y_SIN_DATOS.md`, `ejemplos/ESTRUCTURA_REPOSITORIO.txt` y `PLANTILLA_INICIAL/`. No renombres `Componentes`, `Pages`, `Rutas`, `App.jsx`, `main.jsx` o `index.html`. Puedes añadir subcarpetas sin mover esos puntos de entrada.

## Instrucciones de ejecución
1. Lee los documentos 02–15 y la plantilla. Comprueba las herramientas y el repositorio real.
2. Explica en 6–10 puntos tu plan. Luego **crea y modifica código real**; no te detengas en el plan.
3. Conserva la estructura y valida que `npm install`, `npm run dev`, `npm run build`, `npm run lint` y las migraciones Sequelize funcionen, según scripts implementados.
4. Primera entrega prioritaria: conectividad con MySQL; migraciones vacías de datos; creación inicial segura de admin; registro/invitaciones según política; login/logout; roles; CRUD cursos/módulos/temas/lecciones; matrícula; cuestionario con corrección y progreso; páginas React con rutas y estados reales. Implementa por historias verticales completas.
5. Fase IA: proveedor real elegido de manera configurable, recuperación de materiales publicados autorizados, tutor con citas, recomendaciones explicables y borradores revisados por docente. No simular inteligencia artificial ni números académicos.
6. Si hay límites del entorno, entrega lo implementado y probado e informa los bloqueadores. No declares pruebas exitosas sin ejecutarlas.
7. Actualiza `ESTADO_DESARROLLO_PARA_CLAUDE.md` con los archivos modificados, comandos y próximos pasos.

## Primera historia funcional SIN DATOS PRECARGADOS
Tras instalar dependencias y migrar una MySQL vacía, un operador configura al primer administrador **de forma segura**. Ese administrador crea una institución y asigna un docente; el docente **crea desde la interfaz** un curso, módulo, tema, lección y cuestionario; el estudiante es matriculado y resuelve una evaluación; el backend actualiza puntuación y dominio con evidencia; el tutor IA usa el material autorizado si hay proveedor configurado, de lo contrario informa falta de configuración sin inventar respuesta; el docente ve estadísticas reales.

**Empieza a implementar ahora. Mantén el código legible, sin datos precargados y con comentarios breves.**
