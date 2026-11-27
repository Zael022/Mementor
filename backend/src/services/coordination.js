import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { sequelize, isPostgres } from '../config/database.js';
import { nowPlus } from '../utils/sql.js';

// Identifica a esta instancia del backend mientras está encendida.
export const INSTANCE_ID = randomUUID();

// Toma o renueva un turno con vencimiento. Devuelve true si esta instancia lo tiene.
// Si la instancia que lo tenía se apaga, otra lo toma cuando vence.
export async function holdLease(name, ttlMs, owner = INSTANCE_ID) {
  // Crea la fila del turno si no existe (sin error si ya está).
  const crear = isPostgres
    ? 'INSERT INTO job_leases (name, owner, expires_at) VALUES (:name, NULL, NULL) ON CONFLICT (name) DO NOTHING'
    : 'INSERT IGNORE INTO job_leases (name, owner, expires_at) VALUES (:name, NULL, NULL)';
  await sequelize.query(crear, { replacements: { name } });
  await sequelize.query(
    `UPDATE job_leases SET owner = :owner, expires_at = ${nowPlus(':micro', 'MICROSECOND')}
      WHERE name = :name AND (owner = :owner OR owner IS NULL OR expires_at IS NULL OR expires_at < CURRENT_TIMESTAMP(3))`,
    { replacements: { name, owner, micro: Math.round(ttlMs * 1000) } },
  );
  const [row] = await sequelize.query('SELECT owner FROM job_leases WHERE name = :name', { replacements: { name }, type: QueryTypes.SELECT });
  return row?.owner === owner;
}

// Libera el turno al apagar la instancia para que otra lo tome de inmediato.
export async function releaseLease(name, owner = INSTANCE_ID) {
  await sequelize.query('UPDATE job_leases SET owner = NULL, expires_at = NULL WHERE name = :name AND owner = :owner', { replacements: { name, owner } });
}

// Ejecuta una tarea solo si esta instancia tiene su turno, y lo renueva mientras corre (latido cada tercio
// del vencimiento). Así una tarea que dura más que el vencimiento no se ejecuta a la vez en otra instancia.
// Si el latido no logra renovar (por ejemplo, la base no respondió a tiempo y otra instancia tomó el turno),
// se avisa con signal.aborted para que la tarea se detenga en su siguiente punto seguro.
export async function runExclusive(name, ttlMs, task, { owner = INSTANCE_ID, onLost } = {}) {
  if (!(await holdLease(name, ttlMs, owner))) return { ran: false };
  const controller = new AbortController();
  let renewing = Promise.resolve();
  const heartbeat = setInterval(() => {
    renewing = holdLease(name, ttlMs, owner)
      .then((kept) => {
        if (!kept && !controller.signal.aborted) {
          controller.abort();
          onLost?.();
        }
      })
      .catch(() => {});
  }, Math.max(250, Math.floor(ttlMs / 3)));
  heartbeat.unref?.();
  try {
    await task(controller.signal);
    return { ran: true, lostLease: controller.signal.aborted };
  } finally {
    clearInterval(heartbeat);
    await renewing;
    // Al terminar se libera para que la próxima ejecución la tome cualquier instancia sin esperar el vencimiento.
    if (!controller.signal.aborted) await releaseLease(name, owner).catch(() => {});
  }
}
