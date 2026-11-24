import { sequelize } from '../config/database.js';
import { retainCrmData } from './crmPrivacyService.js';
import { reconcilePendingDeletions } from './governanceService.js';

// Retención de datos: cuánto tiempo se guarda cada cosa se configura en .env (0 = no borrar).
const days = (name, fallback) => Math.max(0, Number(process.env[name] ?? fallback));

// Borra el texto de versiones reemplazadas o retiradas que ninguna respuesta cita y cuya limpieza remota terminó.
// Las versiones citadas lo conservan para que la cita se pueda seguir abriendo.
export async function purgeUncitedVersionText() {
  const keepDays = days('VERSION_TEXT_RETENTION_DAYS', 30);
  if (!keepDays) return 0;
  const [result] = await sequelize.query(
    `UPDATE source_versions v
        LEFT JOIN ai_message_sources ms ON ms.source_version_id = v.id
        SET v.text_content = '', v.pages_json = NULL, v.text_purged_at = NOW()
      WHERE v.state IN ('superseded', 'retired', 'error')
        AND v.remote_cleanup IN ('none', 'done')
        AND v.text_purged_at IS NULL
        AND v.updated_at < NOW() - INTERVAL :keepDays DAY
        AND ms.id IS NULL`,
    { replacements: { keepDays } },
  );
  return result?.affectedRows ?? 0;
}

// Resume por mes el consumo con más antigüedad que el plazo de detalle y borra esas filas.
export async function rollupUsage() {
  const keepDays = days('AI_USAGE_DETAIL_DAYS', 90);
  if (!keepDays) return 0;
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO ai_usage_monthly (institution_id, month, provider, model, outcome, events, input_tokens, output_tokens, latency_ms_total)
       SELECT institution_id, DATE_FORMAT(created_at, '%Y-%m'), COALESCE(provider, ''), COALESCE(model, ''), outcome,
              COUNT(*), COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0), COALESCE(SUM(latency_ms), 0)
         FROM ai_usage_events
        WHERE created_at < NOW() - INTERVAL :keepDays DAY AND outcome <> 'reserved'
        GROUP BY institution_id, DATE_FORMAT(created_at, '%Y-%m'), COALESCE(provider, ''), COALESCE(model, ''), outcome
       ON DUPLICATE KEY UPDATE
         events = events + VALUES(events), input_tokens = input_tokens + VALUES(input_tokens),
         output_tokens = output_tokens + VALUES(output_tokens), latency_ms_total = latency_ms_total + VALUES(latency_ms_total)`,
      { replacements: { keepDays }, transaction },
    );
    // Las reservas que quedaron abiertas por un apagado inesperado también se cierran aquí.
    const [result] = await sequelize.query('DELETE FROM ai_usage_events WHERE created_at < NOW() - INTERVAL :keepDays DAY', {
      replacements: { keepDays }, transaction,
    });
    return result?.affectedRows ?? 0;
  });
}

// Borra conversaciones sin actividad durante el plazo configurado (mensajes y citas se borran en cascada).
export async function purgeOldConversations() {
  const keepDays = days('AI_CHAT_RETENTION_DAYS', 365);
  if (!keepDays) return 0;
  const [result] = await sequelize.query(
    `DELETE t FROM ai_threads t
      WHERE t.created_at < NOW() - INTERVAL :keepDays DAY
        AND NOT EXISTS (SELECT 1 FROM ai_messages m WHERE m.thread_id = t.id AND m.created_at >= NOW() - INTERVAL :keepDays DAY)`,
    { replacements: { keepDays } },
  );
  return result?.affectedRows ?? 0;
}

// Borra el registro detallado de los asistentes de IA (quién, curso, modelo y tokens) pasado el mismo plazo
// del detalle de consumo. Las cuotas solo miran las últimas 24 horas, así que no se ven afectadas.
export async function purgeOldAgentRuns() {
  const keepDays = days('AI_USAGE_DETAIL_DAYS', 90);
  if (!keepDays) return 0;
  const [result] = await sequelize.query('DELETE FROM agent_runs WHERE created_at < NOW() - INTERVAL :keepDays DAY', { replacements: { keepDays } });
  return result?.affectedRows ?? 0;
}

// Ejecuta todas las reglas de retención y devuelve cuántas filas tocó cada una.
export async function runRetention() {
  await retainCrmData();
  return {
    versionTexts: await purgeUncitedVersionText(),
    usageRows: await rollupUsage(),
    conversations: await purgeOldConversations(),
    agentRuns: await purgeOldAgentRuns(),
    pendingDeletions: await reconcilePendingDeletions(),
  };
}
