import { useCallback, useEffect, useRef, useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';

// Abre y cierra el recorrido guiado de una página. Con una cuenta de prueba se abre solo la primera vez
// (se recuerda en este navegador); cualquiera puede volver a verlo con el botón «¿Cómo me ayuda esta página?».
export function useRecorrido(clave, listo) {
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef(null);
  const llave = `mentor.recorrido.${clave}`;

  useEffect(() => {
    if (!listo || !usuario?.isDemo) return;
    let visto = false;
    try { visto = localStorage.getItem(llave) === 'visto'; } catch { /* sin almacenamiento: se muestra igual */ }
    if (!visto) setAbierto(true);
  }, [listo, usuario?.isDemo, llave]);

  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => {
    setAbierto(false);
    try { localStorage.setItem(llave, 'visto'); } catch { /* el recorrido simplemente volverá a ofrecerse */ }
    boton.current?.focus();
  }, [llave]);

  return { abierto, abrir, cerrar, boton };
}
