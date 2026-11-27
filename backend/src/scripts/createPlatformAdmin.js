import 'dotenv/config';
import readline from 'node:readline';
import { z } from 'zod';
import { User, sequelize } from '../models/index.js';
import { assertStrongPassword } from '../services/authService.js';
import { recordAudit } from '../services/auditService.js';
import { hashPassword } from '../utils/security.js';

// Crea el primer administrador con datos escritos por el operador; no hay cuentas fijas.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });

// Guarda las líneas recibidas para leerlas una por una.
const lines = [];
const waiting = [];
let muted = false;
rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on('close', () => waiting.splice(0).forEach((resolve) => resolve('')));
rl._writeToOutput = (text) => { if (!muted) rl.output.write(text); };

// Lee una línea; oculta lo escrito cuando es una contraseña.
async function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden && Boolean(process.stdin.isTTY);
  const answer = lines.length ? lines.shift() : await new Promise((resolve) => waiting.push(resolve));
  if (muted) process.stdout.write('\n');
  muted = false;
  return answer.trim();
}

async function main() {
  await sequelize.authenticate();
  // La cuenta de prueba de plataforma no cuenta: el administrador real se puede crear igual.
  if (await User.count({ where: { role: 'platform_admin', isDemo: false } })) {
    throw new Error('Ya existe un administrador de plataforma. Este comando solo se usa en la instalación inicial.');
  }

  const email = z.string().trim().toLowerCase().email().max(190).parse(await ask('Correo del administrador: '));
  const displayName = z.string().trim().min(2).max(120).parse(await ask('Nombre para mostrar: '));
  const password = await ask('Contraseña (mínimo 10 caracteres, con letras y números): ', { hidden: true });
  const confirmation = await ask('Repite la contraseña: ', { hidden: true });
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
  assertStrongPassword(password);

  const user = await User.create({
    institutionId: null, email, displayName, role: 'platform_admin', status: 'active', passwordHash: await hashPassword(password),
  });
  await recordAudit({ actor: user, action: 'platform_admin.provisioned', resourceType: 'user', resourceId: user.id });
  console.log(`Administrador de plataforma creado: ${email}`);
}

try {
  await main();
} catch (error) {
  console.error('No se pudo crear el administrador:', error.issues?.[0]?.message || error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await sequelize.close();
}
