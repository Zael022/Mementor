// Ventana para entrar a una clase: desde 15 minutos antes hasta que termina (igual que el servidor).
export const MINUTOS_ANTES = 15;

// Calcula el estado de la clase con la hora local; el servidor vuelve a validar al entrar.
export function estadoClase(sesion, ahora = Date.now()) {
  if (sesion.status === 'cancelled') return { estado: 'cancelled', puedeEntrar: false };
  const inicio = new Date(sesion.startsAt).getTime();
  const fin = inicio + sesion.durationMinutes * 60000;
  const estado = ahora > fin ? 'ended' : ahora >= inicio ? 'live' : 'upcoming';
  const puedeEntrar = ahora >= inicio - MINUTOS_ANTES * 60000 && ahora <= fin;
  return { estado, puedeEntrar };
}

// Próximo instante en que cambia el estado: apertura de la ventana, inicio y fin de la clase.
export function proximoCambio(sesion, ahora = Date.now()) {
  if (sesion.status === 'cancelled') return null;
  const inicio = new Date(sesion.startsAt).getTime();
  const fin = inicio + sesion.durationMinutes * 60000;
  // fin + 1: la clase cuenta como terminada justo después de su último milisegundo.
  return [inicio - MINUTOS_ANTES * 60000, inicio, fin + 1].find((momento) => momento > ahora) ?? null;
}
