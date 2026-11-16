import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Contadores de límites guardados en MySQL: todas las instancias del backend comparten el mismo conteo.
// La hora la pone MySQL, así no influyen las diferencias de reloj entre servidores.
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
    // En ON DUPLICATE KEY UPDATE las asignaciones se evalúan en orden: «hits» usa el reset_at anterior.
    await sequelize.query(
      `INSERT INTO rate_limit_hits (rate_key, hits, reset_at)
       VALUES (:rateKey, 1, DATE_ADD(NOW(3), INTERVAL :seconds SECOND))
       ON DUPLICATE KEY UPDATE
         hits = IF(reset_at <= NOW(3), 1, hits + 1),
         reset_at = IF(reset_at <= NOW(3), DATE_ADD(NOW(3), INTERVAL :seconds SECOND), reset_at)`,
      { replacements: { rateKey, seconds: this.windowSeconds } },
    );
    const [row] = await sequelize.query('SELECT hits, reset_at AS resetAt FROM rate_limit_hits WHERE rate_key = :rateKey', {
      replacements: { rateKey }, type: QueryTypes.SELECT,
    });
    return { totalHits: Number(row?.hits || 1), resetTime: row?.resetAt ? new Date(row.resetAt) : undefined };
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
  const [result] = await sequelize.query('DELETE FROM rate_limit_hits WHERE reset_at < NOW(3) - INTERVAL 1 HOUR');
  return result?.affectedRows ?? 0;
}
