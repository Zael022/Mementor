# Revisión parcial OWASP Top 10:2025

Fecha: 2026-11-24. Esta revisión no es una certificación ni cubre todos los flujos. Referencia: https://top10.owasp.org/2025/. No se realizaron pruebas contra proveedores externos reales.

| Categoría | Estado y evidencia | Riesgo residual y siguiente paso |
| --- | --- | --- |
| A01 Control de acceso | Inspección de `driveSyncService`: se comprueba lectura por la identidad central y la institución del vínculo. Las pruebas existentes usan un doble de Google. | El ID de carpeta no demuestra pertenencia: falta aprobación independiente de plataforma, revisión de carpetas existentes y prueba de aislamiento integral. No equivale a validar IAM real. Revisar destinos salientes y SSRF. |
| A02 Configuración | Lint y build frontend ejecutados. | Falta CSP del documento frontend, revisión integral de CORS, arranque, proxy y límites distribuidos. |
| A03 Cadena de suministro | npm audit: frontend 0; backend 7 moderadas, 2 de producción. `npm audit fix` no cambió el resultado. `sequelize` incluye `uuid`; las demás pasan por dependencias de desarrollo de `sequelize-cli`. | Desarrollo debe evaluar alcanzabilidad de GHSA-w5hq-g745-h8pq y los avisos GHSA-3g3m-2fjr-6pw4 y GHSA-g3hv-75wg-m249; revisar actualizaciones compatibles. El arreglo forzado ofrece Sequelize 3 y no se aplicó. |
| A04 Criptografía | `authService` limita contraseñas nuevas a 72 bytes UTF-8. `agentRegistry` ya redactaba texto antes del proveedor; existe prueba con doble. | Los hashes bcrypt antiguos no indican la longitud original. No se modifican; recomendar cambio de contraseña. Los scrypt largos conservan su hash y se verifican sin truncar, hasta un cambio voluntario. La detección de datos es limitada, no anonimización completa. |
| A05 Inyección | No se completó una revisión integral. | Revisar consultas reales MySQL, Markdown, URLs y superficies XSS; no declarar protección integral. |
| A06 Diseño inseguro | Se mantuvieron transacciones existentes y se añadieron bloqueos a enlaces de autenticación. | Revisar cuotas, carreras y casos de abuso restantes. |
| A07 Autenticación | `passwordResetService` y `authService` leen enlaces con bloqueo en transacción; revocación y auditoría siguen en la misma transacción. | Verificar concurrencia real, otros enlaces, bloqueos de login y límites por cuenta. |
| A08 Integridad | `fileSignature` verifica cabeceras; insuficiente para OOXML. | Falta validar estructura interna, expansión y entradas de ZIP; evaluar límites de extracción y escaneo real. |
| A09 Registro y alertas | Existe bitácora; no se ha demostrado un canal de alertas operativo. | Implementar eventos sin secretos, umbrales, transporte configurable y pruebas con dobles. |
| A10 Excepciones | `agentRunner` rechaza propiedades heredadas y valida forma básica del agente antes de consultar roles. | Revisar fallos de proveedores, almacenamiento y auditoría; probar escenarios excepcionales restantes. |

No hay migraciones ni cambios de diseño en esta intervención. Antes de producción, priorizar la autorización independiente de Drive y la validación de contenedores OOXML. Debe asignarse un responsable de desarrollo para los avisos de dependencias y revisarse cuando Sequelize y sequelize-cli publiquen versiones compatibles.

Verificación realizada: lint en ambos proyectos; backend `npm test` con MySQL aislado: 162 pruebas correctas, incluida recuperación simultánea; posteriormente `tests/security.test.js`: 9 correctas, incluida activación simultánea. Frontend `npm test`: 51 correctas y `npm run build`: correcto. Playwright `e2e/acceso.spec.js`: tres pruebas correctas en escritorio y móvil con proveedor local doble. No se ejecutó toda la suite e2e. No se probó IAM real ni servicios externos con datos reales.
