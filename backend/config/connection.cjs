const fs = require('fs');
const path = require('path');

// Arma la conexión de Sequelize leyendo los nombres de variables de db.json (sin secretos) y sus valores de .env.
// Motores admitidos: mysql (local y por defecto) y postgres (Supabase en la nube).
const DIALECTOS = ['mysql', 'postgres'];
const PUERTOS = { mysql: 3306, postgres: 5432 };
const mapa = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));

function entornoDe(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === 'test' ? 'test' : 'development';
}

function leer(cfg, clave) {
  const valor = process.env[cfg[clave]];
  return valor === undefined || valor === '' ? undefined : valor;
}

// Deduce el motor: DB_DIALECT manda; si no, el esquema de DATABASE_URL; si no, MySQL.
function dialectoDe(cfg) {
  const url = leer(cfg, 'urlEnv');
  const pedido = leer(cfg, 'dialectEnv') || (url && /^postgres(ql)?:/i.test(url) ? 'postgres' : 'mysql');
  const dialecto = pedido === 'postgresql' ? 'postgres' : pedido;
  if (!DIALECTOS.includes(dialecto)) throw new Error(`${cfg.dialectEnv} debe ser mysql o postgres.`);
  return dialecto;
}

// TLS para bases en la nube: se verifica el certificado siempre; DB_SSL_CA (ruta) o DB_SSL_CA_PEM (contenido) aportan la autoridad propia del proveedor.
function sslDe(cfg, dialecto) {
  if (leer(cfg, 'sslEnv') !== 'true') return undefined;
  const rutaCa = leer(cfg, 'sslCaEnv');
  const pem = leer(cfg, 'sslCaPemEnv');
  const ca = pem ? pem.replace(/\\n/g, '\n') : rutaCa ? fs.readFileSync(rutaCa, 'utf8') : undefined;
  const ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  return dialecto === 'postgres' ? { ssl: { require: true, ...ssl } } : { ssl };
}

function conexion(envName = entornoDe()) {
  const cfg = mapa[envName];
  if (!cfg) throw new Error(`Entorno de base desconocido: ${envName}`);
  const dialect = dialectoDe(cfg);
  const url = leer(cfg, 'urlEnv');
  const base = {
    dialect,
    logging: false,
    dialectOptions: sslDe(cfg, dialect),
    // Sin pool grande: Render y el pooler de Supabase limitan conexiones en los planes gratuitos.
    pool: { max: Number(process.env.DB_POOL_MAX || 10), min: 0, idle: 10000, acquire: 30000 },
  };
  if (url) {
    const u = new URL(url);
    return {
      ...base,
      url,
      host: u.hostname,
      port: Number(u.port || PUERTOS[dialect]),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      variables: cfg,
    };
  }
  return {
    ...base,
    host: leer(cfg, 'hostEnv') || '127.0.0.1',
    port: Number(leer(cfg, 'portEnv') || PUERTOS[dialect]),
    database: leer(cfg, 'databaseEnv'),
    username: leer(cfg, 'usernameEnv'),
    password: leer(cfg, 'passwordEnv') || '',
    variables: cfg,
  };
}

module.exports = { conexion, entornoDe, DIALECTOS };
