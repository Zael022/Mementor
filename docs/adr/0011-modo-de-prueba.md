# ADR 0011 · Modo de prueba: cuentas por rol y acceso rápido

**Estado:** aceptada · 2026-11-26. Reemplaza la parte de la regla 4 (`CLAUDE.md`) que prohibía las cuentas de prueba.

## Contexto
Para mostrar y probar la plataforma (por ejemplo, ante el profesor) hacía falta entrar rápido con cada rol. Antes no había cuentas de prueba, así que cada base nueva quedaba vacía hasta crear la institución y las invitaciones a mano. Una contraseña conocida o un botón para entrar sin contraseña son peligrosos si quedan activos en un uso real.

## Decisiones
1. **Un interruptor:** `DEMO_MODE` (`on`, `true`, `1` o `si` lo encienden). Viene apagado en `.env.example`.
2. **Cuentas:**
   - Una por rol: estudiante, docente, admin. de institución, auditoría y admin. de plataforma.
   - Viven en una «Institución de prueba» (la de plataforma no tiene institución).
   - Usan correos `@prueba.mentorai.test`; el dominio `.test` nunca recibe correo real.
   - Contraseña común: `DEMO_PASSWORD`, o `MentorPrueba2026` si no se configura.
   - Se crean o reparan al arrancar el backend con el modo encendido, o con `npm run demo:cuentas`. Repetir no duplica nada; la contraseña solo se cambia si cambió `DEMO_PASSWORD`.
   - Los términos quedan aceptados para entrar directo.
3. **Marca en la base:** `users.is_demo` (migración `20261127000100-cuentas-de-prueba`).
   - Con el modo apagado, una cuenta marcada no puede iniciar sesión (ni con contraseña) y sus sesiones abiertas dejan de valer.
   - Nunca se toma una cuenta real que use el mismo correo: el proceso se detiene con un error.
   - El admin. de plataforma de prueba no bloquea `npm run admin:create`, que solo cuenta administradores reales.
4. **Acceso rápido:**
   - `GET /auth/demo` dice si el modo está encendido y con qué roles se puede entrar.
   - `POST /auth/demo { role }` crea la sesión de la cuenta de ese rol sin contraseña, con el mismo límite de intentos que el inicio de sesión y auditoría `auth.demo_login`. Con el modo apagado responde 404.
   - En el frontend, `AccesoRapido.jsx` muestra un enlace pequeño y plegado («Acceso rápido de prueba») solo si el backend lo permite. No hay contraseñas en el código del navegador.
5. **Contenido:** no se precargan cursos ni contenido académico; eso sigue naciendo desde la interfaz.

## Consecuencias
- Probar cada rol toma un clic. El riesgo queda limitado a entornos con `DEMO_MODE=on`, y el backend lo avisa en la consola al arrancar.
- En Render, encender el modo para una demostración y apagarlo después cierra todas las sesiones de prueba.
