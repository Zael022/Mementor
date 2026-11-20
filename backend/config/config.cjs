require('dotenv').config();
const fs = require('fs');

// TLS para bases en la nube (TiDB Cloud, Aiven, Railway): DB_SSL=true y, si el proveedor lo pide, DB_SSL_CA con la ruta del certificado.
function sslOptions(prefix) {
  if (process.env[`${prefix}DB_SSL`] !== 'true') return undefined;
  const caPath = process.env[`${prefix}DB_SSL_CA`];
  return { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(caPath ? { ca: fs.readFileSync(caPath, 'utf8') } : {}) } };
}

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
    dialectOptions: sslOptions(prefix),
  };
}
module.exports = {
  development: configFor(''),
  test: configFor('TEST_'),
  // En producción se usan las mismas variables DB_* (configuradas en la plataforma, nunca en el repositorio).
  production: configFor(''),
};
