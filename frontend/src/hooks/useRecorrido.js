import { useCallback, useEffect, useRef, useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';

const PREFIJO = 'mentor.recorrido.';

// Olvida qué recorridos ya se vieron, para que vuelvan a abrirse solos (se usa al entrar con una cuenta de prueba).
export function reiniciarRecorridos() {
  try {
    Object.keys(localStorage).filter((llave) => llave.startsWith(PREFIJO)).forEach((llave) => localStorage.removeItem(llave));
  } catch { /* sin almacenamiento: los recorridos ya se muestran siempre */ }
}

// Abre y cierra el recorrido guiado de una página. Con una cuenta de prueba se abre solo en cada inicio de sesión
// (al cerrarlo se recuerda hasta la siguiente entrada); cualquiera puede volver a verlo con «¿Cómo me ayuda esta página?».
export function useRecorrido(clave, listo) {
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef(null);
  const llave = `${PREFIJO}${clave}`;

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
