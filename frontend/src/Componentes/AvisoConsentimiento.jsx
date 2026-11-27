import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MensajeError } from './Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { NOMBRE_DOCUMENTO, RUTA_DOCUMENTO } from '../utils/legal.js';

// Diálogo que pide aceptar los documentos pendientes (cuentas anteriores o versiones nuevas).
export default function AvisoConsentimiento() {
  const { pendientes = [], consentimientosAceptados, cerrarSesion } = useSesion();
  const [marcado, setMarcado] = useState(false);
  const { enviando, error, ejecutar } = useEnvio();
  const dialogo = useRef(null);

  useEffect(() => {
    const nodo = dialogo.current;
    if (pendientes.length && nodo && !nodo.open) nodo.showModal?.();
  }, [pendientes.length]);

  if (!pendientes.length) return null;

  async function aceptar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post('/me/consents', { documents: pendientes.map((item) => item.document) }));
    if (respuesta) {
      dialogo.current?.close?.();
      consentimientosAceptados();
    }
  }

  return (
    // El diálogo no se cierra con Escape: sin aceptar no se usa la plataforma.
    <dialog ref={dialogo} className="dialogo-consentimiento" aria-labelledby="titulo-consentimiento" onCancel={(evento) => evento.preventDefault()}>
      <form onSubmit={aceptar}>
        <h2 id="titulo-consentimiento">Antes de continuar</h2>
        <p>Para seguir usando MENTOR IA necesitamos que leas y aceptes:</p>
        <ul>
          {pendientes.map((item) => (
            <li key={item.document}>
              <Link to={RUTA_DOCUMENTO[item.document]} target="_blank" rel="noopener">{NOMBRE_DOCUMENTO[item.document]}</Link> (versión {item.version})
            </li>
          ))}
        </ul>
        <label className="casilla">
          <input type="checkbox" checked={marcado} onChange={(evento) => setMarcado(evento.target.checked)} required />
          Leí y acepto los documentos indicados.
        </label>
        <MensajeError error={error} />
        <div className="acciones">
          <button type="submit" className="boton" disabled={!marcado || enviando}>Aceptar y continuar</button>
          <button type="button" className="boton secundario" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </form>
    </dialog>
  );
}
