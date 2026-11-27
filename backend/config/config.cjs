require('dotenv').config();
const { conexion } = require('./connection.cjs');

// Configuración de Sequelize CLI (migraciones). Usa la misma lógica que la API: MySQL local o PostgreSQL (Supabase).
function paraCli(envName) {
  // eslint-disable-next-line no-unused-vars
  const { url, variables, pool, ...resto } = conexion(envName);
  return resto;
}

module.exports = {
  development: paraCli('development'),
  test: paraCli('test'),
  // En producción se usan las mismas variables DB_* o DATABASE_URL (configuradas en la plataforma, nunca en el repositorio).
  production: paraCli('development'),
};
