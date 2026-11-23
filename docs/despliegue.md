# Guía de despliegue de MENTOR AI

Arquitectura elegida (justificada en el Plan de Producción):

| Componente | Proveedor | URL |
| --- | --- | --- |
| Frontend (React + Vite) | Vercel, plan Hobby | `https://mentor-ai.vercel.app` (ajustar al nombre real) |
| API (Node + Express) | Render, web service gratuito | `https://mentor-api.onrender.com/api/v1` |
| Base de datos MySQL | TiDB Cloud Starter (compatible con MySQL, TLS obligatorio) | Host privado de TiDB, solo con TLS |
| Workflows | n8n Cloud (prueba de 14 días) o n8n propio en Render | `https://<tu-espacio>.app.n8n.cloud` |
| IA | Anthropic (Claude) | API del proveedor |

El navegador solo habla con Vercel. Vercel reenvía `/api/*` a Render, así que la cookie de sesión es del mismo origen y no hace falta abrir CORS a otros dominios.

## 1. Base de datos (TiDB Cloud Starter)
1. Crea una cuenta en tidbcloud.com y un clúster **Starter** en la región más cercana (por ejemplo AWS us-east-1).
2. En *Connect*, genera la contraseña y copia host, puerto (4000), usuario y nombre de base. Crea la base `mentor_ai` con `CREATE DATABASE mentor_ai;` desde el SQL Editor.
3. No subas estos datos al repositorio: van solo en Render.

## 2. Archivos originales (Google Cloud Storage)
El disco de Render gratis se borra al reiniciar, redesplegar o suspender el servicio. Por eso los materiales y las fotos de perfil se guardan en un bucket privado (`STORAGE_DRIVER=gcs`). MySQL guarda la huella SHA-256 de cada material para comprobar que el archivo descargado es idéntico al original.
1. En Google Cloud, crea un bucket **privado** (acceso uniforme, sin acceso público) en una región cercana, por ejemplo `us-east1`. Activa el versionado de objetos para poder recuperar un archivo borrado por error.
2. Crea una cuenta de servicio solo con el rol **Storage Object Admin** sobre ese bucket. Descarga su clave JSON y no la subas al repositorio.
3. En Render, *Environment → Secret Files*: crea `gcp-mentor-storage.json` con el contenido de la clave. `render.yaml` ya apunta `GOOGLE_APPLICATION_CREDENTIALS` a `/etc/secrets/gcp-mentor-storage.json` (ADC la lee de ahí).
4. Completa `STORAGE_GCS_BUCKET` con el nombre del bucket. `/api/v1/health` debe mostrar `files: { driver: "gcs", configured: true }`.
5. Prueba de aceptación: sube un material, anota el encabezado `X-Content-SHA256` de su descarga, pulsa *Manual Deploy → Restart service* y descárgalo de nuevo: la huella debe ser la misma.

Sin Google Cloud, la alternativa es un plan de Render con disco persistente (`STORAGE_DRIVER=local` y `UPLOAD_DIR` dentro del disco) con respaldo propio.

## 3. API en Render
1. En Render: *New → Blueprint* y elige el repositorio. Render lee `render.yaml` y crea `mentor-api` en la rama `main`.
2. Completa las variables marcadas `sync: false`. `JWT_SECRET` y `N8N_INTEGRATION_KEY` las genera Render.
   - `DB_HOST`, `DB_PORT=4000`, `DB_NAME=mentor_ai`, `DB_USER`, `DB_PASSWORD`.
   - `FRONTEND_ORIGIN=https://mentor-ai.vercel.app` y `APP_URL` con el mismo valor.
   - `AI_PROVIDER=anthropic`, `AI_MODEL`, `AI_API_KEY`.
   - `SMTP_*` para recuperación de contraseña, recordatorios y avisos de baja.
3. Al arrancar se ejecuta `npm run db:migrate` (crea o actualiza las tablas) y luego `npm start`. El estado se ve en `https://mentor-api.onrender.com/api/v1/health`.
4. Primer administrador: en Render, *Shell* → `npm run admin:create`. La primera vez que entre, la plataforma le pedirá aceptar los términos.

## 4. Frontend en Vercel
1. En `frontend/vercel.json`, cambia `https://mentor-api.onrender.com` por la URL real de la API si es distinta.
2. En Vercel: *Add New → Project*, elige el repositorio y pon **Root Directory = `frontend`**. Vercel detecta Vite y usa `npm run build`.
3. Cada push a `main` despliega solo. Los pull requests reciben una URL de vista previa.

