# MENTOR AI

Plataforma educativa adaptativa: cursos, lecciones, cuestionarios con corrección automática, dominio por tema, recomendaciones explicadas, aula (clases en vivo, materiales, tareas) y un **tutor de IA que responde solo con el material autorizado del curso y cita la fuente**.

**Stack:** React + Vite (JSX) · Node.js + Express · MySQL 8 + Sequelize (migraciones) · Google Cloud RAG Engine (opcional) · Anthropic u OpenAI para generar respuestas.
**Sin datos precargados:** después de migrar, la base queda vacía (solo el catálogo de roles). No hay seeds, cuentas demo ni IA simulada.

**Admisiones CRM:** convocatorias por curso, nueve etapas, historial y seguimientos, métricas de cohortes, matrícula transaccional, borradores revisados y derechos de prospectos. Recorrido, configuración, pruebas aisladas de 40 solicitudes y estado de requisitos en [docs/CRM.md](docs/CRM.md). No requiere IA para gestionar admisiones. Las migraciones nuevas son `20261122000100` y `20261122000200`.

**Seguimiento institucional de plataforma (avance parcial):** módulo separado de admisiones para `platform_admin`. Permite listar instituciones, configurar una ficha y registrar contactos profesionales; aún faltan tareas, soporte, incorporación verificable y políticas de conservación. Requiere la migración `20261124000100`; véase [la decisión y pendientes](docs/adr/0007-crm-instituciones.md). No aplicar la migración en producción como parte de esta entrega.

**Despliegue:** pendiente de verificar. Las direcciones previstas son https://mentor-ai.vercel.app (frontend) y https://mentor-api.onrender.com/api/v1 (API), pero no cuentan como publicadas hasta completar el registro de aceptación de `docs/despliegue.md` (sección 6) sobre la URL pública.

## Entregables del Proyecto Final (FWD Costa Rica)
| Documento | Word y PDF |
| --- | --- |
| Anteproyecto (introducción, desarrollo, objetivos, RF/RNF, historias, mockups, libro de marca y cronograma) | `docs/entregables/Anteproyecto_MENTOR_AI.*` |
| Modelo de datos (diagramas ER y diccionario) | `docs/entregables/Modelo_de_datos_MENTOR_AI.*` y `docs/datos/` |
| Libro de marca | `docs/entregables/Libro_de_marca_MENTOR_AI.*` y `docs/marca/` |
| Plan de producción | `docs/entregables/Plan_de_Produccion_MENTOR_AI.*` y `docs/produccion/` |
| Agentes de IA y APIs externas | `docs/agentes-ia.md`, `docs/apis-externas.md` |
| Workflows de n8n exportados | `n8n/` |

Seguridad: contraseñas con **bcrypt**, sesión con **JWT** (secreto y expiración en `.env`) en cookie httpOnly, roles validados en el backend (administración de plataforma, administración de institución, docente, estudiante y auditoría). Ramas: `main`, `develop`, `feature/…` y `fix/…` con pull requests.

## Requisitos
- Node.js **22.22.2 o superior en la línea 22, o 24.15 o superior** (22 LTS recomendado). El SDK de Anthropic y las librerías de Google piden 22.12+, y jsdom (pruebas del frontend) pide 22.22.2+.
- MySQL 8.0 u 8.4.
- Opcional: un proyecto de Google Cloud (modo `vertex`) y una clave de Anthropic u OpenAI (tutor).

## 1. Instalar y arrancar (PowerShell en Windows)

### Bases vacías
En MySQL Workbench, con una cuenta autorizada:
```sql
CREATE DATABASE mentor_ai CHARACTER SET utf8mb4;
CREATE DATABASE mentor_ai_test CHARACTER SET utf8mb4;  -- solo para las pruebas automáticas
```

### Backend
```powershell
cd backend
Copy-Item .env.example .env      # edita .env: usuario y contraseña de MySQL (y lo opcional)
npm install
npm run db:migrate               # crea las tablas, sin insertar filas
npm run admin:create             # pide correo, nombre y contraseña del primer administrador
npm run dev                      # API en http://localhost:3001
```

### Frontend (otra terminal)
```powershell
cd frontend
npm install
npm run dev                      # http://127.0.0.1:5173
```

