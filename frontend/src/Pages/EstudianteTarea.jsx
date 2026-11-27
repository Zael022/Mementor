import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import Celebracion from '../Componentes/Celebracion.jsx';
import { Contador } from '../Componentes/Animaciones.jsx';
import { Aviso, Cargando, MensajeError } from '../Componentes/Estados.jsx';
import Markdown from '../Componentes/Markdown.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { recordarAvance } from '../utils/avanceMapa.js';
import { fechaHora } from '../utils/fechas.js';

// Permite leer una tarea, entregarla y ver la nota del docente.
export default function EstudianteTarea() {
  const { id } = useParams();
  const tarea = useDatos(`/assignments/${id}`);
  const [texto, setTexto] = useState('');
  const [enlace, setEnlace] = useState('');
  const [guardada, setGuardada] = useState(false);
  const [logro, setLogro] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();
  const entrega = tarea.datos?.submission;

  // Carga en el formulario la entrega anterior para poder corregirla.
  useEffect(() => {
    if (!entrega) return;
    setTexto(entrega.body);
    setEnlace(entrega.linkUrl || '');
  }, [entrega]);

  if (tarea.cargando && !tarea.datos) return <Cargando />;
  if (tarea.error) return <MensajeError error={tarea.error} />;
  const datos = tarea.datos;
  const calificada = entrega && entrega.gradePoints !== null;
  const vencida = datos.dueAt && new Date(datos.dueAt) < new Date();

  async function enviar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post(`/assignments/${id}/submission`, { body: texto, linkUrl: enlace || null }));
    if (!respuesta) return;
    setGuardada(true);
    const { rank, module } = respuesta.data;
    // Solo la primera entrega es un paso nuevo en el mapa (corregirla no suma avance).
    if (rank && rank.after.done > rank.before.done) recordarAvance(datos.courseId, `tarea-${datos.id}`);
    if (rank?.rankedUp || module?.justCompleted) {
      setLogro({ rango: rank.after, subida: rank.rankedUp, modulo: module?.justCompleted ? module.title : null });
    }
    tarea.recargar();
  }

  return (
    <div className="lectura">
      <Link to={`/estudiante/cursos/${datos.courseId}?seccion=trabajo&ver=lecciones`} className="volver">← Volver al mapa del curso</Link>
      <article className="tarjeta">
        <h1>{datos.title}</h1>
        <p className="tenue">{datos.dueAt ? `Entrega: ${fechaHora(datos.dueAt)}` : 'Sin fecha límite'} · {datos.maxPoints} puntos</p>
        <Markdown texto={datos.instructions} />
      </article>

      {calificada && (
        <section className="tarjeta destacada">
          <h2>Calificación</h2>
          <p className="nota"><strong><Contador valor={entrega.gradePoints} /></strong> de {datos.maxPoints} puntos</p>
          {entrega.feedback && <p><span className="tenue">Retroalimentación:</span> {entrega.feedback}</p>}
        </section>
      )}

      <section className="tarjeta">
        <h2>{calificada ? 'Tu entrega' : entrega ? 'Editar tu entrega' : 'Tu entrega'}</h2>
        {entrega && <p className="tenue">Enviada el {fechaHora(entrega.submittedAt)}</p>}
        {calificada ? (
          <>
            <p>{entrega.body}</p>
            {entrega.linkUrl && <p><a href={entrega.linkUrl} target="_blank" rel="noopener noreferrer">Abrir enlace adjunto</a></p>}
          </>
        ) : (
          <form onSubmit={enviar}>
            {vencida && <Aviso>La fecha de entrega ya pasó; tu envío quedará marcado como tardío.</Aviso>}
            <Campo etiqueta="Respuesta" tipo="textarea" filas={8} valor={texto} alCambiar={setTexto} required maxLength={20000} />
            <Campo etiqueta="Enlace a tu trabajo (opcional, https://…)" tipo="url" valor={enlace} alCambiar={setEnlace} placeholder="https://" />
            <MensajeError error={error} />
            {guardada && <Aviso tipo="exito">Entrega guardada. Puedes corregirla mientras no esté calificada.</Aviso>}
            {logro && <Celebracion {...logro} alCerrar={() => setLogro(null)} />}
            <button type="submit" className="boton" disabled={enviando} aria-busy={enviando}>{enviando ? 'Entregando…' : entrega ? 'Actualizar entrega' : 'Entregar tarea'}</button>
          </form>
        )}
      </section>
    </div>
  );
}
