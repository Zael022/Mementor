import { QueryTypes } from 'sequelize';
import { sequelize, isPostgres } from '../config/database.js';
import { affectedRows, nowMinus, nowPlus } from '../utils/sql.js';

// Contadores de límites guardados en la base: todas las instancias del backend comparten el mismo conteo.
// La hora la pone la base, así no influyen las diferencias de reloj entre servidores.
const VENCE = nowPlus(':seconds', 'SECOND');
const INCREMENTAR = isPostgres
  // En PostgreSQL «rate_limit_hits.reset_at» es el valor anterior de la fila existente.
  ? `INSERT INTO rate_limit_hits (rate_key, hits, reset_at)
       VALUES (:rateKey, 1, ${VENCE})
       ON CONFLICT (rate_key) DO UPDATE SET
         hits = CASE WHEN rate_limit_hits.reset_at <= CURRENT_TIMESTAMP(3) THEN 1 ELSE rate_limit_hits.hits + 1 END,
         reset_at = CASE WHEN rate_limit_hits.reset_at <= CURRENT_TIMESTAMP(3) THEN ${VENCE} ELSE rate_limit_hits.reset_at END`
  // En ON DUPLICATE KEY UPDATE las asignaciones se evalúan en orden: «hits» usa el reset_at anterior.
  : `INSERT INTO rate_limit_hits (rate_key, hits, reset_at)
       VALUES (:rateKey, 1, ${VENCE})
       ON DUPLICATE KEY UPDATE
         hits = IF(reset_at <= NOW(3), 1, hits + 1),
         reset_at = IF(reset_at <= NOW(3), ${VENCE}, reset_at)`;
export class MysqlRateLimitStore {
  constructor(prefix) {
    this.prefix = `${prefix}:`;
    this.localKeys = false;
    this.windowSeconds = 60;
  }

  init(options) {
    this.windowSeconds = options.windowMs / 1000;
  }

  async increment(key) {
    const rateKey = (this.prefix + key).slice(0, 255);
    await sequelize.query(INCREMENTAR, { replacements: { rateKey, seconds: this.windowSeconds } });
    const [row] = await sequelize.query('SELECT hits, reset_at AS reset_at FROM rate_limit_hits WHERE rate_key = :rateKey', {
      replacements: { rateKey }, type: QueryTypes.SELECT,
    });
    return { totalHits: Number(row?.hits || 1), resetTime: row?.reset_at ? new Date(row.reset_at) : undefined };
  }

  async decrement(key) {
    await sequelize.query('UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE rate_key = :rateKey', {
      replacements: { rateKey: (this.prefix + key).slice(0, 255) },
    });
  }

  async resetKey(key) {
    await sequelize.query('DELETE FROM rate_limit_hits WHERE rate_key = :rateKey', { replacements: { rateKey: (this.prefix + key).slice(0, 255) } });
  }
}

// Borra contadores vencidos (lo ejecuta la instancia que tiene el turno de tareas).
export async function purgeExpiredRateLimits() {
  return affectedRows(await sequelize.query(`DELETE FROM rate_limit_hits WHERE reset_at < ${nowMinus('1', 'HOUR')}`));
}
