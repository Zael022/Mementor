import { Link } from 'react-router-dom';
import { TarjetaInteractiva } from '../Componentes/Animaciones.jsx';
import Anuncios from '../Componentes/Anuncios.jsx';
import { CuentaRegresiva, TarjetaSesion, useEntrarClase } from '../Componentes/ClasesEnVivo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useEstadoClase } from '../hooks/useEstadoClase.js';
import { useDatos } from '../hooks/useDatos.js';
import { colorDeCurso } from '../utils/cursos.js';
import { fechaHora } from '../utils/fechas.js';

// La próxima clase ocupa el lugar principal de la página.
function ClasePrincipal({ sesion, nombre, alEntrar }) {
  const { entrar, enviando, error } = useEntrarClase(sesion, alEntrar);
  const { estado, puedeEntrar } = useEstadoClase(sesion);
  return (
    <section className="clase-principal">
      <div>
        <p className="saludo">Hola, {nombre}. Tu próxima clase:</p>
        <h1>{sesion.title}</h1>
        <ul className="meta">
          <li>{sesion.courseTitle}</li>
          <li>{fechaHora(sesion.startsAt)}</li>
          <li>{sesion.durationMinutes} min</li>
          {sesion.attended && <li>Asistencia registrada</li>}
        </ul>
        <div className="acciones">
          {puedeEntrar
            ? <button type="button" className="boton" disabled={enviando} onClick={entrar}>Entrar a la clase</button>
            : <span className="tenue">El botón para entrar se activa 15 minutos antes.</span>}
          <Insignia estado={estado} />
        </div>
        <MensajeError error={error} />
      </div>
      <CuentaRegresiva fecha={sesion.startsAt} />
    </section>
  );
}

// Página de inicio del estudiante: lo próximo y lo pendiente en un solo lugar.
export default function EstudianteInicio() {
  const { usuario } = useSesion();
  const inicio = useDatos('/me/home');

  if (inicio.cargando && !inicio.datos) return <Cargando texto="Cargando tu página principal…" forma="tarjetas" />;
  if (inicio.error) return <MensajeError error={inicio.error} />;
  const { courses: cursos, sessions: sesiones, assignments: tareas, announcements: anuncios } = inicio.datos;
  const [proxima, ...otras] = sesiones;
  const nombre = usuario.displayName.split(' ')[0];

  return (
    <>
      {proxima ? (
        <ClasePrincipal sesion={proxima} nombre={nombre} alEntrar={inicio.recargar} />
      ) : (
        <section className="banner">
          <div>
            <h1>Hola, {nombre}</h1>
            <p>{cursos.length === 0 ? 'Aún no tienes cursos asignados.' : 'No tienes clases en vivo programadas por ahora.'}</p>
          </div>
          <div className="acciones">
            <Link className="boton" to="/estudiante/cursos">Ir a mis cursos</Link>
          </div>
        </section>
      )}

      {cursos.length === 0 && (
        <EstadoVacio titulo="Todavía no hay nada por aquí" detalle="Cuando te matriculen en un curso publicado verás tus clases, tareas y anuncios en esta página." />
      )}

      {cursos.length > 0 && (
        <>
          {otras.length > 0 && <h2>Más clases próximas</h2>}
          {otras.map((sesion) => <TarjetaSesion key={sesion.id} sesion={sesion} alEntrar={inicio.recargar} />)}

          <div className="dos-columnas inicio-columnas">
            <section className="tarjeta">
              <div className="titulo-con-dato"><h2>Vence pronto</h2><Link className="pequeno" to="/pendientes">Ver pendientes</Link></div>
              {tareas.length === 0 && <p className="tenue">No tienes tareas pendientes.</p>}
              <ul className="lista-simple">
                {tareas.map((tarea) => (
                  <li key={tarea.id}>
                    <span><Link to={`/estudiante/tareas/${tarea.id}`}>{tarea.title}</Link><br /><span className="tenue pequeno">{tarea.courseTitle}</span></span>
                    <span className="tenue pequeno">{tarea.dueAt ? `Entrega: ${fechaHora(tarea.dueAt)}` : 'Sin fecha límite'}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="tarjeta">
              <h2>Anuncios recientes</h2>
              <Anuncios lista={anuncios} />
            </section>
          </div>

          <h2>Clases</h2>
          <div className="rejilla">
            {cursos.map((curso) => {
              const avance = curso.totalLessons ? Math.round((curso.completedLessons / curso.totalLessons) * 100) : 0;
              return (
                <TarjetaInteractiva key={curso.id} to={`/estudiante/cursos/${curso.id}`} color={colorDeCurso(curso.id)}>
                  <span className="codigo">{curso.code}</span>
                  <h3>{curso.title}</h3>
                  <div className="pie">
                    <div className="barra-avance" role="img" aria-label={`Avance ${avance} por ciento`}><div style={{ width: `${avance}%` }} /></div>
                    <span className="tenue pequeno">{curso.completedLessons} de {curso.totalLessons} lecciones completadas</span>
                  </div>
                </TarjetaInteractiva>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
