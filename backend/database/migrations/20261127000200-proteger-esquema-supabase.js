'use strict';

const { esPostgres } = require('../compat.cjs');

// Solo en PostgreSQL (Supabase): las tablas de MENTOR no deben quedar expuestas por la Data API de Supabase
// (REST/GraphQL con las claves del proyecto). Solo el backend entra a la base, con su propia conexión.
// - Se activa RLS sin políticas: los roles de la Data API no ven filas (el dueño de las tablas sí, y es el backend).
// - Se quitan los permisos de anon, authenticated y service_role, también para las tablas que se creen después.
// En MySQL no hace nada.
const ROLES_DATA_API = ['anon', 'authenticated', 'service_role'];

module.exports = {
  async up(queryInterface) {
    if (!esPostgres(queryInterface)) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    const [tablas] = await q("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    for (const { tablename } of tablas) await q(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`);
    const [existentes] = await q(`SELECT rolname FROM pg_roles WHERE rolname IN (${ROLES_DATA_API.map((rol) => `'${rol}'`).join(', ')})`);
    for (const { rolname } of existentes) {
      await q(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${rolname}`);
      await q(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${rolname}`);
      await q(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${rolname}`);
      await q(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${rolname}`);
    }
  },

  // Revertir no vuelve a exponer las tablas: abrir la Data API sería una decisión aparte y explícita.
  async down() {},
};
