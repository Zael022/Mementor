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

module.exports = { esPostgres, cambiarEnum };
