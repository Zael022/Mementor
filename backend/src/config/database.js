import 'dotenv/config';
import { createRequire } from 'node:module';
import { Sequelize } from 'sequelize';

// Construye Sequelize con MySQL (local) o PostgreSQL (Supabase) según el entorno; ver config/connection.cjs.
const require = createRequire(import.meta.url);
const { conexion, entornoDe } = require('../../config/connection.cjs');

const envName = entornoDe();
const cfg = conexion(envName);

if (!cfg.database || !cfg.username) {
  throw new Error(`Falta configurar ${cfg.variables.databaseEnv} y ${cfg.variables.usernameEnv} (o ${cfg.variables.urlEnv}) en backend/.env`);
}

// Evita que las pruebas usen la base de desarrollo.
if (envName === 'test') {
  const desarrollo = conexion('development');
  if (cfg.database === desarrollo.database && cfg.host === desarrollo.host && cfg.port === desarrollo.port) {
    throw new Error('TEST_DB_NAME debe ser una base distinta a DB_NAME.');
  }
}

// En PostgreSQL los BIGINT (ids y COUNT) llegan como texto: se convierten a número como hace MySQL.
if (cfg.dialect === 'postgres') {
  const { types } = require('pg');
  types.setTypeParser(types.builtins.INT8, (valor) => Number(valor));
}

export const dialect = cfg.dialect;
export const isPostgres = cfg.dialect === 'postgres';

export const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
  host: cfg.host,
  port: cfg.port,
  dialect: cfg.dialect,
  dialectOptions: cfg.dialectOptions,
  pool: cfg.pool,
  logging: false,
  timezone: '+00:00',
  define: { underscored: true },
});

// MySQL devuelve las filas en orden de id cuando la consulta no pide otro; PostgreSQL no lo garantiza.
// Para que las listas se vean igual en los dos motores, en PostgreSQL se ordena por id si no hay orden explícito
// (salvo en consultas agrupadas o con funciones, donde ese orden podría no ser válido).
if (isPostgres) {
  sequelize.addHook('beforeFind', function ordenPorDefecto(options) {
    const conFunciones = Array.isArray(options.attributes) && options.attributes.some((attribute) => typeof attribute !== 'string');
    if (options.order || options.group || conFunciones || !this.rawAttributes?.id) return;
    options.order = [['id', 'ASC']];
  });
}
