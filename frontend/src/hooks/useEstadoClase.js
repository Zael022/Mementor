import { useEffect, useState } from 'react';
import { estadoClase, proximoCambio } from '../utils/clases.js';

// setTimeout no admite esperas mayores a unos 24 días.
const ESPERA_MAXIMA = 2 ** 31 - 1;

// Estado de una clase que se actualiza justo al abrirse la ventana, al empezar y al terminar,
// sin revisar el reloj de forma periódica. Al volver a la pestaña se recalcula.
export function useEstadoClase(sesion) {
  const [ahora, setAhora] = useState(() => Date.now());
  const { startsAt, durationMinutes, status } = sesion;

  useEffect(() => {
    let temporizador;
    const programar = () => {
      clearTimeout(temporizador);
      const momento = Date.now();
      setAhora(momento);
      const siguiente = proximoCambio({ startsAt, durationMinutes, status }, momento);
      if (siguiente === null) return;
      temporizador = setTimeout(programar, Math.min(siguiente - momento, ESPERA_MAXIMA));
    };
    const alVolver = () => { if (document.visibilityState === 'visible') programar(); };
    programar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [startsAt, durationMinutes, status]);

  return estadoClase(sesion, ahora);
}
