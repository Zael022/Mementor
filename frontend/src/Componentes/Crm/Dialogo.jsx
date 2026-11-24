import { useEffect, useId, useRef } from 'react';

// El diálogo nativo conserva el foco y permite Escape; al cerrar lo devuelve al disparador.
export default function Dialogo({ titulo, alCerrar, children }) {
  const dialog = useRef(null); const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement; const element = dialog.current;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="crm-dialogo" aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); alCerrar(); }}><h2 id={titleId}>{titulo}</h2>{children}<button type="button" className="boton secundario" onClick={alCerrar}>Cerrar</button></dialog>;
}