Para actualizar una instalación anterior, ejecuta `npm ci` en ambas carpetas y `npm run db:migrate` en `backend`. La migración `20261116000400-optimize-read-indexes` añade los índices de lectura. En cada curso, abre **Fuentes del tutor → Indexar ahora** para convertir las lecciones publicadas y los archivos existentes en fuentes del tutor.

### Optimización de rendimiento del 16 de noviembre

- El tutor local conserva los rangos originales del texto, incluidos los saltos de línea y el final de cada pasaje. Reconoce siglas cortas como IA y SQL. Reutiliza fragmentos y términos preparados en una caché limitada a 128 documentos y cuatro millones de caracteres, consultando los permisos en MySQL en cada pregunta.
- En modo Vertex, el backend solicita primero los identificadores autorizados y carga el texto completo de las versiones recuperadas. Comprueba el pasaje completo contra MySQL antes de entregarlo al modelo.
- El chat actualiza un borrador independiente del historial y agrupa los deltas cada 32 ms. Cambiar de curso, elegir otra conversación o detener la respuesta cancela la petición activa. Las citas aparecen al validar la respuesta final.
- El inicio del estudiante consulta su asistencia y calcula los totales de avance en MySQL. Las consultas de anuncios y materiales seleccionan las columnas utilizadas. La analítica agrupa respuestas y dominio por tema en consultas independientes para evitar multiplicar filas.
- Las respuestas HTTP negocian compresión. Los eventos SSE se envían directamente. React, Motion, React Spring y GSAP (`vendor-gsap`) tienen archivos separados con nombres basados en su contenido; GSAP solo se descarga en las páginas que lo usan, no en la carga inicial del ingreso. La activación de cuentas y las páginas privadas se cargan bajo demanda.
- El botón para entrar a clase se actualiza cada 15 segundos. Los relojes se detienen al ocultar la pestaña y se actualizan al volver. El fondo de acceso también responde a cambios de movimiento reducido.

En una prueba en memoria con 100 documentos de unos 17.000 caracteres, la mediana de 15 búsquedas con la caché preparada pasó de **62,85 ms a 1,74 ms**. Esta medición cubre la selección local de fragmentos. El JavaScript inicial completo, sumando sus dependencias estáticas, mide **90,59 kB gzip antes y 90,71 kB después**. La separación de dependencias permite reutilizarlas al actualizar la aplicación. Los resultados de validación están en `docs/ESTADO_DESARROLLO_PARA_CLAUDE.md`.

## 2. Tutor de IA
Sin configuración, el tutor responde `AI_NOT_CONFIGURED` y el resto de la plataforma funciona. En `backend/.env`:
```
AI_PROVIDER=anthropic            # o openai
AI_API_KEY=tu_clave
AI_MODEL=identificador_disponible_en_tu_cuenta   # por ejemplo claude-opus-5-5
```
- Con `anthropic` el chat usa **streaming** (SDK oficial) y se puede detener, pero el servidor **retiene el texto hasta validarlo**: el navegador solo ve el avance. Con `openai` la respuesta llega completa.
- Validación: cada oración con contenido se compara con el pasaje que cita (números presentes en la fuente y términos en común). Una frase como «dos más dos son nueve» citando «dos más dos son cuatro» se rechaza. No es una garantía pedagógica: por eso cada cita abre su pasaje.
- Si el curso no cubre la pregunta, el estudiante recibe un aviso de material insuficiente y **no se llama al modelo**.
- Cada respuesta se valida en el servidor: formato correcto y citas a fragmentos entregados. Sin cita válida, la respuesta no se muestra.

## 3. Recuperación de fuentes: dos modos

| | `RAG_PROVIDER=local` (por defecto) | `RAG_PROVIDER=vertex` |
| --- | --- | --- |
| Búsqueda | Por palabras, en MySQL | Por significado, en RAG Engine (API de Vertex AI) |
| Requiere | Nada extra | Proyecto de Google Cloud, bucket privado, ADC |
| Uso | Desarrollo, pruebas, instalaciones sin nube | Producción |

En ambos modos, las fuentes son las mismas: lecciones publicadas, archivos **PDF con texto, DOCX y TXT** del curso y documentos de la carpeta de Drive vinculada. El docente ve cada fuente como *pendiente, procesando, listo* o *error* (con motivo y botón para reintentar), y puede retirarla: deja de usarse en el acto.

