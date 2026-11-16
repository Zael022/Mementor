import { useId, useState } from 'react';

// Botón que abre un formulario debajo; se abre solo cuando la lista aún está vacía.
export default function Desplegable({ etiqueta, sugerirAbierto = false, children }) {
  const [manual, setManual] = useState(null);
  const abierto = manual ?? sugerirAbierto;
  const id = useId();

  return (
    <div className={`desplegable ${abierto ? 'abierto' : ''}`}>
      <button type="button" className="boton desplegable-boton" aria-expanded={abierto} aria-controls={id} onClick={() => setManual(!abierto)}>
        {etiqueta}
      </button>
      <div className="desplegable-panel" id={id}>
        <div inert={!abierto}>{children}</div>
      </div>
    </div>
  );
}
