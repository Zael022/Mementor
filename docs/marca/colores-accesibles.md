# Colores de acciones y accesibilidad

La UI conserva identidad azul/naranja/lima, logo y tipografías. El naranja decorativo de la marca no debe usarse automáticamente como fondo de texto blanco.

| Uso | Fondo | Texto | Decisión |
| --- | --- | --- | --- |
| Acción normal | `#b83d0b` | `#ffffff` | Oscurecer respecto a `#f0591a` para superar 4,5:1 |
| Hover | `#96320b` | `#ffffff` | Mantener contraste en interacción |
| Alto contraste | `#c2410c` | `#ffffff` | Mantener variante existente |
| Hover alto contraste | `#9a3412` | `#ffffff` | Mantener variante existente |
| Campo claro | borde `#7480a1` | panel blanco | Reforzar la delimitación |
| Campo oscuro | borde `#7d8ac0` | panel oscuro | Reforzar la delimitación |
| Foco oscuro | `#ffb38a` | panel oscuro | Diferenciar foco visible |

La prueba de navegador calcula luminancia relativa sRGB sobre los estilos reales. Capturas reproducibles por tema en `docs/mockups/crm-*`. No usar el texto de una captura como sustituto de medición ni afirmar conformidad completa con WCAG. Revisión manual de lector de pantalla pendiente.

Resultados de 12 estados por dispositivo (claro/oscuro × normal/alto contraste × normal/hover/foco), con movimiento reducido para medir estilos estables: mínimos 5,178:1 botón, 3,929:1 borde de campo, 8,584:1 texto seleccionado, 4,792:1 indicador seleccionado y 5,660:1 foco. Evidencia numérica: `docs/mockups/contraste-crm-escritorio.json` y `contraste-crm-movil.json`. Estos son controles de las pantallas verificadas, no una auditoría integral de la plataforma. Referencias: [contraste W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [alternativa a arrastrar](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) y [objetivos táctiles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