### Configurar Google Cloud (modo `vertex`)
1. **Región.** RAG Engine está en GA en `europe-west3` y `europe-west4`. `us-central1`, `us-east1` y `us-east4` piden lista de acceso. Usa la misma región para el bucket.
2. **APIs** del proyecto:
   ```powershell
   gcloud services enable aiplatform.googleapis.com storage.googleapis.com drive.googleapis.com --project TU_PROYECTO
   ```
3. **Bucket privado:**
   ```powershell
   gcloud storage buckets create gs://TU_BUCKET --project TU_PROYECTO --location europe-west4 --uniform-bucket-level-access --public-access-prevention
   ```
4. **Identidad del servidor** (una cuenta de servicio, por ejemplo `mentor-ai@TU_PROYECTO.iam.gserviceaccount.com`), con permisos mínimos:

   | Operación | Permiso |
   | --- | --- |
   | Crear corpus, importar, listar y borrar archivos del corpus, recuperar fragmentos | `roles/aiplatform.user` en el proyecto (o un rol personalizado con `aiplatform.ragCorpora.*` y `aiplatform.ragFiles.*`) |
   | Escribir y borrar los objetos que MENTOR crea | `roles/storage.objectUser` **solo en el bucket** |
   | Leer la carpeta de Drive | Compartir la carpeta con el correo de la cuenta de servicio como **Lector** (alcance `drive.readonly`) |
   | Que RAG Engine lea los objetos al importar | `roles/storage.objectViewer` en el bucket para el agente de servicio `service-NUMERO_DE_PROYECTO@gcp-sa-vertex-rag.iam.gserviceaccount.com` |

5. **Application Default Credentials (ADC).** No guardes claves en el repositorio. En desarrollo, suplanta a la cuenta de servicio:
   ```powershell
   gcloud auth application-default login --impersonate-service-account mentor-ai@TU_PROYECTO.iam.gserviceaccount.com
   ```
   En un servidor de Google Cloud, asigna la cuenta de servicio a la máquina. Si debes usar un archivo de clave, guárdalo fuera del proyecto y defínelo solo en la sesión: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\fuera\del\repo\clave.json"`.
6. En `backend/.env`:
   ```
   RAG_PROVIDER=vertex
   GOOGLE_CLOUD_PROJECT=TU_PROYECTO
   GOOGLE_CLOUD_LOCATION=europe-west4
   RAG_GCS_BUCKET=TU_BUCKET
   ```
7. **Costos.** RAG Engine guarda corpus y archivos en RagManagedDb, una instancia de Spanner administrada que **se cobra al proyecto**, además de los embeddings y el almacenamiento. Revisa la facturación de RAG Engine antes de cargar material. Cuando termines de probar, pasa RagManagedDb al nivel *Unprovisioned* (borra los datos de RAG Engine y detiene ese cobro).

Una falla de Google Cloud se muestra como `RAG_UNAVAILABLE` («no significa que falte material»), distinta de una búsqueda sin coincidencias.

### Google Drive
1. La administración de la institución abre **Drive**, pega el identificador de la carpeta (la parte final de su dirección) y la habilita. MENTOR comprueba el acceso antes.
2. El docente, en **Fuentes del tutor**, vincula esa carpeta al curso y pulsa **Sincronizar ahora**.
3. Google Docs se exportan como texto; PDF, DOCX y TXT se descargan. Si un archivo no cambió, no se vuelve a indexar. Si cambió, la cita apunta a la versión nueva cuando termina la indexación. Si un archivo sale de la carpeta o se pierde el acceso, su fuente se desactiva. Una sincronización interrumpida continúa donde quedó.
4. Para sincronizar solo, define `DRIVE_SYNC_INTERVAL_MINUTES` (por ejemplo `60`).

## 4. Recorrido reproducible (todo desde la interfaz)
1. **Plataforma:** entra con el administrador, crea una institución e invita a su administrador. Cada invitación da un enlace de un solo uso (ábrelo en una ventana privada). En la misma tarjeta puedes fijar los topes de documentos y de consultas diarias.
2. **Administración de la institución:** en *Usuarios*, invita a un docente y a un estudiante. Opcional: en *Drive*, habilita una carpeta.
3. **Docente:**
   - Crea un curso con módulo, tema y lección (márcala *Publicada*), publica el curso y matricula al estudiante.
   - En *Novedades*, arrastra un **PDF con texto, DOCX o TXT** (por ejemplo un reglamento), revisa nombre y tamaño y pulsa **Subir archivo**. Verás su estado de indexación.
   - En *Fuentes del tutor*, comprueba que dice **Listo**. Sube un PDF escaneado para ver el motivo del error y el botón **Reintentar**.
