# Guía de despliegue de MENTOR IA (rama `despliegue-nube`)

Esta rama se abre **en tu computadora** igual que `main` (MySQL) y además se publica con **Vercel + Render + Supabase**. Las decisiones están en `docs/adr/0012-despliegue-vercel-render-supabase.md`.

| Componente | Proveedor | URL |
| --- | --- | --- |
| Frontend (React + Vite) | Vercel, plan Hobby | `https://mentor-ai.vercel.app` (ajustar al nombre real) |
| API (Node + Express) | Render, web service gratuito | `https://mentor-api.onrender.com/api/v1` |
| Base de datos | Supabase (PostgreSQL) por el *Session pooler* | `aws-0-<región>.pooler.supabase.com:5432` |
| Archivos originales | Supabase Storage, bucket **privado** | Solo la API lo usa |
| Workflows | n8n Cloud o n8n propio en Render | `https://<tu-espacio>.app.n8n.cloud` |
| IA | Anthropic (Claude) | API del proveedor |

El navegador solo habla con Vercel. Vercel reenvía `/api/*` a Render, así que la cookie de sesión es del mismo origen y no hace falta abrir CORS. El navegador **nunca** habla con Supabase: la clave secreta de Supabase vive solo en Render.

## 0. Abrirlo en tu computadora
Igual que siempre, con MySQL:
1. `cd backend && npm install`, copia `.env.example` a `.env` y deja `DB_DIALECT=mysql` con tus datos de MySQL.
2. `npm run db:migrate` y `npm run dev`. En otra terminal: `cd frontend && npm install && npm run dev`.
3. Abre `http://localhost:5173`.

Opcional: para probar en tu computadora contra el mismo Supabase de la nube, pon en `backend/.env` `DB_DIALECT=postgres`, `DATABASE_URL=…`, `DB_SSL=true` y `DB_SSL_CA=` con la ruta del certificado (paso 1.4). Hazlo con un proyecto de prueba, no con el de producción.

## 1. Supabase (base de datos y archivos)
1. Crea una cuenta en supabase.com y un proyecto nuevo en la región más cercana a Render (por ejemplo *East US*). Guarda la contraseña de la base en un lugar seguro.
2. **Apaga la Data API.** En *Project Settings → Data API* desactívala. Si al crear el proyecto aparece la opción de no exponer las tablas automáticamente, desmárcala. MENTOR no usa la Data API: solo la API de Render entra a la base. Además, la migración `20261127000200-proteger-esquema-supabase` activa RLS y quita los permisos de `anon`, `authenticated` y `service_role`.
3. **Cadena de conexión.** Pulsa *Connect* y elige **Session pooler**. Es IPv4 y usa el puerto 5432. No uses *Direct connection*, porque es solo IPv6 y Render no llega a ella. La cadena tiene esta forma: `postgresql://postgres.<proyecto>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres`.
4. **Certificado.** En *Database Settings → SSL Configuration* descarga el certificado raíz y ábrelo con un editor de texto. Su contenido completo va en `DB_SSL_CA_PEM` (paso 2). La API siempre verifica el certificado: si falta, la conexión falla con «self-signed certificate in certificate chain».
5. **Bucket de archivos.** En *Storage → New bucket* crea `mentor-originales` y **déjalo privado**: no marques *Public bucket*. Los materiales y las fotos de perfil se guardan ahí. La base guarda la huella SHA-256 de cada material para comprobar que la descarga es idéntica al original.
6. **Clave secreta.** En *Project Settings → API Keys* crea o copia una **Secret key** (`sb_secret_…`). La antigua `service_role` también sirve. Va solo en Render (`SUPABASE_SECRET_KEY`), **nunca** en Vercel, en el frontend ni en el repositorio.
7. Copia la *Project URL* (`https://<proyecto>.supabase.co`) para `SUPABASE_URL`.

## 2. API en Render
1. En Render: *New → Blueprint* y elige el repositorio. Render lee `render.yaml` y crea `mentor-api` en la rama **`despliegue-nube`**.
2. Completa las variables marcadas `sync: false`. `JWT_SECRET` y `N8N_INTEGRATION_KEY` las genera Render.
   - `DATABASE_URL`: la cadena del *Session pooler*, con tu contraseña.
   - `DB_SSL_CA_PEM`: el contenido completo del certificado del paso 1.4, incluidas las líneas `-----BEGIN CERTIFICATE-----` y `-----END CERTIFICATE-----`. `render.yaml` ya pone `DB_DIALECT=postgres`, `DB_SSL=true` y `DB_POOL_MAX=5`.
   - `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. `render.yaml` ya pone `STORAGE_DRIVER=supabase` y `SUPABASE_BUCKET=mentor-originales`.
   - `FRONTEND_ORIGIN=https://mentor-ai.vercel.app` y `APP_URL` con el mismo valor.
   - `AI_PROVIDER=anthropic`, `AI_MODEL`, `AI_API_KEY` y, si quieres, `AI_MODEL_RAPIDO` y `AI_MODEL_AVANZADO` (ver `docs/adr/0009-capas-ia.md`).
   - `SMTP_*` para recuperación de contraseña, recordatorios y avisos de baja.
