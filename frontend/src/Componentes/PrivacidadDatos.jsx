import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Campo from './Campo.jsx';
import { MensajeError } from './Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { fechaHora } from '../utils/fechas.js';
import { NOMBRE_DOCUMENTO, RUTA_DOCUMENTO } from '../utils/legal.js';

// Derechos sobre los datos personales: aceptaciones, copia de los datos y baja de la cuenta.
export default function PrivacidadDatos() {
  const { usuario, sesionEliminada } = useSesion();
  const navegar = useNavigate();
  const consentimientos = useDatos('/me/consents');
  const [abierto, setAbierto] = useState(false);
  const [formulario, setFormulario] = useState({ password: '', reason: '', confirm: false });
  const { enviando, error, ejecutar } = useEnvio();
  const descarga = useEnvio();

  async function descargar() {
    const respuesta = await descarga.ejecutar(() => api.get('/me/data-export'));
    if (!respuesta) return;
    const archivo = new Blob([JSON.stringify(respuesta.data, null, 2)], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = 'mis-datos-mentor-ai.json';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  async function eliminar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post('/me/deletion-request', {
      password: formulario.password, confirm: formulario.confirm, ...(formulario.reason ? { reason: formulario.reason } : {}),
    }));
    if (!respuesta) return;
    sesionEliminada();
    navegar(respuesta.data.status === 'completed' ? '/cuenta-eliminada' : '/login', { replace: true });
  }

  const puedeDarseDeBaja = usuario.role !== 'platform_admin';

  return (
    <section className="tarjeta" aria-labelledby="titulo-privacidad">
      <h2 id="titulo-privacidad">Privacidad y datos</h2>
      <h3>Documentos aceptados</h3>
      <ul className="lista-simple">
        {consentimientos.datos?.history?.map((item) => (
          <li key={`${item.document}-${item.version}`}>
            <Link to={RUTA_DOCUMENTO[item.document]}>{NOMBRE_DOCUMENTO[item.document]}</Link>
            <span className="tenue">Versión {item.version} · {fechaHora(item.acceptedAt)}</span>
          </li>
        ))}
      </ul>

      <h3>Copia de mis datos</h3>
      <p className="tenue pequeno">Descarga en formato JSON los datos personales que MENTOR AI guarda sobre ti.</p>
      <button type="button" className="boton secundario" onClick={descargar} disabled={descarga.enviando}>Descargar mis datos</button>
      <MensajeError error={descarga.error} />

      {puedeDarseDeBaja && (
        <>
          <h3>Eliminar mi cuenta</h3>
          {!abierto ? (
            <button type="button" className="boton peligro" onClick={() => setAbierto(true)}>Solicitar la eliminación de mi cuenta</button>
          ) : (
            <form className="zona-peligro" onSubmit={eliminar}>
              <p><strong>Qué pasa al eliminar tu cuenta:</strong></p>
              <ul>
                <li>Se borran tu nombre, correo, teléfono, presentación, foto, contraseña, preferencias y conversaciones con el tutor.</li>
                <li>Se conservan, sin datos que te identifiquen, tus calificaciones y entregas, porque la institución debe mantener el historial académico, y la evidencia de las aceptaciones que diste.</li>
                <li>Se cierra tu sesión y te enviamos una confirmación a tu correo. No se puede deshacer.</li>
              </ul>
              <Campo etiqueta="Motivo (opcional)" valor={formulario.reason} alCambiar={(valor) => setFormulario({ ...formulario, reason: valor })} maxLength={500} />
              <Campo etiqueta="Contraseña actual (para confirmar tu identidad)" tipo="password" autoComplete="current-password" valor={formulario.password}
                alCambiar={(valor) => setFormulario({ ...formulario, password: valor })} required />
              <label className="casilla">
                <input type="checkbox" checked={formulario.confirm} onChange={(evento) => setFormulario({ ...formulario, confirm: evento.target.checked })} required />
                Entiendo que la eliminación es definitiva.
              </label>
              <MensajeError error={error} />
              <div className="acciones">
                <button type="submit" className="boton peligro" disabled={enviando || !formulario.confirm}>Eliminar mi cuenta</button>
                <button type="button" className="boton secundario" onClick={() => setAbierto(false)}>Cancelar</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
