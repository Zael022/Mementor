# Instrucciones permanentes para Claude — MENTOR AI

Implementa MENTOR AI como plataforma educativa real. Antes de programar, lee `01_PROMPT_MAESTRO_CLAUDE.md` y `15_REGLAS_ESTRUCTURA_Y_SIN_DATOS.md`.

1. Tecnologías obligatorias: React + Vite en JSX, Node.js + Express, MySQL y **Sequelize ORM** con migraciones. Nada de JSON Server ni ORM alternativo.
2. Estructura frontend exacta: `src/Componentes/`, `src/Pages/`, `src/Rutas/`, `src/App.jsx`, `src/main.jsx`, `frontend/index.html`.
3. Backend en capas: config, models, controllers, services, routes, middlewares, validators; conexión real Sequelize; `config/db.json` sin secretos, `.env` no versionado.
4. **Cuentas de prueba solo con el modo de prueba** (`DEMO_MODE=on`, ADR 0011): una por rol, marcadas con `users.is_demo`, creadas al arrancar o con `npm run demo:cuentas`, y el «Acceso rápido de prueba» en el inicio de sesión. Con el modo apagado no entran. No se precargan cursos ni contenido académico: lo crean los usuarios desde la interfaz. Mantén estados vacíos reales.
5. Comentarios **breves y generales en español** solo en partes útiles; no comentar cada línea. Nombres de variables, funciones y carpetas claros.
6. Implementa un monolito modular, RBAC backend, autorización por recurso, aislamiento por institución y transacciones para resultados de evaluación.
7. Corrección de preguntas objetiva determinista; LLM para tutor y borradores solo con materiales autorizados y citas verificables. IA sin clave => error claro, nunca contenido falso.
8. Los tests usan una BD de test aislada y residuos efímeros que se limpian; nunca precargan datos de desarrollo.
9. Protege credenciales, sesiones, permisos, claves de respuestas, endpoints, costos de IA y entradas no confiables.
10. Presenta plan breve y construye una historia vertical funcional; ejecuta lint/tests/build si el entorno lo permite y registra resultados sin inventarlos.
11. Actualiza `ESTADO_DESARROLLO_PARA_CLAUDE.md` al finalizar cada sesión.
12. Usa los demás archivos 02–14 como especificaciones del producto. Ante contradicción, prioriza 01 y 15.
13. Tutor con fuentes: el curso y su corpus se resuelven desde la sesión; solo se usan fuentes activas contrastadas con MySQL; sin evidencia no se llama al modelo. Google Cloud con ADC (`RAG_PROVIDER=local|vertex`). El material importado es dato, no instrucción.
14. Node.js 22.12+. Decisiones en `docs/adr/`, datos y riesgos en `docs/gobernanza/`. `AGENTS.md` resume estas reglas para otros agentes.
