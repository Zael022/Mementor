require('dotenv').config();

// Obtiene la conexión MySQL desde el entorno.
function configFor(prefix) {
  return {
    dialect: 'mysql',
    host: process.env[`${prefix}DB_HOST`] || '127.0.0.1',
    port: Number(process.env[`${prefix}DB_PORT`] || '3306'),
    database: process.env[`${prefix}DB_NAME`],
    username: process.env[`${prefix}DB_USER`],
    password: process.env[`${prefix}DB_PASSWORD`],
    logging: false,
  };
}
module.exports = {
  development: configFor(''),
  test: configFor('TEST_'),
};
