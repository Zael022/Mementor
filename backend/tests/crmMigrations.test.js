import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { Sequelize } from 'sequelize';

const require = createRequire(import.meta.url);

test('migraciones en base nueva y estructura previa: up/down/up conserva registros ajenos al CRM', async () => {
  if (process.env.NODE_ENV !== 'test') throw new Error('Solo en test.');
  const database = 'mentor_crm_migration_test';
  // La base descartable se crea en el mismo servidor de pruebas, sea MySQL o PostgreSQL.
  const { conexion } = require('../config/connection.cjs');
  const cfg = conexion('test');
  const postgres = cfg.dialect === 'postgres';
  const connection = { host: cfg.host, port: cfg.port, dialect: cfg.dialect, dialectOptions: cfg.dialectOptions, logging: false };
  const admin = new Sequelize(postgres ? 'postgres' : 'mysql', cfg.username, cfg.password, connection);
  const buscar = postgres
    ? 'SELECT datname FROM pg_database WHERE datname = :name'
    : 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = :name';
  const [existing] = await admin.query(buscar, { replacements: { name: database } });
  assert.equal(existing.length, 0, 'La base descartable de migraciones debe estar ausente; no se toca una base preexistente.');
  await admin.query(postgres ? 'CREATE DATABASE mentor_crm_migration_test' : 'CREATE DATABASE mentor_crm_migration_test CHARACTER SET utf8mb4');
  const db = new Sequelize(database, cfg.username, cfg.password, connection);
  const tabla = (nombre) => (postgres ? `"${nombre}"` : `\`${nombre}\``);
  try {
    const q = db.getQueryInterface(); const files = (await readdir(new URL('../database/migrations/', import.meta.url))).filter((f) => f.endsWith('.js')).sort();
    for (const file of files.filter((f) => !f.includes('2026112200'))) await require(fileURLToPath(new URL(`../database/migrations/${file}`, import.meta.url))).up(q, Sequelize);
    await q.bulkInsert('institutions', [{ name: 'Institución temporal preservada', slug: 'migration-isolated', status: 'active' }]);
    const additions = files.filter((f) => f.includes('2026112200')).map((f) => require(fileURLToPath(new URL(`../database/migrations/${f}`, import.meta.url))));
    for (const m of additions) await m.up(q, Sequelize);
    let [rows] = await db.query('SELECT COUNT(*) AS total FROM institutions'); assert.equal(Number(rows[0].total), 1);
    for (const table of (await q.showAllTables()).filter((t) => t.startsWith('crm_'))) { const [r] = await db.query(`SELECT COUNT(*) AS total FROM ${tabla(table)}`); assert.equal(Number(r[0].total), 0); }
    for (const m of [...additions].reverse()) await m.down(q, Sequelize);
    [rows] = await db.query('SELECT COUNT(*) AS total FROM institutions'); assert.equal(Number(rows[0].total), 1);
    for (const m of additions) await m.up(q, Sequelize);
    assert.ok((await q.describeTable('crm_applications')).acquisition_origin);
    [rows] = await db.query('SELECT COUNT(*) AS total FROM institutions'); assert.equal(Number(rows[0].total), 1);
  } finally { await db.close(); await admin.query('DROP DATABASE mentor_crm_migration_test'); await admin.close(); }
});
