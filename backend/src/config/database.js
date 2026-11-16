import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { readFileSync } from 'node:fs';

// Configura la conexión con MySQL.
const file = new URL('../../config/db.json', import.meta.url);
const settings = JSON.parse(readFileSync(file, 'utf8'));
const envName = process.env.NODE_ENV === 'test' ? 'test' : 'development';
const cfg = settings[envName];
const value = (name, fallback = undefined) => process.env[cfg[name]] || fallback;

for (const key of ['databaseEnv', 'usernameEnv']) {
  if (!value(key)) throw new Error(`Falta configurar ${cfg[key]} en backend/.env`);
}

// Evita que las pruebas usen la base de desarrollo.
if (envName === 'test' && value('databaseEnv') === process.env.DB_NAME) {
  throw new Error('TEST_DB_NAME debe ser una base distinta a DB_NAME.');
}

export const sequelize = new Sequelize(value('databaseEnv'), value('usernameEnv'), value('passwordEnv', ''), {
  host: value('hostEnv', '127.0.0.1'),
  port: Number(value('portEnv', '3306')),
  dialect: 'mysql',
  logging: false,
  timezone: '+00:00',
  define: { underscored: true },
});
