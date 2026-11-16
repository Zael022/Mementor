import { Link, useParams } from 'react-router-dom';
import Comentarios from '../Componentes/Comentarios.jsx';
import { useBaseGestion } from '../Componentes/EncabezadoCurso.jsx';
import { Aviso, Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import Markdown from '../Componentes/Markdown.jsx';
import { ListaMateriales } from '../Componentes/Materiales.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Página de una lección: video, lectura, materiales, avance y preguntas.
export default function Leccion() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const esEstudiante = usuario.role === 'student';
  const baseGestion = useBaseGestion();
  const leccion = useDatos(`/lessons/${id}`);
  const { enviando, error, ejecutar } = useEnvio();

  if (leccion.cargando && !leccion.datos) return <Cargando />;
  if (leccion.error) return <MensajeError error={leccion.error} />;
  const datos = leccion.datos;
  const rutaLeccion = (otra) => (esEstudiante ? `/estudiante/lecciones/${otra.id}` : `${baseGestion}/lecciones/${otra.id}`);
  const rutaCurso = esEstudiante ? `/estudiante/cursos/${datos.course.id}` : `${baseGestion}/cursos/${datos.course.id}/contenidos`;

  async function completar() {
    if (await ejecutar(() => api.post(`/lessons/${id}/complete`))) leccion.recargar();
  }

  return (
    <div className="lectura">
      <Link to={rutaCurso} className="volver">← Volver a {datos.course.title}</Link>
      <p className="tenue">Tema: {datos.topic.title} {!esEstudiante && <Insignia estado={datos.status} />}</p>
      {!esEstudiante && <Aviso>Así ven esta lección los estudiantes matriculados.</Aviso>}

      <article className="tarjeta">
        <h1>{datos.title}</h1>
        {datos.videoEmbedUrl && (
          <div className="video">
            <iframe src={datos.videoEmbedUrl} title={`Video de la lección ${datos.title}`} loading="lazy" allowFullScreen
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        )}
        <Markdown texto={datos.bodyMd} />
      </article>

      <section className="tarjeta">
        <h2>Materiales de la lección</h2>
        <ListaMateriales cursoId={datos.course.id} leccionId={datos.id} vacio="Esta lección no tiene materiales adjuntos." />
      </section>

      <MensajeError error={error} />
      {esEstudiante && (
        <div className="acciones">
          {datos.completed
            ? <Aviso tipo="exito">Lección completada.</Aviso>
            : <button type="button" className="boton" disabled={enviando} onClick={completar}>Marcar como completada</button>}
          <Link className="boton secundario" to={`/estudiante/tutor/${datos.course.id}`}>Preguntar al tutor IA</Link>
        </div>
      )}

      <nav className="navegacion-leccion" aria-label="Lecciones del curso">
        {datos.previous ? <Link to={rutaLeccion(datos.previous)}><small>Lección anterior</small>{datos.previous.title}</Link> : <span />}
        {datos.next ? <Link to={rutaLeccion(datos.next)}><small>Lección siguiente</small>{datos.next.title}</Link> : <span />}
      </nav>

      <Comentarios leccionId={datos.id} />
    </div>
  );
}
