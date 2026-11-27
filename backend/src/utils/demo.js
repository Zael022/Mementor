// Interruptor del modo de prueba: cuentas de prueba y acceso rápido solo existen si DEMO_MODE está encendido.
export function demoEnabled() {
  return ['on', 'true', '1', 'si', 'sí'].includes(String(process.env.DEMO_MODE || '').trim().toLowerCase());
}

// Contraseña común de las cuentas de prueba (se puede cambiar con DEMO_PASSWORD).
export function demoPassword() {
  return process.env.DEMO_PASSWORD || 'MentorPrueba2026';
}
