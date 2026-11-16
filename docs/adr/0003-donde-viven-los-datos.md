# ADR 0003 · Dónde viven los datos

**Estado:** aceptada · 2026-11-16

## Decisión
- **MySQL es la fuente de verdad**: usuarios, matrículas, notas, permisos, fuentes, versiones (con su texto extraído), conversaciones y citas. Toda autorización se resuelve aquí.
- **Cloud Storage (bucket privado)** guarda una copia de texto plano de cada versión publicada, con nombre estable `RAG_GCS_PREFIX/i{institución}/c{curso}/s{fuente}/v{versión}.txt`. No se suben los archivos originales.
- **RAG Engine** guarda el índice de un corpus por curso. La metadata de corpus y archivos vive en RagManagedDb (Spanner administrado por Google, que se cobra al proyecto).
- **Google Drive** conserva los originales; MENTOR solo lee con alcance `drive.readonly`.
- **Proveedor de generación** recibe solo los fragmentos autorizados de la consulta y el historial reciente del hilo, sin datos de identidad.
- Disco local (`backend/storage/uploads`) guarda los archivos subidos por docentes.

## Por qué texto extraído y no el original
Así el pasaje que devuelve RAG Engine se puede contrastar con la versión guardada en MySQL. La cita se arma con el texto de MySQL, no con el de Google, y se copian menos datos a la nube.

## Consecuencias
- Si se retira una fuente, deja de usarse en el acto (filtro en MySQL). La limpieza remota se reintenta sin bloquear.
- La limpieza solo borra lo que MENTOR registró: objetos dentro del prefijo, archivos del corpus cuyo nombre guardó y archivos locales con el patrón de nombre que genera la carga.
- La región de Google Cloud define dónde se procesan los fragmentos. Elegirla es responsabilidad del operador (ver `docs/gobernanza/inventario-de-datos.md`).
