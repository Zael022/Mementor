// Laboratorio de inyección SQL (paso 4 de la asignación de seguridad).
// Solo para la computadora local: prepara una base aislada que termina en _lab, la llena con datos
// efímeros y arranca el servidor de la demostración en 127.0.0.1. Al detenerlo (Ctrl+C) borra los datos.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const backend = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
dotenv.config({ path: path.join(backend, '.env') });

const base = process.env.LAB_DB_NAME || 'mentor_ai_lab';
// Protecciones: nunca en producción y nunca contra una base que no sea exclusiva del laboratorio.
if (process.env.NODE_ENV === 'production') throw new Error('El laboratorio no se ejecuta con NODE_ENV=production.');
if (!/^[a-z0-9_]+_lab$/.test(base)) throw new Error(`La base del laboratorio debe terminar en _lab (recibido: ${base}).`);

const conexion = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
};

// Crea la base si no existe (el nombre ya pasó la validación de arriba). Si el usuario no tiene permiso,
// se explica cómo crearla una vez, igual que la base de las pruebas en navegador.
const admin = await mysql.createConnection(conexion);
try {
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
} catch (error) {
  if (error.code !== 'ER_DBACCESS_DENIED_ERROR') throw error;
  const [[{ existe }]] = await admin.query('SELECT COUNT(*) AS existe FROM information_schema.schemata WHERE schema_name = ?', [base]);
  if (!existe) {
    console.error(`Crea la base una vez con un usuario administrador de MySQL:\n  CREATE DATABASE ${base} CHARACTER SET utf8mb4;\n  GRANT ALL PRIVILEGES ON ${base}.* TO '${conexion.user}'@'localhost';`);
    process.exit(1);
  }
} finally {
  await admin.end();
}

// El backend en modo test usa TEST_DB_*: así el laboratorio no toca la base de desarrollo.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_NAME: `${base}_sin_uso`,
  TEST_DB_NAME: base,
  TEST_DB_HOST: conexion.host,
  TEST_DB_PORT: String(conexion.port),
  TEST_DB_USER: conexion.user,
  TEST_DB_PASSWORD: conexion.password,
  LAB_PORT: process.env.LAB_PORT || '3199',
  FRONTEND_ORIGIN: `http://127.0.0.1:${process.env.LAB_PORT || '3199'}`,
  RAG_PROVIDER: 'local',
  UPLOAD_DIR: 'storage/uploads-lab',
});
execFileSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, env: process.env, stdio: 'ignore', shell: process.platform === 'win32' });

await import('./servidor.js');
