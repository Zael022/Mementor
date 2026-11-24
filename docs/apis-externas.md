# APIs externas que consume MENTOR AI

Todas se llaman desde el backend (`backend/src/services/external/`). Cada llamada tiene un tiempo límite de 8 segundos y maneja sus errores con un mensaje claro (503 `EXTERNAL_UNAVAILABLE`). Queda registrada en la tabla `integration_runs`, y ninguna credencial llega al navegador.

| API | Para qué se usa | Endpoint externo | Credencial | Dónde se ve |
| --- | --- | --- | --- | --- |
| Ministerio de Hacienda: tipo de cambio | Compra y venta del dólar (referencia del BCCR) para estimar el costo de la IA en colones | `https://api.hacienda.go.cr/indicadores/tc/dolar` (`EXCHANGE_RATE_URL`) | No requiere | Consumo IA (administración) y workflow 1 de n8n |
| Nager.Date: feriados | Feriados de Costa Rica en el calendario semanal | `https://date.nager.at/api/v3/PublicHolidays/{año}/CR` (`HOLIDAYS_URL`) | No requiere | Calendario |
| Proveedor de IA (Anthropic u otro compatible) | Tutor y agentes | `AI_BASE_URL` | `AI_API_KEY` | Tutor y Asistentes IA |
| Google Cloud: RAG Engine, Storage y Drive (opcional) | Búsqueda de fuentes del tutor y sincronización con Drive | APIs de Google con ADC | Cuenta de servicio (ADC) | Fuentes del tutor, Drive |

## Comportamiento ante fallas
- **Tipo de cambio:** se guarda uno por día en `exchange_rates`. Si la API falla, se muestra el último guardado marcado como desactualizado. Si nunca hubo uno, responde 503.
- **Feriados:** se guardan 24 horas en memoria. Si la API falla, el calendario sigue funcionando sin la marca de feriado.
- **El costo en colones** se calcula solo si se configuran `AI_PRICE_INPUT_USD_PER_MTOK` y `AI_PRICE_OUTPUT_USD_PER_MTOK`. No se inventan tarifas.

Para consumos de varios modelos, `AI_MODEL_PRICES_JSON` permite tarifas por proveedor/modelo. Las variables anteriores solo aplican al modelo actualmente configurado. Si falta tarifa o consumo conocido de un grupo, su costo y el total comparable son desconocidos. Se etiqueta como estimación con tarifas de consulta, no factura histórica. El CRM reutiliza el mismo `aiProvider`; no hay envío SMTP, WhatsApp o n8n de borradores. Las integraciones futuras requieren outbox y permisos institucionales (backlog en `CRM.md`). Tener configuración no acredita conectividad; no se llama a un proveedor de pago al abrir páginas.

## Endpoints propios
- `GET /api/v1/indicators/exchange-rate`: cualquier persona con sesión.
- `GET /api/v1/indicators/holidays?year=2026`: cualquier persona con sesión.
- `GET /api/v1/institution/ai-cost?days=30`: administración y auditoría.
- Para n8n, con `x-integration-key`:
  - `POST /api/v1/integrations/exchange-rates`
  - `GET /api/v1/integrations/daily-reminders`
  - `POST /api/v1/integrations/deletion-requests/:id/process`
  - `POST /api/v1/integrations/deletion-requests/:id/notified`

## Pruebas
`backend/tests/integrations.test.js` simula las respuestas externas y comprueba:
- las dos formas de respuesta de Hacienda;
- la caché diaria y el respaldo con el último dato;
- el tiempo de espera y su registro en la bitácora;
- que el costo no se calcula sin tarifas;
- la clave de n8n;
- los recordatorios;
- el flujo completo de baja vía n8n.