4. **Estudiante:**
   - Abre el curso y entra a **Tutor IA**. Pregunta con tus palabras por algo del reglamento: mientras se prepara ves el avance; la respuesta aparece completa, con sus fuentes, cuando pasó la validación. Abre la cita: verás el pasaje, el título, la página o sección y la versión.
   - Pregunta algo que el curso no cubre: aparece el aviso de material insuficiente.
   - Prueba **Dame una pista**, **Detener** y **Nueva conversación**.
5. **Docente:** en *Fuentes del tutor*, abre *Versiones* para ver qué versión se usó y en cuántas respuestas. Retira la fuente: el estudiante verá la cita como «fuente retirada».
6. **Administración:** en *Consumo IA*, revisa respuestas, tokens y latencia por modelo (sin contenido de chats).

### Aula, quizzes, racha y nota del curso
La interfaz se organiza como un aula virtual: barra lateral con **Página principal**, **Calendario**, **Pendientes** (docente: **Por revisar**), la lista de clases y **Configuración**. Cada clase tiene pestañas.

- **Estudiante:** Novedades (anuncios y recuadro «Próximas»), Trabajo en clase (lecciones, tareas, evaluaciones, materiales y clases en vivo con filtros), Quizzes y racha, Calificaciones y Personas.
- **Docente:** las mismas secciones con permisos de gestión, más Quizzes (crear, publicar, archivar), Calificaciones (libro de notas, trabajo en clase y pesos), Fuentes del tutor y Analítica. Todo permiso se valida en el backend; ocultar un botón no es la protección.

Reglas de la nota (escala 0 a 10):
1. **Base:** evaluaciones, tareas y trabajo en clase con pesos que fija el docente (por defecto 40/30/30; deben sumar 100). Una parte sin nada calificado no cuenta y su peso se reparte. Una evaluación cerrada sin intento y una tarea vencida sin entrega cuentan 0.
2. **Quiz rápido perfecto:** +0,1 la primera vez por quiz. El servidor mide el tiempo de cada respuesta (1000 puntos si es inmediata, 500 al final; fuera de tiempo, 0).
3. **Racha:** cada día en que se responden las 5 preguntas de la práctica diaria (tomadas de los quizzes publicados) suma +0,09. Si un día queda sin práctica, la racha vuelve a empezar, pero lo ganado se conserva. El día se decide con `APP_TIMEZONE` (por defecto `America/Costa_Rica`).
4. **Tope del bono:** lo fija el docente (por defecto 1,00). La nota final nunca pasa de 10.

Recorrido: el docente crea un quiz en *Quizzes*, le agrega preguntas y lo publica; el estudiante lo juega desde *Quizzes y racha* y hace la práctica del día; el docente crea una actividad en *Calificaciones* → *Trabajo en clase*, la califica y ve la nota final de cada estudiante.

## 5. Pruebas

```powershell
# Backend: 241 pruebas (incluye las evals rápidas de IA de tests/evals) en mentor_ai_test (crean y borran sus datos). Google Cloud, la IA y las APIs externas son dobles.
cd backend
npm run lint
npm test

# Frontend: lint, 65 pruebas de componentes y hooks (Vitest + jsdom) y compilación
cd ..\frontend
npm run lint
npm test
npm run build
```

### Pruebas en navegador (Playwright)
Recorren la aplicación real (backend, MySQL y frontend) en escritorio y móvil: acceso, tutor con streaming y citas, aviso sin respaldo, «Detener», carga de archivos, el botón «Entrar» de las clases, la página «no encontrada» y el quiz perfecto con racha y libro de calificaciones. Usan una base **dedicada** que se borra y recrea en cada corrida (su nombre debe terminar en `_e2e`) y un doble local del modelo, así que no necesitan claves.

```powershell
# Una sola vez: base vacía y navegador de Playwright
#   CREATE DATABASE mentor_ai_e2e CHARACTER SET utf8mb4;   (con permisos para el usuario de backend/.env)
cd frontend
npx playwright install chromium
npm run test:e2e
```
Son 44 pruebas, incluidas 12 revisiones automáticas de accesibilidad con axe-core (WCAG 2.2 AA) en tres anchos. Usan los datos de conexión de `backend/.env`.

