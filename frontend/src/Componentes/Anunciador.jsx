import { useEffect, useState } from 'react';

const EVENTO = 'mentor:anunciar';

// Pide anunciar un mensaje al lector de pantalla (guardado, error, resultado).
export function anunciar(mensaje) {
  if (typeof window === 'undefined' || !mensaje) return;
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: String(mensaje) }));
}

// Región viva única y siempre presente: así los lectores de pantalla no se pierden los avisos.
export default function Anunciador() {
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let espera;
    const recibir = (evento) => {
      // Se vacía primero para que un mismo mensaje repetido también se lea.
      setMensaje('');
      clearTimeout(espera);
      espera = setTimeout(() => setMensaje(evento.detail), 60);
    };
    window.addEventListener(EVENTO, recibir);
    return () => { window.removeEventListener(EVENTO, recibir); clearTimeout(espera); };
  }, []);

  return <div className="solo-lector" role="status" aria-live="polite" aria-atomic="true">{mensaje}</div>;
}
