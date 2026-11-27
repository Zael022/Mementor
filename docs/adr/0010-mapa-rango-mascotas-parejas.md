# ADR 0010 · Mapa del curso, rango de avance, mascotas y Parejas

**Estado:** aceptada · 2026-11-25

## Contexto
La ruta de lecciones era una lista numerada. Se pidió que el curso se sintiera como un recorrido, con una mascota que acompañe, un rango que muestre cuánto se avanzó y un juego de práctica por módulo. Todo eso tenía que hacerse sin tocar la nota, la racha ni el bono, sin datos de demostración y sin depender del color o de la animación para entender la información.

## Decisiones
1. **Rango de avance calculado, no guardado.**
   - Avance = (lecciones completadas + tareas entregadas) ÷ (lecciones publicadas + tareas publicadas).
   - Rangos «Luz»: Destello 0–19 %, Brillo 20–44 %, Luz 45–69 %, Estrella 70–99 %, Constelación 100 %. Sin nada publicado: «Sin rango todavía».
   - Se calcula con enteros (`done × 100 ≥ umbral × total`) para que cada umbral se cumpla exacto.
   - No hay tabla de rangos: si el docente despublica una lección, el rango se ajusta solo. La subida se detecta comparando el rango de antes y el de después en la misma respuesta (`rank.before/after/rankedUp`).
   - Mide avance, no rendimiento: no cambia la nota, el dominio ni la racha. En la analítica docente la lista sigue el orden alfabético, para que no se lea como un ranking.
2. **Mapa del curso = lista ordenada de enlaces reales con un camino decorativo encima.**
   - El orden es: módulo → tema → lecciones y tareas del tema → Parejas del módulo. Al final va «Tareas del curso», con las tareas sin tema. El docente elige el tema de una tarea (opcional).
   - Cada parada dice su estado en texto («Completada», «Continúa aquí», «Pendiente», «Entregada»). La forma del ícono también cambia; el color nunca es la única señal.
   - El camino SVG y Orbi tienen `aria-hidden`. El recorrido con el teclado es el orden de la lista.
   - El trazo se calcula en JavaScript a partir de la posición medida de cada nodo: zigzag en escritorio, vertical en móvil.
   - Al volver de una lección completada, el mapa se acerca y Orbi recorre el tramo con `MotionPathPlugin`. La parada recién completada se recuerda en `sessionStorage` (solo para animar; el avance real está en MySQL).
   - `MotionPathPlugin` va en su propio bloque (`vendor-gsap-camino`). Solo lo descarga la página del curso.
3. **Mascotas oficiales.**
   - Orbi (principal) y Pausa (bienestar) se dibujan en SVG dentro de la app, a partir de `docs/marca/mascotas/`. Cada estado cambia partes del mismo dibujo; no hay imágenes por estado.
   - Los textos están en `utils/mensajesMascota.js`: cortos, con datos reales y sin culpa ni urgencias falsas.
   - Preferencias por cuenta: `show_mascots` y `show_big_celebrations`. Si se ocultan, el mensaje importante queda como texto normal.
   - Nunca aparecen en evaluaciones ni en el quiz con bono.
   - La bienvenida de Pausa sale de la última actividad de aprendizaje real (lecciones, entregas, intentos, quizzes, práctica, Parejas, tutor y clases), con un umbral de 7 días; el inicio de sesión no cuenta.
4. **Sticker de papel (`OrbiSticker`).**
   - Animaciones: pegar, despegar, doblar, arrugar, alisar y volar. Cada una dura menos de 1 s, no bloquea la página y avisa con `onTerminar`.
   - Doblar usa dos capas HTML con perspectiva, porque un SVG no gira en 3D real.
   - El filtro de arrugado (`feTurbulence` + `feDisplacementMap`) solo existe mientras dura la animación. `will-change` también.
   - Los identificadores salen de `useId`, así que dos stickers no chocan. Con «Menos movimiento» solo hay un fundido o el cambio directo.
5. **Parejas como práctica segura.**
   - La fuente son preguntas de evaluaciones del módulo cuya clave ya puede ver ese estudiante (evaluación cerrada o intentos agotados), con respuestas distintas entre sí. Así el juego nunca filtra respuestas de una evaluación abierta.
   - Tablero de 6 u 8 parejas (mínimo 3). El tablero y las parejas viven en el servidor; el cliente solo recibe el texto de la carta que voltea.
   - El tiempo lo mide el servidor con `clock.js`.
   - No da bono ni cuenta para la racha. Sí cuenta como actividad de aprendizaje para la bienvenida de Pausa.
   - Las partidas entran en la copia de datos propios y se borran con la baja de la cuenta.

## Consecuencias
- El rango siempre coincide con lo publicado, pero se calcula en cada consulta (consultas agregadas por curso, sin N+1).
- La interfaz suma un bloque de CSS propio (`Recorrido.css`) que se carga con las páginas que lo usan. La carga inicial casi no cambia (98 300 bytes comprimidos frente a 97 983 en `main`).
- Las capturas de `docs/mockups` incluyen el mapa (13b), Parejas (18b) y la celebración de rango (27b).
