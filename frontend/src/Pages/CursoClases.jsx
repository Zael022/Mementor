import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { CuentaRegresiva } from '../Componentes/ClasesEnVivo.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import Desplegable from '../Componentes/Desplegable.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { aIso, fechaHora } from '../utils/fechas.js';

const VACIO = { title: '', description: '', startsAt: '', durationMinutes: 60, meetingUrl: '' };

// Lista de asistencia de una clase.
function Asistencia({ sesionId }) {
  const asistencia = useDatos(`/sessions/${sesionId}/attendance`);
  if (asistencia.cargando) return <Cargando />;
  if (asistencia.error) return <MensajeError error={asistencia.error} />;
  const { students: estudiantes } = asistencia.datos;
  if (estudiantes.length === 0) return <p className="tenue">No hay estudiantes matriculados en este curso.</p>;

  return (
    <div className="tabla-contenedor">
      <table>
        <thead><tr><th>Estudiante</th><th>Asistencia</th></tr></thead>
        <tbody>
          {estudiantes.map((estudiante) => (
            <tr key={estudiante.id}>
              <td>{estudiante.displayName}</td>
              <td className={estudiante.joinedAt ? 'texto-exito' : 'tenue'}>{estudiante.joinedAt ? `Entró: ${fechaHora(estudiante.joinedAt)}` : 'Sin registro'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Permite programar clases en vivo y revisar la asistencia.
export default function CursoClases() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const sesiones = useDatos(`/courses/${id}/sessions`);
  const [formulario, setFormulario] = useState(VACIO);
  const [abierta, setAbierta] = useState(null);
  const [grabaciones, setGrabaciones] = useState({});
  const { enviando, error, ejecutar } = useEnvio();
  const cambiar = (campo) => (valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;

  async function accion(llamada) {
    const respuesta = await ejecutar(llamada);
    if (respuesta) sesiones.recargar();
    return respuesta;
  }

  async function programar(evento) {
    evento.preventDefault();
    const respuesta = await accion(() => api.post(`/courses/${id}/sessions`, {
      title: formulario.title,
      description: formulario.description || undefined,
      startsAt: aIso(formulario.startsAt),
      durationMinutes: Number(formulario.durationMinutes),
      meetingUrl: formulario.meetingUrl,
    }));
    if (respuesta) setFormulario(VACIO);
  }

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <Desplegable etiqueta="Programar clase en vivo" sugerirAbierto={sesiones.datos?.length === 0}>
        <form className="tarjeta" onSubmit={programar}>
          <div className="fila-formulario">
            <Campo etiqueta="Título" valor={formulario.title} alCambiar={cambiar('title')} required minLength={2} maxLength={180} />
            <Campo etiqueta="Fecha y hora" tipo="datetime-local" valor={formulario.startsAt} alCambiar={cambiar('startsAt')} required />
            <Campo etiqueta="Duración (min)" tipo="number" min={10} max={480} valor={formulario.durationMinutes} alCambiar={cambiar('durationMinutes')} required />
          </div>
          <Campo etiqueta="Enlace de la reunión (Meet, Zoom, Teams…)" tipo="url" valor={formulario.meetingUrl} alCambiar={cambiar('meetingUrl')}
            placeholder="https://" required ayuda="Los estudiantes solo lo reciben al pulsar Entrar, desde 15 minutos antes; ahí se registra su asistencia." />
          <Campo etiqueta="Descripción (opcional)" tipo="textarea" filas={2} valor={formulario.description} alCambiar={cambiar('description')} />
          <button type="submit" className="boton" disabled={enviando}>Programar clase</button>
          <MensajeError error={error} />
        </form>
      </Desplegable>

      <MensajeError error={sesiones.error} />
      {sesiones.cargando && !sesiones.datos && <Cargando />}
      {sesiones.datos?.length === 0 && <EstadoVacio ilustracion="calendario" titulo="No hay clases programadas" detalle="Programa la primera clase con el formulario de arriba." />}
      {sesiones.datos?.map((sesion) => (
        <article className="tarjeta sesion" key={sesion.id}>
          <div className="tarjeta-cabecera">
            <div>
              <h3>{sesion.title} <Insignia estado={sesion.state} /></h3>
              <ul className="meta">
                <li>{fechaHora(sesion.startsAt)}</li>
                <li>{sesion.durationMinutes} min</li>
                <li>{sesion.attendanceCount} asistencia(s) registrada(s)</li>
              </ul>
              {sesion.description && <p>{sesion.description}</p>}
            </div>
            {(sesion.state === 'upcoming' || sesion.state === 'live') && <CuentaRegresiva fecha={sesion.startsAt} />}
          </div>
          <div className="acciones">
            {(sesion.state === 'upcoming' || sesion.state === 'live') && (
              <a className={sesion.canJoin ? 'boton' : 'boton secundario'} href={sesion.meetingUrl} target="_blank" rel="noopener noreferrer">Abrir reunión</a>
            )}
            <button type="button" className="boton secundario" onClick={() => setAbierta(abierta === sesion.id ? null : sesion.id)}>
              {abierta === sesion.id ? 'Ocultar asistencia' : 'Ver asistencia'}
            </button>
            {sesion.state === 'upcoming' && (
              <button type="button" className="boton secundario" onClick={() => accion(() => api.patch(`/sessions/${sesion.id}`, { status: 'cancelled' }))}>Cancelar clase</button>
            )}
            <button type="button" className="boton peligro" onClick={() => accion(() => api.delete(`/sessions/${sesion.id}`))}>Eliminar</button>
          </div>
          {sesion.state === 'ended' && (
            <div className="fila-formulario">
              <Campo etiqueta="Enlace de la grabación (opcional)" tipo="url" placeholder="https://"
                valor={grabaciones[sesion.id] ?? sesion.recordingUrl ?? ''} alCambiar={(valor) => setGrabaciones({ ...grabaciones, [sesion.id]: valor })} />
              <button type="button" className="boton secundario"
                onClick={() => accion(() => api.patch(`/sessions/${sesion.id}`, { recordingUrl: (grabaciones[sesion.id] ?? '') || null }))}>Guardar grabación</button>
            </div>
          )}
          {abierta === sesion.id && <Asistencia sesionId={sesion.id} />}
        </article>
      ))}
    </>
  );
}
