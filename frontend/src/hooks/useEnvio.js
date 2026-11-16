import { useCallback, useState } from 'react';

// Ejecuta una acción del usuario y guarda su estado de envío y error.
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const ejecutar = useCallback(async (accion) => {
    setEnviando(true);
    setError(null);
    try {
      return await accion();
    } catch (fallo) {
      setError(fallo);
      return undefined;
    } finally {
      setEnviando(false);
    }
  }, []);

  return { enviando, error, ejecutar, limpiarError: () => setError(null) };
}
