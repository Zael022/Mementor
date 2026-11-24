import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

// Carga datos del backend y expone los estados de carga y error.
export function useDatos(ruta) {
  const [estado, setEstado] = useState({ datos: null, meta: null, cargando: Boolean(ruta), error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!ruta) return undefined;
    let vigente = true;
    const controller = new AbortController();
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    api.get(ruta, { signal: controller.signal })
      .then((respuesta) => vigente && setEstado({ datos: respuesta.data, meta: respuesta.meta || null, cargando: false, error: null }))
      .catch((error) => vigente && setEstado({ datos: null, meta: null, cargando: false, error }));
    return () => { vigente = false; controller.abort(); };
  }, [ruta, version]);

  const recargar = useCallback(() => setVersion((actual) => actual + 1), []);
  return { ...estado, recargar };
}
