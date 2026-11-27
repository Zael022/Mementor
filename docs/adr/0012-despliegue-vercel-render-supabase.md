# ADR 0012 · Despliegue Vercel + Render + Supabase (rama `despliegue-nube`)

**Estado:** aceptada (2026-11-27) · solo en la rama `despliegue-nube`.

## Contexto
El profesor pidió publicar MENTOR AI con la misma arquitectura del laboratorio JJ SecureVault: **Vercel** para el frontend, **Render** para la API y **Supabase** para los datos. El proyecto también tiene que seguir abriéndose en una computadora como hasta ahora.

Supabase es **PostgreSQL**. Las reglas del proyecto (CLAUDE.md regla 1, documento 01) piden MySQL con Sequelize y no permiten cambiar a PostgreSQL.

## Decisión
1. **Una rama aparte.** `main` y `develop` siguen exactamente igual, con MySQL. La rama `despliegue-nube` contiene lo mismo, más el soporte para la nube.
2. **MySQL sigue siendo el motor de referencia.** En la computadora, en las pruebas de siempre y para el diccionario de datos se usa MySQL. PostgreSQL solo se usa al publicar en Supabase. Se escoge con `DB_DIALECT` (o una `DATABASE_URL` que empiece con `postgresql://`).
3. **Un solo código para los dos motores:**
   - `config/connection.cjs` arma la conexión para la API y para las migraciones.
   - `src/utils/sql.js` adapta el SQL escrito a mano. Pone comillas a los alias en camelCase y escribe intervalos de fecha, `ON CONFLICT` y filas afectadas en la forma de cada motor.
   - `database/compat.cjs` adapta las migraciones: TINYINT pasa a SMALLINT y los ENUM se amplían con `ALTER TYPE`.
   - En PostgreSQL las búsquedas usan `ILIKE`, para no distinguir mayúsculas igual que MySQL. Las listas sin orden explícito se ordenan por `id`, que es el orden que da MySQL.
4. **Archivos en Supabase Storage.** Se agrega `STORAGE_DRIVER=supabase`, que usa un bucket **privado** y la API REST:
   - La clave secreta (`SUPABASE_SECRET_KEY`) vive solo en Render.
   - El navegador nunca habla con Supabase. Descarga por la API de MENTOR, que revisa los permisos y entrega la huella SHA-256.
5. **La Data API de Supabase no ve las tablas.** La migración `20261127000200-proteger-esquema-supabase` activa RLS sin políticas y quita los permisos de `anon`, `authenticated` y `service_role`, también para las tablas futuras. Además, la guía pide apagar la Data API del proyecto. Solo el backend entra a la base, por el pooler.
6. **Conexión por el «Session pooler»** (IPv4, puerto 5432), porque Render no llega a la conexión directa, que es solo IPv6. TLS siempre verifica el certificado, usando el certificado raíz de Supabase (`DB_SSL_CA_PEM`). La API usa como máximo 5 conexiones (`DB_POOL_MAX`).

## Verificación
- Backend: 261 pruebas — 261/261 en PostgreSQL 16 y 260/260 en MySQL 8 (la de RLS solo aplica a PostgreSQL y se omite en MySQL). En CI se agregó el trabajo «Backend en PostgreSQL (Supabase)» con PostgreSQL 17.
- Playwright: 47/47 con la API sobre PostgreSQL.
- Migraciones: se aplicaron en una base vacía, se deshicieron todas y se volvieron a aplicar, sin errores, en PostgreSQL.
- Supabase Storage se probó con un doble que imita su API REST. **Falta** comprobarlo contra un proyecto real de Supabase: se hace con el registro de aceptación de `docs/despliegue.md`.

## Consecuencias
- Cada consulta SQL nueva escrita a mano tiene que pasar por `runSql`, `nowMinus`, `nowPlus` y `affectedRows` cuando use alias en camelCase o funciones de fecha. La prueba de CI en PostgreSQL lo detecta si se olvida.
- El plan gratuito de Supabase pausa el proyecto tras una semana sin uso, no hace respaldos automáticos y da 500 MB de base y 1 GB de archivos. Para una demostración alcanza; para uso real hace falta un plan de pago o respaldos propios (`pg_dump`).
