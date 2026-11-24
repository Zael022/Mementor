# ADR 0007: seguimiento de instituciones por plataforma

Estado: implementación parcial, no lista para uso operativo completo.

El CRM de admisiones es institucional y mantiene sus propios permisos y tablas. El seguimiento de la relación MENTOR–institución usa rutas `/platform-crm`, autorizadas exclusivamente a `platform_admin`, sin ampliar permisos académicos. `Institution` sigue siendo la entidad maestra. Una fila de `platform_crm_accounts` por institución se crea solo mediante POST explícito; los contactos profesionales no crean usuarios. La auditoría de estos cambios usa el ámbito global y metadatos mínimos, sin notas ni contactos completos.

Las fichas tienen versión de escritura y la inicialización se serializa por institución. La creación de contactos usa una clave de reintento y un índice único por ficha. El estado de incorporación no modifica `Institution.status`. No se permite marcarla completada mientras falten verificaciones.

Pendiente antes del uso operativo: edición y eliminación de contactos, reglas aprobadas de conservación y limpieza, actividades, tareas, soporte, pasos verificables de incorporación, métricas, validación integral de aislamiento, y documentación y diagramas completos. No se envían comunicaciones ni se usa IA. No guardar datos reales de contactos hasta contar con esos controles de privacidad.
