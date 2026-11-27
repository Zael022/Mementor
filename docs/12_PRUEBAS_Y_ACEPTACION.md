# Calidad, pruebas y aceptación (sin datos precargados)

## Tipos de pruebas
- Unitarias: validación, calificaciones deterministas, estimación de dominio, prerrequisitos, políticas de permiso.
- Integración: rutas Express, autenticación, Sequelize/MySQL, transacciones, idempotencia y errores estandarizados.
- Multiinstitución: pruebas de aislamiento entre tenants, cursos, mensajes, notas y materiales.
- IA: falta de configuración produce `AI_NOT_CONFIGURED` sin respuesta falsa; con un proveedor configurado, fuentes reales y acceso autorizado; no filtrar material ajeno; resistir instrucciones maliciosas de documentos.
- Frontend: rutas `Componentes/Pages/Rutas/App/main/index.html`, accesibilidad, carga, vacíos, error, responsive.

**Prohibido:** seeds de contenido en desarrollo, cuentas demo fuera del modo de prueba (`DEMO_MODE`, ADR 0011), métricas prefabricadas, JSON Server, datos académicos hardcodeados. Las pruebas automatizadas pueden crear y borrar datos transitorios en una base MySQL separada, jamás en la BD real.

## Lista de aceptación
- [ ] `frontend/index.html` inicia `src/main.jsx`, que renderiza `App.jsx` y `Rutas/Rutas.jsx`.
- [ ] Las carpetas `Componentes`, `Pages`, `Rutas` tienen exactamente esas mayúsculas.
- [ ] `backend/config/db.json` no contiene contraseñas ni datos de usuarios.
- [ ] Modelos y migraciones **Sequelize** conectan con MySQL real.
- [ ] Después de migraciones, no hay usuarios, instituciones ni cursos creados automáticamente.
- [ ] Primer administrador se provisiona mediante un flujo seguro, nunca credenciales fijas.
- [ ] Docente autorizado crea curso/módulo/lección/cuestionario desde la interfaz real.
- [ ] Estudiante matriculado completa evaluación, recibe resultado correcto y dominio calculado.
- [ ] Otro estudiante/institución no ve registros ajenos.
- [ ] Al no existir cursos, la UI muestra un estado vacío, nunca tarjetas falsas.
- [ ] Al no configurar IA, el tutor informa la limitación en lugar de inventar respuestas.
- [ ] Comentarios cortos, generales y en español; sin comentarios línea a línea.
- [ ] Lint, tests y build ejecutados, informando sus resultados auténticos.

## Demostración manual
La institución, sus usuarios, cursos, lecciones y preguntas se **crean usando la interfaz** en un entorno recién migrado. No se distribuye ningún conjunto de datos demo.
