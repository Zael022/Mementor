# Workflows de n8n de MENTOR AI

Los tres workflows repiten procesos del sistema como soluciones de negocio. Se importan en n8n (Cloud o instalación propia) desde **Workflows → Import from file**.

## Antes de activarlos
1. En el backend define `N8N_INTEGRATION_KEY`, una clave aleatoria de al menos 32 caracteres. n8n la envía en el encabezado `x-integration-key`.
2. En n8n crea dos credenciales:
   - **Header Auth** llamada «MENTOR integración», con Name `x-integration-key` y como Value la misma clave. Asígnala a los nodos HTTP que llaman a MENTOR y al webhook del workflow 3.
   - **SMTP** con la cuenta de correo que enviará los avisos. Asígnala a los nodos «Enviar…».
3. En el nodo **Configuración** de cada workflow cambia `apiUrl` por la URL pública de la API (por ejemplo `https://mentor-api.onrender.com/api/v1`) y, en el workflow 1, `correoAviso`.
4. Activa el workflow. Para el 3, copia la URL de producción del webhook en `N8N_DELETION_WEBHOOK_URL` y pon `DELETION_PROCESSOR=n8n` en el backend.

Cada llamada que llega desde n8n queda en la tabla `integration_runs`.

## 1. Tipo de cambio diario (`01-tipo-de-cambio.json`)
- **Problema de negocio:** la institución paga la IA en dólares y necesita ver el costo en colones con un tipo de cambio oficial y actualizado.
- **Disparador:** todos los días a las 8:00 (hora de Costa Rica).
- **Pasos:**
  1. Consulta la API pública del Ministerio de Hacienda, que publica el tipo de cambio de referencia del BCCR.
  2. Extrae la compra, la venta y la fecha.
  3. Lo guarda en MENTOR con `POST /integrations/exchange-rates`.
  4. Envía un resumen por correo a la administración.
- **En el sistema:** la página Consumo IA muestra el tipo de cambio y el costo estimado en colones.

## 2. Recordatorios de tareas y racha (`02-recordatorios.json`)
- **Problema de negocio:** evitar entregas tardías y que el estudiante pierda su racha diaria por olvido.
- **Disparador:** todos los días a las 16:00.
- **Pasos:**
  1. Pide a MENTOR la lista con `GET /integrations/daily-reminders`. Incluye a quienes tienen tareas que vencen en 36 horas sin entregar o la racha en riesgo hoy.
  2. Separa a cada persona.
  3. Redacta un mensaje con sus pendientes.
  4. Lo envía a su correo.
- **Datos personales:** solo el correo, el nombre y los títulos de los pendientes, como indica la política de privacidad.

## 3. Baja de cuenta y eliminación de datos (`03-baja-de-cuenta.json`)
- **Problema de negocio:** cumplir el derecho de supresión de la Ley 8968, con evidencia y aviso a la persona.
- **Disparador:** webhook. MENTOR lo llama cuando alguien confirma su baja con su contraseña (con `DELETION_PROCESSOR=n8n`).
- **Pasos:**
  1. Recibe la solicitud.
  2. Pide a MENTOR que la procese con `POST /integrations/deletion-requests/:id/process`. MENTOR anonimiza la cuenta, borra lo personal y conserva lo académico con su motivo.
  3. Si quedó completada, envía el correo de confirmación.
  4. Registra que el aviso salió con `POST /integrations/deletion-requests/:id/notified`.
- **Respaldo:** si n8n no responde, MENTOR procesa la baja por su cuenta y envía el aviso, para que ninguna solicitud quede esperando.
