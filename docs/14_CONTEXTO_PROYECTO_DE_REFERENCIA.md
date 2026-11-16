# Contexto del proyecto previo compartido (mini-proyecto-1)

El usuario compartió un ZIP anterior de un **sistema comercial de inventario/tienda**. Fue inspeccionada su estructura de archivos para identificar patrones técnicos aprovechables; **NO** se ha incluido el ZIP viejo ni sus archivos `.env` en este paquete.

## Hallazgos observados del proyecto de referencia
- `backend/package.json`: Node >=20.19, Express 5, mysql2, bcryptjs, helmet, cors, cookie-parser, express-rate-limit, nodemailer, pruebas con `node --test` y supertest; hay migraciones SQL heredadas y scripts de migración propios del proyecto de referencia.
- Backend organizado con `src/app.js`, `server.js`, `config/`, `controllers/`, `models/`, `routes/`, `middleware/`, `servicios/`, `tests/`.
- Seguridad por sesión, permisos, CSRF, validaciones y auditoría. `src/config/permisos.js` contiene una matriz explícita de endpoints.
- `frontend/package.json`: React 19, Vite, `react-router`, lucide-react, Recharts, react-hot-toast; frontend con components, contexts y rutas.
- `frontend/src/App.jsx`: router, proveedor de autenticación, toasts y configuración de movimiento reducido.
- El dominio existente es inventarios, proveedores, ventas, etc., **no académico**.

## Qué sí puede inspirar MENTOR AI
Separación de capas, rutas Express, patrones de acceso a MySQL (adaptar ahora a Sequelize), migraciones Sequelize, middleware de auth/permisos, tests, utilidades de API frontend, context de autenticación, componentes reutilizables de dashboard y formularios.

## Qué no se debe copiar
Tablas de productos/ventas/proveedores; nombres o identidad visual de la tienda; usuarios del sistema anterior; `.env` reales ni respaldos SMTP; archivos Git; `node_modules`, secretos, datos privados ni dependencias enormes empaquetadas. No asumir que el esquema comercial aplica a `courses`, `topics`, `assessments`.

## Cómo proceder si se entrega el ZIP previo a Claude
Inspeccionarlo solo como **referencia de patrones**. Excluir `.git`, `node_modules`, `.env*` con valores, respaldos y datos personales al compartir. El código de MENTOR AI debe vivir en repositorio nuevo. Si el usuario indica reutilización del código, proponer cambios selectivos y pedir revisión antes de operaciones destructivas.
