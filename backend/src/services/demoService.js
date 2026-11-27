import { Institution, User, sequelize } from '../models/index.js';
import { AppError, notFound } from '../utils/AppError.js';
import { demoEnabled, demoPassword } from '../utils/demo.js';
import { hashPassword, verifyPassword } from '../utils/security.js';
import { recordAudit } from './auditService.js';
import { startSession } from './authService.js';
import { acceptPolicies, POLICY_VERSIONS } from './consentService.js';

// Cuentas de prueba (ADR 0011): una por rol, en una institución de prueba.
// Solo existen y entran con DEMO_MODE encendido; el dominio .test nunca recibe correo real.
export const DEMO_DOMAIN = 'prueba.mentorai.test';
export const DEMO_INSTITUTION = { name: 'Institución de prueba', slug: 'institucion-de-prueba' };
export const DEMO_ACCOUNTS = Object.freeze([
  { role: 'student', label: 'Estudiante', email: `estudiante@${DEMO_DOMAIN}`, displayName: 'Estudiante de prueba' },
  { role: 'teacher', label: 'Docente', email: `docente@${DEMO_DOMAIN}`, displayName: 'Docente de prueba' },
  { role: 'institution_admin', label: 'Admin. de institución', email: `admin.institucion@${DEMO_DOMAIN}`, displayName: 'Administración de prueba' },
  { role: 'auditor', label: 'Auditoría', email: `auditoria@${DEMO_DOMAIN}`, displayName: 'Auditoría de prueba' },
  { role: 'platform_admin', label: 'Admin. de plataforma', email: `admin.plataforma@${DEMO_DOMAIN}`, displayName: 'Plataforma de prueba' },
]);

// Crea o repara las cuentas de prueba (se puede correr muchas veces sin duplicar nada).
export async function ensureDemoAccounts() {
  if (!demoEnabled()) throw new AppError(409, 'DEMO_DISABLED', 'Enciende DEMO_MODE=on para crear las cuentas de prueba.');
  const password = demoPassword();
  const [institution] = await Institution.findOrCreate({ where: { slug: DEMO_INSTITUTION.slug }, defaults: { name: DEMO_INSTITUTION.name, status: 'active' } });
  if (institution.status !== 'active') await institution.update({ status: 'active' });

  const cuentas = [];
  for (const cuenta of DEMO_ACCOUNTS) {
    const institutionId = cuenta.role === 'platform_admin' ? null : institution.id;
    let user = await User.findOne({ where: { email: cuenta.email } });
    // Nunca se toma una cuenta real que casualmente use el mismo correo.
    if (user && !user.isDemo) throw new AppError(409, 'DEMO_EMAIL_TAKEN', `El correo ${cuenta.email} ya pertenece a una cuenta real.`);
    await sequelize.transaction(async (transaction) => {
      if (!user) {
        user = await User.create({
          email: cuenta.email, displayName: cuenta.displayName, role: cuenta.role, institutionId,
          status: 'active', isDemo: true, passwordHash: await hashPassword(password),
        }, { transaction });
        await recordAudit({ actor: user, action: 'demo.account_created', resourceType: 'user', resourceId: user.id, transaction });
      } else {
        // Repara rol, institución y estado; la contraseña solo se cambia si DEMO_PASSWORD cambió.
        const changes = { role: cuenta.role, institutionId, status: 'active', lockedUntil: null, failedLoginCount: 0 };
        if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) changes.passwordHash = await hashPassword(password);
        await user.update(changes, { transaction });
      }
      // Los términos quedan aceptados para entrar directo (son cuentas de prueba).
      await acceptPolicies(user.id, Object.keys(POLICY_VERSIONS), { transaction });
    });
    cuentas.push({ ...cuenta, id: user.id });
  }
  return { institution: { id: institution.id, ...DEMO_INSTITUTION }, accounts: cuentas, password };
}

// Lo que ve la pantalla de inicio de sesión: si hay acceso rápido y con qué roles.
export function demoInfo() {
  if (!demoEnabled()) return { enabled: false, accounts: [] };
  return { enabled: true, accounts: DEMO_ACCOUNTS.map(({ role, label, email }) => ({ role, label, email })) };
}

// Inicia sesión con la cuenta de prueba de un rol, sin contraseña. Con DEMO_MODE apagado no existe (404).
export async function demoLogin(role) {
  if (!demoEnabled()) throw notFound('Ruta no encontrada.');
  const cuenta = DEMO_ACCOUNTS.find((item) => item.role === role);
  if (!cuenta) throw notFound('No hay una cuenta de prueba para ese rol.');
  let user = await User.findOne({ where: { email: cuenta.email, isDemo: true }, include: [{ model: Institution, as: 'institution' }] });
  if (!user) {
    await ensureDemoAccounts();
    user = await User.findOne({ where: { email: cuenta.email, isDemo: true }, include: [{ model: Institution, as: 'institution' }] });
  }
  if (user.status !== 'active' || (user.institution && user.institution.status !== 'active')) {
    throw new AppError(409, 'DEMO_ACCOUNT_INACTIVE', 'La cuenta de prueba está desactivada. Corre npm run demo:cuentas para repararla.');
  }
  return startSession(user, { action: 'auth.demo_login' });
}