Las capturas de los mockups (escritorio y móvil) se generan con `npx playwright test -c playwright.capturas.config.js` sobre la misma base `_e2e` y quedan en `frontend/capturas/salida/` (no se versionan; las optimizadas están en `docs/mockups/`). Para cambiar puertos o base: `E2E_DB_NAME`, `E2E_API_PORT` (3101), `E2E_WEB_PORT` (5174) y `E2E_FAKE_AI_PORT` (4599).

### Integración continua
`.github/workflows/ci.yml` corre en GitHub Actions en cada push y pull request: lint y pruebas del backend con **MySQL 8.4**, lint, pruebas y compilación del frontend, y las pruebas en navegador. No necesita secretos.

Las pruebas automáticas **nunca** llaman a Google Cloud ni al proveedor de IA: usan dobles (`backend/tests/fakes/googleFake.js` y `frontend/e2e/support/fake-anthropic.mjs`). Para probar los dos modos de punta a punta con servicios reales:
- **Modo local:** deja `RAG_PROVIDER=local` y haz el recorrido de la sección 4.
- **Modo vertex:** usa un **proyecto de prueba** y material de prueba, configura la sección 3 y repite el recorrido. Comprueba en la consola de Google Cloud que el bucket tiene objetos `mentor-ai/i*/c*/s*/v*.txt` y que el corpus del curso tiene sus archivos.

## 6. Producción

Despliegue paso a paso (TiDB Cloud, Render, Vercel y n8n) en `docs/despliegue.md`; justificación, costos, respaldos y pruebas en el Plan de Producción. Las variables necesarias están en `backend/.env.example` (solo nombres).


- **Proxy o balanceador.** Define `TRUST_PROXY` con la cantidad de proxies delante del backend (normalmente `1`) o sus direcciones. Sin esto, todas las peticiones parecen venir de la IP del proxy y los límites de intentos se comparten entre todos los usuarios. El valor `true` se rechaza porque permitiría falsificar la IP.
- **Varias instancias.** Con `RATE_LIMIT_STORE=mysql` los límites por IP se cuentan en MySQL y valen para todas las instancias. Las tareas periódicas (importaciones, limpieza, retención y Drive) solo las ejecuta la instancia que tiene el turno en `job_leases`; si se apaga, otra lo toma en 90 segundos. La cuota diaria del tutor ya se reserva en MySQL.
- **Chat en vivo.** El servidor envía `: ping` cada `SSE_PING_MS` (15 s) para que los proxies no corten la conexión. Si usas nginx, mantén `proxy_buffering off` para `/api/v1/tutor/`.
- **Originales duraderos.** Con `STORAGE_DRIVER=gcs` los materiales y fotos de perfil se copian a un bucket privado de Cloud Storage (ADC) y el disco solo se usa como paso temporal; `materials.content_sha256` guarda la huella y la descarga la envía en `X-Content-SHA256`. Una carga se registra con su auditoría en una sola transacción: si algo falla antes de confirmar, el original se descarta y no queda fila huérfana; si falla la indexación, el material queda guardado y la fuente se reintenta. Guía en `docs/despliegue.md` (sección 2).
- **Consentimiento.** Con términos o privacidad pendientes, el servidor rechaza cualquier operación nueva (`403 CONSENT_REQUIRED`) salvo aceptar, cerrar sesión, leer y pedir la baja; la interfaz vuelve a mostrar el diálogo.
- **Notas emitidas.** El puntaje máximo de una tarea con entregas calificadas no se puede cambiar (`409 GRADED_MAX_LOCKED`).
- **Seguridad web.** Inyección SQL, XSS (CSP en `frontend/vercel.json`), CSRF y CORS estricto (`403 ORIGIN_NOT_ALLOWED`): medidas, investigación, laboratorio y evidencias en `docs/seguridad/`.
- **Archivos.** Además de la extensión y el tipo, se revisan los primeros bytes de cada archivo (PDF, PNG, JPEG y texto UTF-8). Los DOCX/PPTX/XLSX se abren como ZIP y se revisa su estructura antes de extraer texto: partes obligatorias, rutas seguras, sin cifrado, sin archivos anidados y con límites de entradas, tamaño descomprimido y razón de compresión. Un archivo renombrado, truncado o una «bomba ZIP» se rechazan.
- **Cambio de correo.** El correo de acceso solo cambia al abrir el enlace enviado a la nueva dirección (60 minutos, un solo uso); la dirección anterior recibe un aviso al pedirlo y al confirmarlo. Requiere SMTP configurado.
- **Fechas.** Las fechas `AAAA-MM-DD` se validan contra el calendario (un 31 de febrero se rechaza con 422).
- **Retención.** Una vez al día se borra el texto de versiones antiguas que ninguna respuesta cita, se resume por mes el consumo con más de 90 días, se borra el registro detallado de los asistentes con más de 90 días y se borran las conversaciones sin actividad por más de 365 días. Los plazos se cambian en `backend/.env` (0 = no borrar).
- **Monitoreo.** `GET /api/v1/health` informa si MySQL responde y si el tutor y Google Cloud están configurados, sin exponer claves, proyectos ni proveedores. Cada solicitud deja una línea JSON con su `requestId`, la plantilla de la ruta, el estado y la duración; `GET /api/v1/ops/metrics` (solo la cuenta de la plataforma) muestra p50/p95/p99 y errores de la instancia.
- **Baja de cuenta.** Se completa en el servidor, en una transacción, antes de responder; n8n solo envía el correo de confirmación. Las solicitudes que hubieran quedado pendientes se completan en la conciliación diaria.
- **Recordatorios.** Se recorren por páginas con cursor y se registra el envío por persona y día, así nadie queda fuera y un reintento no repite correos. Cada estudiante puede apagarlos en Configuración.
- **Tutor.** La revisión automática rechaza números que no están en la fuente, números asociados a otra cosa y negaciones que contradicen el pasaje. Es una revisión por palabras, no una prueba de verdad (ADR 0008).
- **Capas de IA (ADR 0009).**
  - Prompts versionados en `backend/src/prompts/`: una prueba falla si cambian sin subir la versión.
  - Router de modelos por tarea: `AI_MODEL_RAPIDO` y `AI_MODEL_AVANZADO`, con `AI_MODEL` como respaldo.
  - Guardrails de salida: datos personales, enlaces externos, cifras sin respaldo, temas ajenos y claves de evaluaciones abiertas.
  - Caché por institución del resumen de lección.
  - Bitácora con versión del prompt, modelo, caché y resultado de los guardrails.
  - Evals: rápidas dentro de `npm test`, y con modelo real en `npm run evals`. Ver `docs/agentes-ia.md`.