3. Al arrancar se ejecuta `npm run db:migrate`, que crea las tablas en Supabase, y luego `npm start`. Comprueba en `https://mentor-api.onrender.com/api/v1/health` que salga `database: "connected"` y `files: { driver: "supabase", configured: true }`.
   - En el plan gratuito no existe el paso previo al despliegue (`preDeployCommand` es de los planes de pago), por eso la migración va en el arranque. En un plan de pago, muévela a `preDeployCommand: npm run db:migrate` y deja `startCommand: npm start`.
   - Las migraciones siguen la regla «ampliar y luego contraer»: una versión solo **agrega** cosas. Lo que se borra o se renombra va en una versión posterior.
4. **`TRUST_PROXY`.** Con Vercel delante, una petición pasa por dos proxies (Vercel y Render) y `render.yaml` usa `2`. Pero la URL de Render también responde directo, con un solo proxy: ahí el primer valor de `X-Forwarded-For` lo escribe el cliente. Antes de abrir el servicio:
   - Desde fuera, `curl -H 'X-Forwarded-For: 1.2.3.4' https://mentor-api.onrender.com/api/v1/health` varias veces y por Vercel `https://mentor-ai.vercel.app/api/v1/health`; revisa en los registros qué IP ve el servidor en cada camino.
   - Si la IP del cliente se puede cambiar por el camino directo, usa `TRUST_PROXY=1` o la lista de direcciones de los proxies conocidos, y anota el resultado en el registro de aceptación.
   - Los límites que protegen cuentas no dependen de la IP: el bloqueo tras 5 intentos fallidos, el tope de enlaces de recuperación por correo y el tope de cambios de contraseña o correo por cuenta.
5. Primer administrador: en Render, *Shell* → `npm run admin:create`. La primera vez que entre, la plataforma le pedirá aceptar los términos.
6. Cuentas de prueba (opcional, para una demostración): agrega `DEMO_MODE=on` en las variables de Render y, si quieres, `DEMO_PASSWORD`. Al reiniciar se crean las cuentas por rol y aparece «Acceso rápido de prueba». Bórrala o ponla en `off` al terminar: las cuentas dejan de entrar y sus sesiones se cierran.

## 3. Frontend en Vercel
1. En `frontend/vercel.json`, cambia `https://mentor-api.onrender.com` por la URL real de la API si es distinta.
2. En Vercel: *Add New → Project*, elige el repositorio y pon **Root Directory = `frontend`**. Vercel detecta Vite y usa `npm run build`.
3. En *Settings → Git*, pon **Production Branch = `despliegue-nube`**. Cada push a esa rama despliega solo; las demás ramas reciben una URL de vista previa.

## 4. n8n
1. Crea el espacio en n8n Cloud o despliega la imagen `n8nio/n8n` en Render.
2. Importa los tres archivos de `n8n/` y sigue `n8n/README.md`: credenciales, `apiUrl` y activación.
3. Para el workflow de baja, copia la URL del webhook en `N8N_DELETION_WEBHOOK_URL` y pon `DELETION_PROCESSOR=n8n` en Render.

## 5. Comprobaciones posteriores (sobre la URL pública)
- El frontend carga en computadora y en celular, y usa HTTPS (candado).
- Inicio de sesión. En Supabase (*Table Editor* o *SQL Editor*), `users.password_hash` empieza con `$2b$` (bcrypt).
- Con la Data API apagada, `https://<proyecto>.supabase.co/rest/v1/users` no devuelve datos, ni con la clave publicable.
- Cada rol ve sus pantallas, y una ruta de otro rol responde 403.
- Asistentes IA responden; sin clave, muestran un error claro.
- Consumo IA muestra el tipo de cambio del día y el calendario muestra los feriados.
- Los tres workflows aparecen como ejecutados en n8n y en la tabla `integration_runs`.
- `/privacidad`, `/terminos` y la baja de cuenta están disponibles.
- En DevTools → Application no hay tokens en localStorage: la sesión va en una cookie httpOnly.
- Con SMTP configurado: «¿Olvidaste tu contraseña?» y el cambio de correo del perfil envían su enlace, y el correo de acceso solo cambia al confirmarlo desde la nueva dirección.
- Un DOCX renombrado desde un ZIP cualquiera se rechaza al subirlo.
- Las tareas periódicas aparecen una sola vez por turno en los registros aunque haya dos instancias.
- `GET /api/v1/ops/metrics` (con la cuenta de la plataforma) muestra latencia p50/p95/p99 y errores 4xx/5xx; los registros salen como una línea JSON por solicitud con su `requestId`.

