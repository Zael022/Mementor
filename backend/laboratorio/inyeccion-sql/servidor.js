import express from 'express';
import { readFileSync } from 'node:fs';
import app from '../../src/app.js';
import { Institution, User, sequelize } from '../../src/models/index.js';
import { listUsers } from '../../src/services/userService.js';
import { hashPassword } from '../../src/utils/security.js';
import { readPagination } from '../../src/utils/http.js';

// Servidor de la demostración. Se arranca con «npm run lab:sqli» (iniciar.js), nunca con «npm start».
if (process.env.NODE_ENV !== 'test' || !String(process.env.TEST_DB_NAME).endsWith('_lab')) {
  throw new Error('Arranca el laboratorio con «npm run lab:sqli».');
}

// ---------- Datos efímeros: dos colegios con sus personas; se borran al cerrar ----------
async function vaciar() {
  const tablas = await sequelize.getQueryInterface().showAllTables();
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of tablas) {
    if (!['sequelizemeta', 'roles'].includes(tabla.toLowerCase())) await sequelize.query(`TRUNCATE TABLE \`${tabla}\``);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function preparar() {
  await vaciar();
  const clave = await hashPassword('ClaveDelLaboratorio2026');
  const norte = await Institution.create({ name: 'Colegio Norte (laboratorio)', slug: 'colegio-norte-lab' });
  const sur = await Institution.create({ name: 'Colegio Sur (laboratorio)', slug: 'colegio-sur-lab' });
  const personas = [
    [norte, 'institution_admin', 'Admin Norte', 'admin.norte@lab.test'],
    [norte, 'teacher', 'Docente Norte', 'docente.norte@lab.test'],
    [norte, 'student', 'Estudiante Norte', 'estudiante.norte@lab.test'],
    [sur, 'institution_admin', 'Admin Sur', 'admin.sur@lab.test'],
    [sur, 'teacher', 'Docente Sur', 'docente.sur@lab.test'],
    [sur, 'student', 'Estudiante Sur', 'estudiante.sur@lab.test'],
  ];
  for (const [institucion, role, displayName, email] of personas) {
    await User.create({ institutionId: institucion.id, role, displayName, email, status: 'active', passwordHash: clave });
  }
  return { norte: norte.id, sur: sur.id };
}

const colegios = await preparar();

// ---------- Versión VULNERABLE (solo existe aquí, a propósito) ----------
// Así se veía el error: el texto de la búsqueda se pega dentro del SQL.
function consultaVulnerable(institucion, texto) {
  return `SELECT display_name, email FROM users WHERE institution_id = ${institucion} AND display_name LIKE '%${texto}%'`;
}

const lab = express();
lab.disable('x-powered-by');

lab.get('/lab/vulnerable/usuarios', async (req, res) => {
  const sql = consultaVulnerable(colegios.norte, String(req.query.q ?? ''));
  try {
    const [filas] = await sequelize.query(sql);
    res.json({ sql, filas });
  } catch (error) {
    // La versión vulnerable además muestra el error de la base: eso también ayuda al atacante.
    res.status(500).json({ sql, error: error.parent?.sqlMessage || error.message });
  }
});

// ---------- Versión PROTEGIDA: el mismo servicio que usa MENTOR AI en /api/v1/users ----------
lab.get('/lab/protegida/usuarios', async (req, res) => {
  const actor = { institutionId: colegios.norte, role: 'institution_admin' };
  const resultado = await listUsers(actor, { q: req.query.q, pagination: readPagination({ limit: '50' }) });
  res.json({
    sql: 'SELECT … FROM users WHERE institution_id = ? AND (display_name LIKE ? OR email LIKE ?)\n-- Los «?» se llenan aparte con el texto escrito: nunca cambia la estructura de la consulta.',
    filas: resultado.data.map((fila) => ({ display_name: fila.displayName, email: fila.email })),
  });
});

const pagina = readFileSync(new URL('./pagina.html', import.meta.url), 'utf8');
lab.get('/', (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
  res.type('html').send(pagina);
});
// La API real de MENTOR AI queda montada en /api/v1 para probar el inicio de sesión con el mismo ataque.
lab.use(app);

const puerto = Number(process.env.LAB_PORT || 3199);
const servidor = lab.listen(puerto, '127.0.0.1', () => {
  console.log(`Laboratorio de inyección SQL en http://127.0.0.1:${puerto} (Ctrl+C para cerrar y borrar los datos)`);
});

async function cerrar() {
  servidor.close();
  await vaciar().catch(() => {});
  await sequelize.close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
