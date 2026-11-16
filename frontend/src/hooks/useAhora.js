import { useEffect, useState } from 'react';

// Devuelve la hora actual y la refresca cada cierto tiempo.
export function useAhora(intervaloMs = 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    let reloj;
    const actualizar = () => setAhora(Date.now());
    const sincronizar = () => {
      clearInterval(reloj);
      if (document.visibilityState === 'hidden') return;
      actualizar();
      reloj = setInterval(actualizar, intervaloMs);
    };
    sincronizar();
    document.addEventListener('visibilitychange', sincronizar);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', sincronizar);
    };
  }, [intervaloMs]);
  return ahora;
}
