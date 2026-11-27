import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabase, closeDatabase } from './helpers.js';
import { createRequire } from 'node:module';
import { sequelize } from '../src/models/index.js';

const { protegerEsquema } = createRequire(import.meta.url)('../database/compat.cjs');

// Solo aplica a PostgreSQL (Supabase): ninguna tabla de MENTOR queda abierta a la Data API del proyecto.
const postgres = sequelize.getDialect() === 'postgres';

before(async () => { await prepareDatabase(); });
after(async () => { await closeDatabase(); });

test('en PostgreSQL todas las tablas tienen RLS y los roles de la Data API no tienen permisos', { skip: !postgres && 'solo en PostgreSQL' }, async () => {
  // Lo mismo que hace el servidor al arrancar (otras pruebas recrean tablas al deshacer y rehacer migraciones).
  await protegerEsquema(sequelize);
  await protegerEsquema(sequelize);
  const [tablas] = await sequelize.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'");
  assert.ok(tablas.length > 20);
  assert.deepEqual(tablas.filter((tabla) => !tabla.rowsecurity).map((tabla) => tabla.tablename), []);
  const [roles] = await sequelize.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')");
  for (const { rolname } of roles) {
    const [abiertas] = await sequelize.query(
      `SELECT c.relname AS tablename FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND (has_table_privilege(:rol, c.oid, 'SELECT') OR has_table_privilege(:rol, c.oid, 'INSERT'))`,
      { replacements: { rol: rolname } },
    );
    assert.deepEqual(abiertas.map((fila) => fila.tablename), [], `${rolname} no debe leer ni escribir tablas de MENTOR`);
  }
});
