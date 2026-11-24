import { runExclusive } from './coordination.js';
import { reconcileUploads } from './fileCleanup.js';
import { runMaintenance } from './knowledgeService.js';
import { syncAllLinks } from './driveSyncService.js';
import { purgeExpiredRateLimits } from './rateLimitStore.js';
import { runRetention } from './retentionService.js';

const LEASE_TTL_MS = 90000;

// Tareas periódicas del servidor: revisan importaciones, limpian recursos, aplican la retención y sincronizan Drive.
// Cada tarea tiene su propio turno en MySQL, renovado con un latido mientras corre: con varias instancias,
// una misma tarea nunca se ejecuta dos veces a la vez, y si la instancia se apaga otra la toma al vencer.
export function startBackgroundJobs() {
  const minutes = (name, fallback) => Math.max(0, Number(process.env[name] ?? fallback));
  const timers = [];
  const every = (ms, task, label, key) => {
    if (!ms) return;
    let busy = false;
    timers.push(setInterval(async () => {
      if (busy) return;
      busy = true;
      const startedAt = Date.now();
      try {
        const result = await runExclusive(`tarea:${key}`, LEASE_TTL_MS, task, {
          onLost: () => console.warn(JSON.stringify({ evento: 'turno_perdido', tarea: key })),
        });
        // Solo se registran las ejecuciones lentas o con turno perdido, para no llenar el registro.
        if (result.ran && (result.lostLease || Date.now() - startedAt > 5000)) console.info(JSON.stringify({ evento: 'tarea_periodica', tarea: key, ms: Date.now() - startedAt, turnoPerdido: result.lostLease }));
      } catch (error) {
        console.error(`Tarea ${label} falló:`, error?.message);
      } finally {
        busy = false;
      }
    }, ms).unref());
  };
  every(20000, runMaintenance, 'de indexación', 'indexacion');
  every(minutes('UPLOAD_RECONCILE_MINUTES', 60) * 60000, reconcileUploads, 'de archivos', 'archivos');
  every(minutes('DRIVE_SYNC_INTERVAL_MINUTES', 0) * 60000, syncAllLinks, 'de Drive', 'drive');
  every(minutes('RETENTION_INTERVAL_MINUTES', 1440) * 60000, async () => {
    const result = await runRetention();
    await purgeExpiredRateLimits();
    console.info(JSON.stringify({ evento: 'retencion', ...result }));
  }, 'de retención', 'retencion');
  // Cada turno se libera al terminar su tarea; al apagar solo hace falta detener los temporizadores.
  return async () => {
    timers.forEach(clearInterval);
  };
}
