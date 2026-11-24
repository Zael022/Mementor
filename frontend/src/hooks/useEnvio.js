import { useCallback, useRef, useState } from 'react';

// Ejecuta una acción del usuario y guarda su estado de envío y error.
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const ocupado = useRef(false);

  const ejecutar = useCallback(async (accion) => {
    if (ocupado.current) return undefined;
    ocupado.current = true;
    setEnviando(true);
    setError(null);
    try {
      return await accion();
    } catch (fallo) {
      setError(fallo);
      return undefined;
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }, []);

  return { enviando, error, ejecutar, limpiarError: () => setError(null) };
}
