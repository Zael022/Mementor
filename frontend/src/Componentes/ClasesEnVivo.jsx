import { Insignia, MensajeError } from './Estados.jsx';
import { useAhora } from '../hooks/useAhora.js';
import { useEstadoClase } from '../hooks/useEstadoClase.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { fechaHora, partesDeTiempo } from '../utils/fechas.js';

// Cuenta regresiva que se actualiza cada segundo.
export function CuentaRegresiva({ fecha }) {
  const ahora = useAhora(1000);
  const restante = new Date(fecha).getTime() - ahora;
  if (restante <= 0) return <span className="en-vivo">En curso</span>;
  const { dias, horas, minutos, segundos } = partesDeTiempo(restante);
  const cajas = dias > 0
    ? [[dias, 'días'], [horas, 'h'], [minutos, 'min']]
    : [[horas, 'h'], [minutos, 'min'], [segundos, 's']];

  return (
    <div className="cuenta" role="timer" aria-label="Tiempo restante para la clase">
      {cajas.map(([valor, unidad]) => (
        <span key={unidad}><strong>{String(valor).padStart(2, '0')}</strong>{unidad}</span>
      ))}
    </div>
  );
}

// Abre la reunión y registra la asistencia del estudiante.
export function useEntrarClase(sesion, alEntrar) {
  const { enviando, error, ejecutar } = useEnvio();

  // La pestaña se abre en el mismo clic para que el navegador no la bloquee.
  async function entrar() {
    const ventana = window.open('', '_blank');
    const respuesta = await ejecutar(() => api.post(`/sessions/${sesion.id}/join`));
    if (!respuesta) {
      ventana?.close();
      return;
    }
    if (ventana) {
      ventana.opener = null;
      ventana.location.href = respuesta.data.meetingUrl;
    } else {
      window.location.href = respuesta.data.meetingUrl;
    }
    alEntrar?.();
  }

  return { entrar, enviando, error };
}

// Tarjeta de una clase para el estudiante, con botón para entrar.
export function TarjetaSesion({ sesion, alEntrar, destacada = false }) {
  const { entrar, enviando, error } = useEntrarClase(sesion, alEntrar);
  // El botón se activa solo al abrirse la ventana, aunque la página lleve tiempo abierta.
  const { estado, puedeEntrar } = useEstadoClase(sesion);

  return (
    <article className={`tarjeta sesion ${destacada ? 'destacada' : ''}`}>
      <div className="tarjeta-cabecera">
        <div>
          {sesion.courseTitle && <span className="pildora">{sesion.courseTitle}</span>}
          <h3>{sesion.title} <Insignia estado={estado} /></h3>
          <ul className="meta">
            <li>{fechaHora(sesion.startsAt)}</li>
            <li>{sesion.durationMinutes} min</li>
            {sesion.attended && <li className="texto-exito">Asistencia registrada</li>}
          </ul>
          {sesion.description && <p>{sesion.description}</p>}
        </div>
        {(estado === 'upcoming' || estado === 'live') && <CuentaRegresiva fecha={sesion.startsAt} />}
      </div>
      <div className="acciones">
        {puedeEntrar && <button type="button" className="boton" disabled={enviando} onClick={entrar}>Entrar a la clase</button>}
        {estado === 'upcoming' && !puedeEntrar && <span className="tenue pequeno">El botón para entrar se activa 15 minutos antes.</span>}
        {sesion.recordingUrl && <a className="boton secundario" href={sesion.recordingUrl} target="_blank" rel="noopener noreferrer">Ver grabación</a>}
      </div>
      <MensajeError error={error} />
    </article>
  );
}
