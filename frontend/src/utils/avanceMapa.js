// Recuerda qué parada se acaba de completar para que, al volver al mapa, Orbi recorra el tramo.
// Es una comodidad de esta pestaña (sessionStorage): si no está disponible, el mapa se ve igual sin el viaje.
const CLAVE = 'mentor.mapa.avance';

export function recordarAvance(cursoId, parada) {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify({ cursoId: String(cursoId), parada }));
  } catch {
    // Sin almacenamiento no hay viaje animado; el avance real ya quedó guardado en el servidor.
  }
}

// Devuelve la parada recordada para este curso sin borrarla (en desarrollo React monta dos veces).
export function leerAvance(cursoId) {
  try {
    const guardado = JSON.parse(window.sessionStorage.getItem(CLAVE) || 'null');
    return guardado && guardado.cursoId === String(cursoId) ? guardado.parada : null;
  } catch {
    return null;
  }
}

// Olvida la parada cuando el viaje ya ocurrió (o no puede ocurrir): se ve una sola vez.
export function olvidarAvance() {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}
