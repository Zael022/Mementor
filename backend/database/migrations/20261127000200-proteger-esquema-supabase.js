'use strict';

const { protegerEsquema } = require('../compat.cjs');

// Solo en PostgreSQL (Supabase): las tablas de MENTOR no deben quedar expuestas por la Data API de Supabase
// (REST/GraphQL con las claves del proyecto). Solo el backend entra a la base, con su propia conexión.
// Activa RLS sin políticas y quita los permisos de anon, authenticated y service_role (ver database/compat.cjs).
// El servidor lo repite al arrancar para cubrir tablas creadas por migraciones posteriores. En MySQL no hace nada.
module.exports = {
  async up(queryInterface) {
    await protegerEsquema(queryInterface.sequelize);
  },

  // Revertir no vuelve a exponer las tablas: abrir la Data API sería una decisión aparte y explícita.
  async down() {},
};
