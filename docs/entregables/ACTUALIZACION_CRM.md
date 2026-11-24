# Fuentes de actualización de entregables para CRM

Fecha: 2026-11-20. Los archivos Word y PDF existentes no fueron regenerados en esta sesión. `py -0p` informó que no hay Python instalado; no se encontró LibreOffice ni el cargador de dependencias de documentos necesario para usar el renderer empaquetado. Se extrajo el texto del documento original del taller mediante XML para contrastar requisitos; no se evaluó su diseño.

Fuentes actualizadas: `docs/CRM.md`, ADR 0006, contratos de API, inventario/riesgos, `docs/datos/modelo.json`, diccionario y SVG desde migraciones, capturas `docs/mockups/crm-*`. `frontend/e2e/crm.spec.js` reproduce la captura de ficha y las combinaciones escritorio/móvil, claro/oscuro, normal/alto contraste. `backend/src/scripts/exportDataModel.js` reproduce el modelo desde una base aislada migrada. El ajuste medido del color de acciones se registra en `docs/marca/colores-accesibles.md`.

Pendientes exactos para un entorno con renderer de documentos:

- `Modelo_de_datos_MENTOR_AI.docx` y `.pdf`: incorporar ocho tablas CRM y diagrama adicional, actualizar conteos y campos desde las fuentes generadas.
- `Anteproyecto_MENTOR_AI.docx` y `.pdf`: incorporar alcance, historias, permisos, flujos y capturas de admisiones.
- `Libro_de_marca_MENTOR_AI.docx` y `.pdf`: actualizar naranja de acciones y combinaciones de contraste de la interfaz; conservar el logo.
- `Plan_de_Produccion_MENTOR_AI.docx` y `.pdf`: añadir migraciones CRM, privacidad/retención, cuotas/modelos, procedimientos de prueba y backlog de integraciones sin enviar ni desplegar.

Después de actualizar cada Word, ejecutar `render_docx.py`, inspeccionar todas sus páginas y generar el PDF correspondiente. No considerar los binarios viejos como evidencia de la implementación CRM. No se afirma una evaluación integral WCAG, cumplimiento legal, despliegue o verificación real de proveedores.
