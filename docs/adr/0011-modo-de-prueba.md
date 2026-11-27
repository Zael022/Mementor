# ADR 0011 · Modo de prueba: cuentas por rol y acceso rápido

**Estado:** aceptada · 2026-11-26 (ampliada el mismo día con el curso simulado y el recorrido guiado). Reemplaza la parte de la regla 4 (`CLAUDE.md`) que prohibía las cuentas de prueba.

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
5. **Curso de prueba con actividad simulada** (agregado el mismo día a pedido de Daisy):
   - «Matemática 7° · curso de prueba» tiene dos módulos, cuatro temas con prerrequisitos y ocho lecciones con contenido real. También trae:
     - tres evaluaciones;
     - un quiz con bono, que además es el banco de la práctica diaria;
     - tres tareas, un anuncio, una clase en vivo y trabajo en clase.
   - La estudiante de prueba va por la mitad del curso: 4 de 8 lecciones, el repaso de fracciones resuelto (Parejas queda disponible), una tarea calificada con retroalimentación, 4 días de racha que hoy debe mantener y un plan de estudio.
   - Dos compañeros simulados («Sofía Mora (prueba)» y «Diego Vargas (prueba)») dan contexto a la analítica docente y a la tabla del quiz. No tienen acceso rápido.
   - Todo se crea con los mismos servicios que usa la interfaz (`demoCourseService.js`, contenido en `demoContent.js`), así que las notas, el dominio, la racha y el rango salen de los cálculos reales. Los días pasados se simulan moviendo el reloj de la app (`clock.now`) solo mientras se crea el historial.
   - Se crea una vez. `npm run demo:cuentas -- --reiniciar` archiva el curso anterior (sin borrar historial) y arma uno nuevo.
   - No se simulan respuestas del tutor IA: sin clave de IA, el tutor sigue diciendo que no está configurado (regla 7).
   - Fuera del modo de prueba no se precargan cursos ni contenido académico.
6. **Recorrido guiado** (`RecorridoGuiado.jsx`, pasos en `utils/pasosRecorrido.js`):
   - Resalta cada función y explica cómo ayuda a estudiar. Hay 3 pasos en el inicio del estudiante y 10 en la página del curso, y el recorrido cambia de pestaña solo.
   - Se abre automáticamente en cada inicio de sesión con una cuenta de prueba (al cerrarlo se recuerda hasta la siguiente entrada; cambio del 2026-11-27). Cualquiera puede verlo con «¿Cómo me ayuda esta página?».
   - Va en un portal sobre `<body>`, no bloquea la página y Escape lo cierra; las flechas avanzan o retroceden y al cerrar el foco vuelve al botón.
   - Respeta «Menos movimiento» y «Mostrar mascotas» (Orbi narra). Si un paso no tiene qué mostrar, se salta.

## Consecuencias
- Probar cada rol toma un clic. El riesgo queda limitado a entornos con `DEMO_MODE=on`, y el backend lo avisa en la consola al arrancar.
- En Render, encender el modo para una demostración y apagarlo después cierra todas las sesiones de prueba.
