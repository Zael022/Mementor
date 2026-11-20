import { holdLease, releaseLease } from './coordination.js';
import { reconcileUploads } from './fileCleanup.js';
import { runMaintenance } from './knowledgeService.js';
import { syncAllLinks } from './driveSyncService.js';
import { purgeExpiredRateLimits } from './rateLimitStore.js';
import { runRetention } from './retentionService.js';

const LEASE = 'tareas-periodicas';
const LEASE_TTL_MS = 90000;

// Tareas periódicas del servidor: revisan importaciones, limpian recursos, aplican la retención y sincronizan Drive.
// Con varias instancias, solo la que tiene el turno en MySQL las ejecuta; si se apaga, otra lo toma al vencer.
export function startBackgroundJobs() {
  const minutes = (name, fallback) => Math.max(0, Number(process.env[name] ?? fallback));
  const timers = [];
  const every = (ms, task, label) => {
    if (!ms) return;
    let busy = false;
    timers.push(setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        if (await holdLease(LEASE, LEASE_TTL_MS)) await task();
      } catch (error) {
        console.error(JSON.stringify({ evento: 'tarea.fallo', tarea: label, codigo: error?.code || error?.name }));
      } finally {
        busy = false;
      }
    }, ms).unref());
  };
  every(20000, runMaintenance, 'de indexación');
  every(minutes('UPLOAD_RECONCILE_MINUTES', 60) * 60000, reconcileUploads, 'de archivos');
  every(minutes('DRIVE_SYNC_INTERVAL_MINUTES', 0) * 60000, syncAllLinks, 'de Drive');
  every(minutes('RETENTION_INTERVAL_MINUTES', 1440) * 60000, async () => {
    const result = await runRetention();
    await purgeExpiredRateLimits();
    console.info(JSON.stringify({ evento: 'retencion', ...result }));
  }, 'de retención');
  return async () => {
    timers.forEach(clearInterval);
    await releaseLease(LEASE).catch(() => {});
  };
}