## 5. n8n
1. Crea el espacio en n8n Cloud o despliega la imagen `n8nio/n8n` en Render.
2. Importa los tres archivos de `n8n/` y sigue `n8n/README.md`: credenciales, `apiUrl` y activación.
3. Para el workflow de baja, copia la URL del webhook en `N8N_DELETION_WEBHOOK_URL` y pon `DELETION_PROCESSOR=n8n` en Render.

## 6. Comprobaciones posteriores (sobre la URL pública)
- El frontend carga en computadora y en celular, y usa HTTPS (candado).
- Inicio de sesión. En la base, `users.password_hash` empieza con `$2b$` (bcrypt).
- Cada rol ve sus pantallas, y una ruta de otro rol responde 403.
- Asistentes IA responden; sin clave, muestran un error claro.
- Consumo IA muestra el tipo de cambio del día y el calendario muestra los feriados.
- Los tres workflows aparecen como ejecutados en n8n y en la tabla `integration_runs`.
- `/privacidad`, `/terminos` y la baja de cuenta están disponibles.
- En DevTools → Application no hay tokens en localStorage: la sesión va en una cookie httpOnly.
- Con SMTP configurado: «¿Olvidaste tu contraseña?» y el cambio de correo del perfil envían su enlace, y el correo de acceso solo cambia al confirmarlo desde la nueva dirección.
- Un DOCX renombrado desde un ZIP cualquiera se rechaza al subirlo.
- Las tareas periódicas aparecen una sola vez por turno en los registros aunque haya dos instancias.

### Registro de aceptación
El README solo debe decir que la plataforma está publicada cuando esta tabla esté completa. Cada fila se marca sobre la URL pública, con fecha, quién lo comprobó y una evidencia (captura o enlace).

| Comprobación | Fecha | Responsable | Evidencia | Resultado |
| --- | --- | --- | --- | --- |
| Frontend y API responden por HTTPS | | | | |
| `GET /api/v1/health` responde `ok` | | | | |
| Inicio de sesión de cada rol y 403 en rutas ajenas | | | | |
| Tutor responde con citas (o error claro sin clave) | | | | |
| Material sobrevive a un reinicio de Render (misma `X-Content-SHA256`) | | | | |
| Correos de recuperación y de cambio de correo llegan | | | | |
| Workflows de n8n registrados en `integration_runs` | | | | |
| Respaldo restaurado y verificado (sección 8) | | | | |

## 7. Reversión
- **Render:** *Events → Rollback* a la versión anterior. Si una migración nueva causó el problema, `npm run db:migrate:undo` en el *Shell* antes del rollback.
- **Vercel:** *Deployments → Promote to Production* sobre la versión anterior.
- **Código:** `git revert` del commit en `main`. El despliegue automático publica la versión corregida.

## 8. Respaldos
- TiDB Cloud Starter hace respaldos automáticos diarios (revisa la retención en *Backup*).
- Además, cada semana: `mysqldump --ssl-mode=VERIFY_IDENTITY -h <host> -P 4000 -u <usuario> -p mentor_ai > respaldo.sql`, guardado fuera del repositorio.
- Originales: el bucket con versionado de objetos conserva los archivos borrados o reemplazados. Para un respaldo externo, `gcloud storage cp -r gs://<bucket>/mentor-ai/originales ./respaldo-originales` el mismo día que el dump.
- Para restaurar: `mysql ... mentor_ai < respaldo.sql`, luego `npm run db:migrate` si hay migraciones nuevas, y copia los originales al bucket si se perdieron.
- Comprobación de la restauración: elige tres materiales, compara `materials.content_sha256` con `sha256sum` del archivo descargado y anota fecha, duración y resultado.

## Limitaciones conocidas del plan gratuito
- **Render** apaga el servicio tras 15 minutos sin tráfico. La primera petición tarda hasta un minuto y el disco local se pierde al reiniciar; por eso los originales van a Cloud Storage (sección 2).
- **Vercel** corta las peticiones reenviadas que tardan más de 30 segundos. Una respuesta muy larga del tutor podría interrumpirse.
- **n8n Cloud** es una prueba de 14 días con 1000 ejecuciones. Una instalación propia en Render gratuito se duerme y no ejecuta los horarios mientras está apagada.
- **Aiven** ya no permite crear MySQL gratis (desde el 6 de noviembre de 2026). Por eso se eligió TiDB Cloud Starter.
