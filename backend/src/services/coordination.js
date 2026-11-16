import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Identifica a esta instancia del backend mientras está encendida.
export const INSTANCE_ID = randomUUID();

// Toma o renueva un turno con vencimiento. Devuelve true si esta instancia lo tiene.
// Si la instancia que lo tenía se apaga, otra lo toma cuando vence.
export async function holdLease(name, ttlMs, owner = INSTANCE_ID) {
  await sequelize.query('INSERT IGNORE INTO job_leases (name, owner, expires_at) VALUES (:name, NULL, NULL)', { replacements: { name } });
  await sequelize.query(
    `UPDATE job_leases SET owner = :owner, expires_at = DATE_ADD(NOW(3), INTERVAL :seconds SECOND)
      WHERE name = :name AND (owner = :owner OR owner IS NULL OR expires_at IS NULL OR expires_at < NOW(3))`,
    { replacements: { name, owner, seconds: ttlMs / 1000 } },
  );
  const [row] = await sequelize.query('SELECT owner FROM job_leases WHERE name = :name', { replacements: { name }, type: QueryTypes.SELECT });
  return row?.owner === owner;
}

// Libera el turno al apagar la instancia para que otra lo tome de inmediato.
export async function releaseLease(name, owner = INSTANCE_ID) {
  await sequelize.query('UPDATE job_leases SET owner = NULL, expires_at = NULL WHERE name = :name AND owner = :owner', { replacements: { name, owner } });
}
