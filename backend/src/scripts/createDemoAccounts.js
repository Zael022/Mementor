import 'dotenv/config';
import { sequelize } from '../models/index.js';
import { ensureDemoAccounts } from '../services/demoService.js';
import { demoEnabled } from '../utils/demo.js';

// Crea o repara las cuentas de prueba (una por rol). Requiere DEMO_MODE=on en el .env.
try {
  if (!demoEnabled()) throw new Error('El modo de prueba está apagado. Agrega DEMO_MODE=on al archivo .env y vuelve a correr el comando.');
  await sequelize.authenticate();
  const { institution, accounts, password } = await ensureDemoAccounts();
  console.log(`\nCuentas de prueba listas en «${institution.name}». Contraseña de todas: ${password}\n`);
  console.table(accounts.map(({ label, email }) => ({ Rol: label, Correo: email })));
  console.log('\nTambién puedes entrar sin contraseña con «Acceso rápido de prueba» en la pantalla de inicio de sesión.');
} catch (error) {
  console.error('No se pudieron crear las cuentas de prueba:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