## Scripts
| Carpeta | Comando | Qué hace |
|---|---|---|
| backend | `npm run dev` / `npm start` | Inicia la API y las tareas periódicas (importaciones, limpieza, Drive) |
| backend | `npm run db:migrate` · `db:migrate:status` · `db:migrate:undo` | Migraciones Sequelize |
| backend | `npm run admin:create` | Crea el primer administrador |
| backend | `npm test` | Pruebas en `TEST_DB_NAME` |
| frontend | `npm run dev` · `npm run build` · `npm test` | Desarrollo, compilación y pruebas de componentes |
| frontend | `npm run test:e2e` | Pruebas en navegador con Playwright (base `_e2e`) |
| ambas | `npm run lint` | Revisión de estilo |
| backend | `npm run lab:sqli` | Laboratorio local de inyección SQL (vulnerable frente a protegida) en una base `_lab` efímera; ver `docs/seguridad/README.md` |
| raíz | `scripts/empaquetar.sh` | ZIP de entrega con solo los archivos versionados (sin `.env`, `node_modules` ni archivos subidos); imprime commit y fecha |

## Estructura
```
frontend/index.html → src/main.jsx → src/App.jsx → src/Rutas/Rutas.jsx → src/Pages/* → src/Componentes/*
backend/src/{config,models,controllers,services,routes,middlewares,validators,utils,scripts}
backend/database/migrations   # solo esquema
docs/adr/                      # decisiones de arquitectura
docs/gobernanza/               # inventario de datos y registro de riesgos
docs/entregables/              # anteproyecto, modelo de datos, libro de marca y plan de producción (Word y PDF)
n8n/                           # workflows exportados
frontend/tests · frontend/e2e  # pruebas de componentes y en navegador
.github/workflows/ci.yml       # integración continua
```

Avance y pendientes: `docs/ESTADO_DESARROLLO_PARA_CLAUDE.md`. Instrucciones para agentes: `AGENTS.md`. Licencias de terceros: `THIRD_PARTY_NOTICES.md`.
