import { Link, useParams, useSearchParams } from 'react-router-dom';
import Anuncios from '../Componentes/Anuncios.jsx';
import { TarjetaSesion } from '../Componentes/ClasesEnVivo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { ListaMateriales } from '../Componentes/Materiales.jsx';
import RutaLecciones from '../Componentes/RutaLecciones.jsx';
import Recomendaciones from '../Componentes/Recomendaciones.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { fechaHora } from '../utils/fechas.js';

const SECCIONES = [
  { id: 'contenido', texto: 'Contenido' },
  { id: 'clases', texto: 'Clases en vivo' },
  { id: 'tareas', texto: 'Tareas' },
  { id: 'evaluaciones', texto: 'Evaluaciones' },
  { id: 'materiales', texto: 'Materiales' },
];

// Aula del estudiante: contenido, clases, tareas, evaluaciones y materiales del curso.
export default function EstudianteCurso() {
  const { id } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const seccion = parametros.get('seccion') || 'contenido';
  const curso = useDatos(`/courses/${id}`);
  const sesiones = useDatos(`/courses/${id}/sessions`);
  const tareas = useDatos(`/courses/${id}/assignments`);
  const evaluaciones = useDatos(`/courses/${id}/assessments`);
  const anuncios = useDatos(`/courses/${id}/announcements`);
  const recomendaciones = useDatos(`/me/recommendations?courseId=${id}`);

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;
  const datos = curso.datos;
  const lecciones = datos.modules.flatMap((modulo) => modulo.topics.flatMap((tema) => tema.lessons));
  const completadas = lecciones.filter((leccion) => leccion.completed).length;
  const vigentes = (sesiones.datos || []).filter((sesion) => sesion.state === 'upcoming' || sesion.state === 'live');
  const pasadas = (sesiones.datos || []).filter((sesion) => sesion.state === 'ended' || sesion.state === 'cancelled').reverse();
  const pendiente = lecciones.find((leccion) => !leccion.completed);

  return (
    <>
      <section className="banner">
        <div>
          <Link to="/estudiante/cursos" className="volver">← Volver a mis cursos</Link>
          <br />
          <span className="pildora">{datos.code}</span>
          <h1>{datos.title}</h1>
          {datos.description && <p>{datos.description}</p>}
          <div className="barra-avance" role="img" aria-label={`Avance: ${completadas} de ${lecciones.length} lecciones`}>
            <div style={{ width: `${lecciones.length ? (completadas / lecciones.length) * 100 : 0}%` }} />
          </div>
          <ul className="meta">
            <li>{completadas} de {lecciones.length} lecciones completadas</li>
            <li>Docente: {datos.teachers.map((docente) => docente.displayName).join(', ') || 'sin asignar'}</li>
          </ul>
        </div>
        <div className="acciones">
          {pendiente && <Link className="boton" to={`/estudiante/lecciones/${pendiente.id}`}>{completadas > 0 ? 'Continuar' : 'Empezar'}</Link>}
          <Link className="boton secundario" to={`/estudiante/tutor/${id}`}>Preguntar al tutor IA</Link>
        </div>
      </section>

      {vigentes[0] && <TarjetaSesion sesion={vigentes[0]} destacada alEntrar={sesiones.recargar} />}
      {anuncios.datos?.length > 0 && (
        <section className="tarjeta">
          <h2>Anuncios</h2>
          <Anuncios lista={anuncios.datos.slice(0, 3)} />
        </section>
      )}

      <nav className="pestanas" aria-label="Secciones del curso">
        {SECCIONES.map((opcion) => (
          <a key={opcion.id} href={`?seccion=${opcion.id}`} className={seccion === opcion.id ? 'active' : ''} aria-current={seccion === opcion.id ? 'page' : undefined}
            onClick={(evento) => { evento.preventDefault(); setParametros({ seccion: opcion.id }, { replace: true }); }}>
            {opcion.texto}
          </a>
        ))}
      </nav>

      {seccion === 'contenido' && (
        <>
          <Recomendaciones lista={recomendaciones.datos} />
          {datos.modules.length === 0 && <EstadoVacio titulo="Este curso aún no tiene contenido" detalle="Tu docente todavía no ha agregado módulos." />}
          <RutaLecciones modulos={datos.modules} />
        </>
      )}

      {seccion === 'clases' && (
        <>
          <MensajeError error={sesiones.error} />
          {sesiones.datos?.length === 0 && <EstadoVacio titulo="No hay clases en vivo programadas" detalle="Cuando tu docente programe una clase aparecerá aquí con su cuenta regresiva." />}
          {vigentes.map((sesion) => <TarjetaSesion key={sesion.id} sesion={sesion} alEntrar={sesiones.recargar} />)}
          {pasadas.length > 0 && <h2>Clases anteriores</h2>}
          {pasadas.map((sesion) => <TarjetaSesion key={sesion.id} sesion={sesion} />)}
        </>
      )}

      {seccion === 'tareas' && (
        <>
          <MensajeError error={tareas.error} />
          {tareas.datos?.length === 0 && <EstadoVacio titulo="No hay tareas asignadas" detalle="Las tareas publicadas por tu docente aparecerán aquí." />}
          {tareas.datos?.map((tarea) => (
            <article className="tarjeta" key={tarea.id}>
              <div className="tarjeta-cabecera">
                <div>
                  <h3>{tarea.title}</h3>
                  <ul className="meta">
                    <li>{tarea.dueAt ? `Entrega: ${fechaHora(tarea.dueAt)}` : 'Sin fecha límite'}</li>
                    <li>{tarea.maxPoints} puntos</li>
                    <li>{tarea.gradePoints !== null ? `Nota: ${tarea.gradePoints} de ${tarea.maxPoints}` : tarea.submitted ? 'Entregada, sin calificar' : 'Sin entregar'}</li>
                  </ul>
                </div>
                <Link className={tarea.submitted ? 'boton secundario' : 'boton'} to={`/estudiante/tareas/${tarea.id}`}>{tarea.submitted ? 'Ver entrega' : 'Entregar'}</Link>
              </div>
            </article>
          ))}
        </>
      )}

      {seccion === 'evaluaciones' && (
        <>
          <MensajeError error={evaluaciones.error} />
          {evaluaciones.datos?.length === 0 && <EstadoVacio titulo="No hay evaluaciones disponibles" detalle="Aparecerán aquí cuando tu docente las publique." />}
          {evaluaciones.datos?.map((evaluacion) => (
            <article className="tarjeta" key={evaluacion.id}>
              <div className="tarjeta-cabecera">
                <div>
                  <h3>{evaluacion.title}</h3>
                  <ul className="meta">
                    <li>Tema: {evaluacion.topicTitle}</li>
                    <li>{evaluacion.questionCount} pregunta(s)</li>
                    <li>Intentos: {evaluacion.attemptsUsed} de {evaluacion.maxAttempts}</li>
                    {evaluacion.bestScorePct !== null && <li>Mejor puntaje: {evaluacion.bestScorePct} %</li>}
                  </ul>
                </div>
                <div className="acciones">
                  {evaluacion.status === 'published' && evaluacion.attemptsUsed < evaluacion.maxAttempts && (
                    <Link className="boton" to={`/estudiante/evaluaciones/${evaluacion.id}`}>Resolver</Link>
                  )}
                  {evaluacion.lastAttemptId && <Link className="boton secundario" to={`/estudiante/resultados/${evaluacion.lastAttemptId}`}>Último resultado</Link>}
                </div>
              </div>
            </article>
          ))}
        </>
      )}

      {seccion === 'materiales' && (
        <section className="tarjeta">
          <h2>Materiales del curso</h2>
          <ListaMateriales cursoId={id} mostrarLeccion vacio="Este curso aún no tiene materiales." />
        </section>
      )}
    </>
  );
}
