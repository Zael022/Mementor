# Asignación de seguridad: inyección SQL, XSS, CSRF y CORS

Mini proyecto: **MENTOR AI**. Fecha: 23 de noviembre de 2026. Rama: `feature/seguridad-web`.

| Paso | Dónde está |
| --- | --- |
| 1. Seguridad aplicada (SQL, XSS, CSRF) | Tabla de abajo y pruebas en `backend/tests/webSecurity.test.js`, `frontend/tests/Markdown.test.jsx` y `frontend/e2e/seguridad.spec.js` |
| 2. CORS verificado | `backend/src/config/cors.js`, pruebas de CORS y `evidencias/csrf-cors.txt` |
| 3. Investigación sobre inyección SQL | `investigacion-inyeccion-sql.md` |
| 4. Simulación del ataque | `backend/laboratorio/inyeccion-sql/` y `evidencias/` (capturas y video) |
| 5. Presentación | `Presentacion_Seguridad_MENTOR_AI.pptx` |

## Paso 1. Medidas aplicadas

**Inyección SQL**
- Todo acceso a datos usa Sequelize: los valores viajan como parámetros, separados del SQL.
- Las 21 llamadas con SQL escrito a mano usan `replacements` con nombre. La única que unía un fragmento de texto se reescribió con parámetros (`consentSummary`).
- La búsqueda nueva de **Usuarios** (`GET /api/v1/users?q=`) escapa `%` y `_`, para que se busquen como texto y no como comodines.
- Zod valida formato, tipo y longitud en cada ruta antes de llegar a la base. Por ejemplo, un correo con comillas no pasa.
- Las contraseñas se comparan con bcrypt, nunca dentro del SQL.
- Los errores de la base nunca llegan al navegador: el cliente recibe un mensaje genérico y el detalle queda en el registro del servidor.

**XSS**
- React escribe todo como texto. El componente `Markdown` arma elementos de React y nunca usa `innerHTML`; en todo el frontend no hay `dangerouslySetInnerHTML`.
- **Content Security Policy** en producción (`frontend/vercel.json`):
  - `script-src 'self'` impide ejecutar scripts en línea o de otros dominios;
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` y `frame-ancestors 'none'`;
  - los iframes solo pueden venir de YouTube (sin cookies) y Vimeo.
- La CSP vive en un solo lugar: `vite preview` usa la misma para probar la compilación (`frontend/scripts/verificar-csp.mjs`).
- La API envía Helmet: CSP propia, `nosniff`, sin `x-powered-by`, y responde solo JSON.
- Los enlaces de video pasan por una lista permitida de dominios (`utils/links.js`).

**CSRF**
- Token anti-CSRF aleatorio por sesión. Toda petición que cambia datos (POST, PUT, PATCH, DELETE) debe traerlo en `x-csrf-token` y se compara en tiempo constante.
- La cookie de sesión es `HttpOnly`, `SameSite=Lax` y, en producción, `Secure`.
- Se verifica el encabezado `Origin` y ningún cambio de estado usa GET.

## Paso 2. CORS
- **Solo orígenes de la lista.** `FRONTEND_ORIGIN` admite varios separados por coma y nunca usa el comodín `*`, que tampoco está permitido con cookies.
- **Métodos limitados:** `GET, POST, PUT, PATCH, DELETE`. TRACE, CONNECT y similares no se aceptan.
- **Encabezados limitados:** `Content-Type, Accept, X-CSRF-Token`.
- **Origen no autorizado = 403 `ORIGIN_NOT_ALLOWED`.** Antes solo se omitían los encabezados de permiso; ahora la petición se rechaza explícitamente, también en el *preflight*.
- **Peticiones sin `Origin`** (servidor a servidor, como n8n) siguen exigiendo sesión, CSRF o clave de integración, según la ruta.
- **En producción** el navegador habla solo con Vercel, que reenvía `/api` a Render: la cookie es del mismo origen.

## Paso 4. Laboratorio de la simulación
```powershell
cd backend
# Una sola vez, con un usuario administrador de MySQL:
#   CREATE DATABASE mentor_ai_lab CHARACTER SET utf8mb4;
#   GRANT ALL PRIVILEGES ON mentor_ai_lab.* TO 'tu_usuario'@'localhost';
npm run lab:sqli            # abre http://127.0.0.1:3199 (Ctrl+C borra los datos)
node laboratorio/inyeccion-sql/capturar.mjs   # en otra terminal: capturas y video en docs/seguridad/evidencias
```

**Protecciones del laboratorio**
- Se niega a arrancar con `NODE_ENV=production`.
- Solo usa una base cuyo nombre termina en `_lab`.
- Escucha solo en `127.0.0.1`.
- Crea dos colegios de prueba al iniciar y los borra al cerrar.
- `npm start` y Render nunca lo cargan.

La versión vulnerable existe **solo** en `laboratorio/inyeccion-sql/servidor.js`; la protegida es el servicio real de MENTOR AI (`userService.listUsers`).

| Ataque | Versión vulnerable | MENTOR AI |
| --- | --- | --- |
| `' OR 1=1 -- ` | 6 filas: también el otro colegio | 0 filas |
| `' UNION SELECT email, password_hash FROM users -- ` | Correos y hashes de contraseñas de toda la tabla | 0 filas |
| `'` (una comilla) | Error de sintaxis de MySQL visible | 0 filas |
| `' OR '1'='1' -- ` en el inicio de sesión | — | 422: «Correo no válido» |
| Mismo ataque en la pantalla Usuarios | — | «Sin resultados» |
| Anuncio con `<script>` e `<img onerror>` | — | Se muestra como texto; no se ejecuta |

## Evidencias
- `evidencias/01-busqueda-normal.png` … `05-login-rechazado.png`: el laboratorio, paso a paso.
- `evidencias/06-mentor-busqueda-inyeccion.png` y `07-mentor-anuncio-xss.png`: la interfaz real de MENTOR AI.
- `evidencias/demostracion-inyeccion-sql.mp4`: video corto de toda la demostración.
- `evidencias/csrf-cors.txt`: peticiones reales sin token, con token desde otro origen y *preflight*.
- `evidencias/csp.txt`: la compilación con la CSP bloquea un script inyectado.

## Pruebas automáticas
- `backend/tests/webSecurity.test.js`: 7 pruebas (inyección SQL en el inicio de sesión y en la búsqueda, XSS en la API, CSRF y CORS).
- `frontend/tests/Markdown.test.jsx`: el contenido con etiquetas no crea elementos HTML.
- `frontend/e2e/seguridad.spec.js`: la búsqueda y un anuncio malicioso, probados en el navegador. Con `EVIDENCIAS=1` guarda las capturas.
