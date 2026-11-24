# Seguridad Express complementaria: avance

Revisión del código actual y de las 27 diapositivas de `Seguridad_Express (3).pptx`, el 24 de noviembre de 2026. El encargo no está terminado; esta matriz no afirma cumplimiento ni certificación.

| Diapositivas | Estado inicial y decisión | Evidencia y pendiente |
| --- | --- | --- |
| 8–10 y 27, contraseñas | bcrypt requerido por las reglas del repositorio; se comprueba límite de 72 bytes para nuevas contraseñas. El mínimo actual es 10 y se exigen letras y números. | `authService.js`, `security.js`. Pendiente mínimo 15, eliminar composición, comparación con fuente apropiada de contraseñas comprometidas, tratamiento Unicode y textos. No se ha afirmado conformidad NIST. |
| 9, coste de hash | BCRYPT_ROUNDS podía fijarse por debajo de 10 fuera de test. Ahora usa 12 si se configura un valor inferior a 10. | `security.js`, `securityUnits.test.js`: prueba unitaria de coste y verificación. Los hashes existentes no se convierten automáticamente. |
| 11, cifrado | No se ha integrado un campo que requiera AES-GCM. | Pendiente cifrado versionado y gestión de claves para MFA; no existe fallback en claro que se presente como solución. |
| 13–16, ciclo de vida y MFA | Activación y recuperación tienen bloqueo transaccional; el login ya usa sesión nueva. El login para usuario inexistente generaba un hash; ahora verifica contra un hash ficticio representativo inicializado una vez. | `authService.js`, `security.js`; pruebas unitarias. Falta MFA TOTP integral, recuperación segura, avisos, controles concurrentes de intentos y verificación de correo nuevo. No se debe considerar MFA disponible. |
| 18–23, sesiones y JWT | Cookie HttpOnly y JWT respaldado por sesión revocable en MySQL; se conserva este diseño sin refresh paralelo. Se exige que el JWT verificado contenga vencimiento, sujeto e identificador de sesión. | `jwt.js`, `securityUnits.test.js`; no se ha añadido `aud` ni definido su transición. La respuesta para cuentas inexistentes no garantiza tiempos constantes de red. |
| 25–27, autorización y Express | Se mantienen las defensas existentes. | Pendiente revisar integralmente acceso, CSP frontend, CORS, eventos y alertas; los riesgos de Drive y OOXML de la revisión anterior siguen abiertos. |

Fuentes técnicas: [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) y [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html). El límite bcrypt no admite 64 caracteres arbitrarios de varios bytes; por ello no se declara cumplimiento completo de la política NIST.

No se añadieron dependencias, migraciones ni variables de configuración. Las pruebas no envían correos ni contactan proveedores reales.

Verificación: lint backend y frontend, 166 pruebas backend con MySQL local temporal, 51 pruebas frontend, compilación frontend y tres pruebas de acceso Playwright correctas. Las dos bases temporales se eliminaron. No se ejecutó toda la suite e2e ni se probó correo real.
