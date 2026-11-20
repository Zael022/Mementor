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
  const connection = { host: process.env.TEST_DB_HOST, port: Number(process.env.TEST_DB_PORT || 3306), dialect: 'mysql', logging: false };
  const admin = new Sequelize('mysql', process.env.TEST_DB_USER, process.env.TEST_DB_PASSWORD, connection);
  const [existing] = await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = :name', { replacements: { name: database } });
  assert.equal(existing.length, 0, 'La base descartable de migraciones debe estar ausente; no se toca una base preexistente.');
  await admin.query('CREATE DATABASE mentor_crm_migration_test CHARACTER SET utf8mb4');
  const db = new Sequelize(database, process.env.TEST_DB_USER, process.env.TEST_DB_PASSWORD, connection);
  try {
    const q = db.getQueryInterface(); const files = (await readdir(new URL('../database/migrations/', import.meta.url))).filter((f) => f.endsWith('.js')).sort();
    for (const file of files.filter((f) => !f.includes('2026112200'))) await require(fileURLToPath(new URL(`../database/migrations/${file}`, import.meta.url))).up(q, Sequelize);
    await q.bulkInsert('institutions', [{ name: 'Institución temporal preservada', slug: 'migration-isolated', status: 'active' }]);
    const additions = files.filter((f) => f.includes('2026112200')).map((f) => require(fileURLToPath(new URL(`../database/migrations/${f}`, import.meta.url))));
    for (const m of additions) await m.up(q, Sequelize);
    let [rows] = await db.query('SELECT COUNT(*) AS total FROM institutions'); assert.equal(Number(rows[0].total), 1);
    for (const table of (await q.showAllTables()).filter((t) => t.startsWith('crm_'))) { const [r] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\``); assert.equal(Number(r[0].total), 0); }
    for (const m of [...additions].reverse()) await m.down(q, Sequelize);
    [rows] = await db.query('SELECT COUNT(*) AS total FROM institutions'); assert.equal(Number(rows[0].total), 1);
    for (const m of additions) await m.up(q, Sequelize);
    assert.ok((await q.describeTable('crm_applications')).acquisition_origin);
    [rows] = await db.query('SELECT COUNT(*) AS total FROM institutions'); assert.equal(Number(rows[0].total), 1);
  } finally { await db.close(); await admin.query('DROP DATABASE mentor_crm_migration_test'); await admin.close(); }
});
