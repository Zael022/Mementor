import { Link, useParams } from 'react-router-dom';
import { Aviso, Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';

const ORIGEN = { lesson: 'Lección del curso', material: 'Material del curso', drive: 'Documento de Google Drive' };

// Muestra el pasaje que respaldó una respuesta del tutor; el servidor valida el acceso.
export default function CitaTutor() {
  const { messageId, posicion } = useParams();
  const { usuario } = useSesion();
  const esEstudiante = usuario.role === 'student';
  const cita = useDatos(`/tutor/messages/${messageId}/citations/${posicion}`);

  if (cita.cargando && !cita.datos) return <Cargando />;
  if (cita.error) {
    return (
      <>
        <button type="button" className="volver enlace" onClick={() => window.history.back()}>← Volver</button>
        {cita.error.code === 'SOURCE_RETIRED'
          ? <Aviso tipo="error">{cita.error.message}</Aviso>
          : <MensajeError error={cita.error} />}
      </>
    );
  }
  const datos = cita.datos;
  const base = esEstudiante ? '/estudiante' : '/docente';
  const ubicacion = [datos.page ? `Página ${datos.page}` : null, datos.heading ? `Sección «${datos.heading}»` : null, datos.section && !datos.heading ? `Fragmento ${datos.section}` : null]
    .filter(Boolean).join(' · ');

  return (
    <>
      <Link to={`${base}/tutor/${datos.courseId}`} className="volver">← Volver al tutor</Link>
      <article className="tarjeta cita">
        <p className="pildora">{ORIGEN[datos.origin]}</p>
        <h1>{datos.title}</h1>
        <p className="tenue">{ubicacion || 'Ubicación no disponible'} · Versión {datos.versionNo}</p>
        {datos.newerVersionNo && (
          <Aviso>Este pasaje corresponde a la versión {datos.versionNo}. El docente publicó la versión {datos.newerVersionNo}; las respuestas nuevas usan esa.</Aviso>
        )}
        <blockquote className="pasaje">{datos.passage}</blockquote>
        <div className="acciones">
          {datos.origin === 'lesson' && datos.lessonId && <Link className="boton secundario" to={`${base === '/docente' ? '/docente' : '/estudiante'}/lecciones/${datos.lessonId}`}>Abrir la lección</Link>}
          {datos.origin === 'material' && datos.materialId && <a className="boton secundario" href={`/api/v1/materials/${datos.materialId}/download`}>Descargar el archivo</a>}
        </div>
      </article>
    </>
  );
}
