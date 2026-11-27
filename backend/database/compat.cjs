'use strict';

// Ayudas para que las migraciones corran igual en MySQL (local) y PostgreSQL (Supabase).
const esPostgres = (queryInterface) => queryInterface.sequelize.getDialect() === 'postgres';

// Cambia los valores permitidos de una columna ENUM.
// MySQL redefine la columna; PostgreSQL agrega los valores nuevos al tipo (no admite quitarlos, así que al revertir se dejan).
async function cambiarEnum(queryInterface, Sequelize, tabla, columna, valores, opciones = {}) {
  if (!esPostgres(queryInterface)) {
    await queryInterface.changeColumn(tabla, columna, { type: Sequelize.ENUM(...valores), ...opciones });
    return;
  }
  const tipo = `enum_${tabla}_${columna}`;
  for (const valor of valores) {
    if (!/^[a-z_]+$/.test(valor)) throw new Error(`Valor de ENUM no válido: ${valor}`);
    await queryInterface.sequelize.query(`ALTER TYPE "${tipo}" ADD VALUE IF NOT EXISTS '${valor}'`);
  }
}

// Solo PostgreSQL (Supabase): ninguna tabla de MENTOR queda abierta a la Data API del proyecto.
// RLS sin políticas (el dueño, que es el backend, sí ve todo) y sin permisos para anon, authenticated ni service_role,
// también para las tablas que se creen después. Es idempotente: lo usa la migración y el arranque del servidor.
const ROLES_DATA_API = ['anon', 'authenticated', 'service_role'];
async function protegerEsquema(sequelize) {
  if (sequelize.getDialect() !== 'postgres') return;
  const q = (sql) => sequelize.query(sql);
  const [tablas] = await q("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity");
  for (const { tablename } of tablas) await q(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`);
  const [existentes] = await q(`SELECT rolname FROM pg_roles WHERE rolname IN (${ROLES_DATA_API.map((rol) => `'${rol}'`).join(', ')})`);
  for (const { rolname } of existentes) {
    await q(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${rolname}`);
    await q(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${rolname}`);
    await q(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${rolname}`);
    await q(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${rolname}`);
  }
}

module.exports = { esPostgres, cambiarEnum, protegerEsquema };
