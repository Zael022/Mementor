// Arranca el backend para las pruebas en navegador sobre una base dedicada que se reinicia en cada corrida.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from '../../../backend/node_modules/dotenv/lib/main.js';

const backend = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../backend');
dotenv.config({ path: path.join(backend, '.env') });

const dbName = process.env.E2E_DB_NAME || 'mentor_ai_e2e';
const env = {
  ...process.env,
  // Entorno de pruebas: límites de solicitudes altos para que la preparación de datos no los agote.
  NODE_ENV: 'test',
  PORT: process.env.E2E_API_PORT || '3101',
  // En modo test el backend usa TEST_DB_*; DB_NAME debe ser distinta por la protección del backend.
  DB_NAME: `${dbName}_sin_uso`,
  TEST_DB_NAME: dbName,
  TEST_DB_HOST: process.env.TEST_DB_HOST || process.env.DB_HOST,
  TEST_DB_PORT: process.env.TEST_DB_PORT || process.env.DB_PORT,
  TEST_DB_USER: process.env.TEST_DB_USER || process.env.DB_USER,
  TEST_DB_PASSWORD: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD,
  FRONTEND_ORIGIN: `http://127.0.0.1:${process.env.E2E_WEB_PORT || '5174'}`,
  RAG_PROVIDER: 'local',
  AI_PROVIDER: 'anthropic',
  AI_API_KEY: 'clave-del-doble-local',
  AI_MODEL: 'modelo-doble-e2e',
  AI_BASE_URL: `http://127.0.0.1:${process.env.E2E_FAKE_AI_PORT || '4599'}/v1/messages`,
  UPLOAD_DIR: 'storage/uploads-e2e',
  DRIVE_SYNC_INTERVAL_MINUTES: '0',
};

// Protección: este script borra y recrea tablas, así que solo acepta bases cuyo nombre termina en _e2e.
if (!dbName.endsWith('_e2e')) throw new Error(`La base de pruebas en navegador debe terminar en _e2e (recibido: ${dbName}).`);

const run = (args) => execFileSync('npx', ['sequelize-cli', ...args], { cwd: backend, env, stdio: 'inherit' });
run(['db:migrate:undo:all']);
run(['db:migrate']);
execFileSync(process.execPath, ['src/scripts/createPlatformAdmin.js'], {
  cwd: backend, env, input: 'operador@e2e.test\nOperador E2E\nOperadorE2E2026\nOperadorE2E2026\n', stdio: ['pipe', 'inherit', 'inherit'],
});

Object.assign(process.env, env);
process.chdir(backend);
await import(path.join(backend, 'src/server.js'));