### Registro de aceptación
El README solo debe decir que la plataforma está publicada cuando esta tabla esté completa. Cada fila se marca sobre la URL pública, con fecha, quién lo comprobó y una evidencia (captura o enlace).

| Comprobación | Fecha | Responsable | Evidencia | Resultado |
| --- | --- | --- | --- | --- |
| Frontend y API responden por HTTPS | | | | |
| `GET /api/v1/health` responde `ok` | | | | |
| Inicio de sesión de cada rol y 403 en rutas ajenas | | | | |
| Tutor responde con citas (o error claro sin clave) | | | | |
| Material sobrevive a un reinicio de Render (misma `X-Content-SHA256`) y aparece en el bucket privado de Supabase | | | | |
| La Data API de Supabase no expone las tablas (`/rest/v1/users` sin datos) | | | | |
| Correos de recuperación y de cambio de correo llegan | | | | |
| Workflows de n8n registrados en `integration_runs` | | | | |
| Respaldo restaurado y verificado (sección 7) | | | | |
| `TRUST_PROXY` comprobado por Vercel y por la URL directa de Render | | | | |
| Migraciones y pruebas del backend sobre un proyecto Supabase de prueba | | | | |
| Recordatorios: todos los destinatarios y reintento sin duplicar | | | | |

## 6. Reversión
- **Render:** *Events → Rollback* a la versión anterior (en el plan gratuito, solo a los dos despliegues más recientes). Como las migraciones solo agregan (sección 2), la versión anterior funciona con el esquema nuevo y **no hace falta deshacer migraciones**.
- **No uses `npm run db:migrate:undo` en producción** salvo que esa migración se haya ensayado antes en una copia: deshacer puede borrar columnas con datos. Si una migración dejó datos mal, restaura desde el respaldo (sección 7) en un entorno de prueba, compara y corrige con una migración nueva.
- **Vercel:** *Deployments → Promote to Production* sobre la versión anterior.
- **Código:** `git revert` del commit en `main`. El despliegue automático publica la versión corregida.

## 7. Respaldos
- El plan gratuito de Supabase **no** hace respaldos automáticos (el plan Pro guarda 7 días). Por eso, cada semana:
  `pg_dump "postgresql://postgres.<proyecto>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=supabase.crt" -Fc -f respaldo.dump`, guardado fuera del repositorio.
- Originales: descarga el bucket desde *Storage* (o con la CLI de Supabase) el mismo día que el dump.
- Para restaurar: `pg_restore -d <cadena de un proyecto de prueba> respaldo.dump`, luego `npm run db:migrate` si hay migraciones nuevas, y sube los originales al bucket si se perdieron.
- Comprobación de la restauración: elige tres materiales, compara `materials.content_sha256` con `sha256sum` del archivo descargado y anota fecha, duración y resultado.

## Limitaciones conocidas del plan gratuito
- **Supabase** pausa el proyecto tras una semana sin uso: hay que reactivarlo desde el panel. El plan gratuito da 500 MB de base, 1 GB de archivos y no hace respaldos automáticos (sección 7).
- **Render** apaga el servicio tras 15 minutos sin tráfico. La primera petición tarda hasta un minuto y el disco local se pierde al reiniciar: por eso los originales van a Supabase Storage.
- **Vercel** espera hasta 120 segundos el primer byte de una petición reenviada a Render; después la conexión sigue abierta mientras el servidor envíe algo al menos cada 120 segundos. El chat del tutor envía su primer evento enseguida y una señal de vida cada 15 s (`SSE_PING_MS`); hay que comprobarlo con Render recién despertado.
- **n8n Cloud** es una prueba de 14 días con 1000 ejecuciones. Una instalación propia en Render gratuito se duerme y no ejecuta los horarios mientras está apagada.
- **Tareas periódicas.** Las importaciones, la limpieza, la retención y Drive corren dentro del servidor web con temporizadores. Si Render lo duerme, no corren a su hora: se ponen al día cuando despierta.
- **Dos motores.** Las pruebas automáticas corren en MySQL 8.4 y en PostgreSQL 17 (CI). Antes de abrir el servicio, ejecuta las migraciones y la suite del backend contra un proyecto Supabase de prueba (no el de producción) y anota el resultado.
