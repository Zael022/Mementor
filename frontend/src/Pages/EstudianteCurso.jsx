import { Link, useParams, useSearchParams } from 'react-router-dom';
import Anuncios from '../Componentes/Anuncios.jsx';
import { TarjetaSesion } from '../Componentes/ClasesEnVivo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { anunciar } from '../Componentes/Anunciador.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import ListaPersonas from '../Componentes/ListaPersonas.jsx';
import { ListaMateriales } from '../Componentes/Materiales.jsx';
import NotaCurso from '../Componentes/NotaCurso.jsx';
import Recomendaciones from '../Componentes/Recomendaciones.jsx';
import RutaLecciones from '../Componentes/RutaLecciones.jsx';
import TarjetaRacha from '../Componentes/TarjetaRacha.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { colorDeCurso } from '../utils/cursos.js';
import { fechaHora } from '../utils/fechas.js';

// Pestañas de la clase, como en un aula virtual.
const PESTANAS = [
  { id: 'novedades', texto: 'Novedades' },
  { id: 'trabajo', texto: 'Trabajo en clase' },
  { id: 'quizzes', texto: 'Quizzes y racha' },
  { id: 'calificaciones', texto: 'Calificaciones' },
  { id: 'personas', texto: 'Personas' },
];

// Filtros dentro de «Trabajo en clase».
const FILTROS = [
  { id: 'todo', texto: 'Todo' },
  { id: 'lecciones', texto: 'Lecciones' },
  { id: 'tareas', texto: 'Tareas' },
  { id: 'evaluaciones', texto: 'Evaluaciones' },
  { id: 'materiales', texto: 'Materiales' },
  { id: 'clases', texto: 'Clases en vivo' },
];

// Enlaces antiguos (?seccion=tareas) siguen funcionando dentro de «Trabajo en clase».
const ANTIGUAS = { contenido: 'lecciones', tareas: 'tareas', evaluaciones: 'evaluaciones', materiales: 'materiales', clases: 'clases' };

function estadoTarea(tarea) {
  if (tarea.gradePoints !== null) return `Calificada: ${tarea.gradePoints} de ${tarea.maxPoints}`;
  if (tarea.submitted) return 'Entregada';
  if (tarea.dueAt && new Date(tarea.dueAt) < new Date()) return 'Faltante';
  return 'Asignada';
}

// Próximas entregas de la clase (como el recuadro «Próximas» del aula).
function Proximas({ tareas, cursoId }) {
  const proximas = (tareas || [])
    .filter((tarea) => !tarea.submitted && tarea.dueAt && new Date(tarea.dueAt) > new Date())
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, 3);
  return (
    <aside className="tarjeta proximas" aria-label="Próximas entregas">
      <h3>Próximas</h3>
      {proximas.length === 0 && <p className="tenue pequeno">¡Excelente! No tienes ninguna tarea por entregar pronto.</p>}
      <ul className="lista-simple">
        {proximas.map((tarea) => (
          <li key={tarea.id}>
            <span className="pequeno">Vence {fechaHora(tarea.dueAt)}<br /><Link to={`/estudiante/tareas/${tarea.id}`}>{tarea.title}</Link></span>
          </li>
        ))}
      </ul>
      <Link className="pequeno" to={`/estudiante/cursos/${cursoId}?seccion=trabajo&ver=tareas`}>Ver todo</Link>
    </aside>
  );
}

// Aula del estudiante: novedades, trabajo en clase, quizzes con racha, calificaciones y personas.
export default function EstudianteCurso() {
  const { id } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const pedida = parametros.get('seccion') || 'novedades';
  const seccion = ANTIGUAS[pedida] ? 'trabajo' : pedida;
  const filtro = ANTIGUAS[pedida] || parametros.get('ver') || 'todo';
  const curso = useDatos(`/courses/${id}`);
  const sesiones = useDatos(`/courses/${id}/sessions`);
  const tareas = useDatos(`/courses/${id}/assignments`);
  const evaluaciones = useDatos(`/courses/${id}/assessments`);
  const anuncios = useDatos(`/courses/${id}/announcements`);
  const recomendaciones = useDatos(seccion === 'trabajo' ? `/me/recommendations?courseId=${id}` : null);
  const quizzes = useDatos(seccion === 'quizzes' ? `/courses/${id}/quick-quizzes` : null);
  const practica = useDatos(seccion === 'quizzes' ? `/courses/${id}/daily-practice` : null);
  const nota = useDatos(seccion === 'calificaciones' || seccion === 'quizzes' ? `/courses/${id}/my-grade` : null);
  const trabajoClase = useDatos(seccion === 'calificaciones' ? `/courses/${id}/class-work` : null);

  if (curso.cargando && !curso.datos) return <Cargando texto="Cargando la clase…" />;
  if (curso.error) return <MensajeError error={curso.error} />;
  const datos = curso.datos;
  const lecciones = datos.modules.flatMap((modulo) => modulo.topics.flatMap((tema) => tema.lessons));
  const completadas = lecciones.filter((leccion) => leccion.completed).length;
  const vigentes = (sesiones.datos || []).filter((sesion) => sesion.state === 'upcoming' || sesion.state === 'live');
  const pasadas = (sesiones.datos || []).filter((sesion) => sesion.state === 'ended' || sesion.state === 'cancelled').reverse();
  const pendiente = lecciones.find((leccion) => !leccion.completed);
  const ver = (opcion) => filtro === 'todo' || filtro === opcion;

  function irA(nueva, extra = {}) {
    setParametros({ seccion: nueva, ...extra }, { replace: true });
    const nombre = PESTANAS.find((opcion) => opcion.id === nueva)?.texto;
    if (nombre && nueva !== seccion) anunciar(`Sección ${nombre}`);
  }

  return (
    <>
      <section className="banner banner-clase" style={{ '--color-clase': colorDeCurso(datos.id) }}>
        <div>
          <span className="pildora clara">{datos.code}</span>
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

      <nav className="pestanas" aria-label="Secciones de la clase">
        {PESTANAS.map((opcion) => (
          <a key={opcion.id} href={`?seccion=${opcion.id}`} className={seccion === opcion.id ? 'active' : ''} aria-current={seccion === opcion.id ? 'page' : undefined}
            onClick={(evento) => { evento.preventDefault(); irA(opcion.id); }}>
            {opcion.texto}
          </a>
        ))}
      </nav>

      {/* El panel entra suave al cambiar de sección para que se note el cambio. */}
      <div key={seccion} className="panel-seccion">
      {seccion === 'novedades' && (
        <div className="novedades">
          <Proximas tareas={tareas.datos} cursoId={id} />
          <div className="flujo">
            {vigentes[0] && <TarjetaSesion sesion={vigentes[0]} destacada alEntrar={sesiones.recargar} />}
            <MensajeError error={anuncios.error} />
            {anuncios.datos?.length === 0 && <EstadoVacio ilustracion="chat" titulo="Aún no hay novedades" detalle="Los anuncios de tu docente aparecerán aquí." />}
            {anuncios.datos?.length > 0 && <section className="tarjeta"><Anuncios lista={anuncios.datos} /></section>}
          </div>
        </div>
      )}

      {seccion === 'trabajo' && (
        <>
          <div className="chips" role="group" aria-label="Filtrar trabajo en clase">
            {FILTROS.map((opcion) => (
              <button key={opcion.id} type="button" className={`chip ${filtro === opcion.id ? 'activo' : ''}`} aria-pressed={filtro === opcion.id}
                onClick={() => irA('trabajo', { ver: opcion.id })}>{opcion.texto}</button>
            ))}
          </div>

          {ver('lecciones') && (
            <section className="bloque-trabajo">
              <h2>Lecciones</h2>
              <Recomendaciones lista={recomendaciones.datos} />
              {datos.modules.length === 0 && <EstadoVacio ilustracion="libro" titulo="Este curso aún no tiene contenido" detalle="Tu docente todavía no ha agregado módulos." />}
              <RutaLecciones modulos={datos.modules} />
            </section>
          )}

          {ver('tareas') && (
            <section className="bloque-trabajo">
              <h2>Tareas</h2>
              <MensajeError error={tareas.error} />
              {tareas.datos?.length === 0 && <EstadoVacio ilustracion="tarea" titulo="No hay tareas asignadas" detalle="Las tareas publicadas por tu docente aparecerán aquí." />}
              <ul className="lista-trabajo">
                {tareas.datos?.map((tarea) => (
                  <li key={tarea.id}>
                    <Link to={`/estudiante/tareas/${tarea.id}`}>{tarea.title}</Link>
                    <span className="tenue pequeno">{tarea.dueAt ? `Vence ${fechaHora(tarea.dueAt)}` : 'Sin fecha límite'}</span>
                    <span className={`estado-trabajo ${estadoTarea(tarea).split(':')[0].toLowerCase()}`}>{estadoTarea(tarea)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ver('evaluaciones') && (
            <section className="bloque-trabajo">
              <h2>Evaluaciones</h2>
              <MensajeError error={evaluaciones.error} />
              {evaluaciones.datos?.length === 0 && <EstadoVacio ilustracion="tarea" titulo="No hay evaluaciones disponibles" detalle="Aparecerán aquí cuando tu docente las publique." />}
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
            </section>
          )}

          {ver('materiales') && (
            <section className="bloque-trabajo">
              <h2>Materiales</h2>
              <section className="tarjeta"><ListaMateriales cursoId={id} mostrarLeccion vacio="Este curso aún no tiene materiales." /></section>
            </section>
          )}

          {ver('clases') && (
            <section className="bloque-trabajo">
              <h2>Clases en vivo</h2>
              <MensajeError error={sesiones.error} />
              {sesiones.datos?.length === 0 && <EstadoVacio ilustracion="calendario" titulo="No hay clases en vivo programadas" detalle="Cuando tu docente programe una clase aparecerá aquí con su cuenta regresiva." />}
              {vigentes.map((sesion) => <TarjetaSesion key={sesion.id} sesion={sesion} alEntrar={sesiones.recargar} />)}
              {pasadas.length > 0 && <h3>Clases anteriores</h3>}
              {pasadas.map((sesion) => <TarjetaSesion key={sesion.id} sesion={sesion} />)}
            </section>
          )}
        </>
      )}

      {seccion === 'quizzes' && (
        <>
          <MensajeError error={practica.error} />
          {practica.datos && (
            <TarjetaRacha racha={practica.datos.streak} valorDia={nota.datos?.policy.streakDayBonus}
              enlace={practica.datos.available ? `/estudiante/cursos/${id}/racha` : null} />
          )}
          {practica.datos && !practica.datos.available && <p className="tenue">La práctica diaria se activa cuando tu docente publique el primer quiz.</p>}
          <h2>Quizzes rápidos</h2>
          <MensajeError error={quizzes.error} />
          {quizzes.cargando && !quizzes.datos && <Cargando texto="Cargando los quizzes…" forma="lista" cantidad={2} />}
          {quizzes.datos?.length === 0 && <EstadoVacio ilustracion="tarea" titulo="No hay quizzes todavía" detalle="Cuando tu docente publique uno podrás jugarlo aquí." />}
          <div className="rejilla">
            {quizzes.datos?.map((quiz) => (
              <article className="tarjeta tarjeta-quiz" key={quiz.id}>
                <h3>{quiz.title}</h3>
                <ul className="meta">
                  <li>{quiz.questionCount} pregunta(s)</li>
                  <li>{quiz.secondsPerQuestion} s c/u</li>
                </ul>
                <p className="tenue pequeno">
                  {quiz.bestScore === null ? 'Aún no lo juegas.' : `Mejor puntaje: ${quiz.bestScore}`}
                  {quiz.perfect && <span className="insignia ready"> Bono ganado</span>}
                </p>
                <Link className="boton" to={`/estudiante/cursos/${id}/quizzes/${quiz.id}`}>{quiz.bestScore === null ? 'Jugar' : 'Jugar de nuevo'}</Link>
              </article>
            ))}
          </div>
        </>
      )}

      {seccion === 'calificaciones' && (
        <>
          <MensajeError error={nota.error} />
          {nota.cargando && !nota.datos && <Cargando texto="Cargando tu nota…" forma="lista" cantidad={2} />}
          {nota.datos && <NotaCurso nota={nota.datos.grade} politica={nota.datos.policy} />}
          <h2>Trabajo en clase</h2>
          <MensajeError error={trabajoClase.error} />
          {trabajoClase.datos?.length === 0 && <p className="tenue">Tu docente aún no ha registrado actividades de trabajo en clase.</p>}
          <ul className="lista-trabajo">
            {trabajoClase.datos?.map((actividad) => {
              const mia = actividad.grades[0];
              return (
                <li key={actividad.id}>
                  <span>{actividad.title}</span>
                  <span className="tenue pequeno">{actividad.workDate || ''}</span>
                  <span className={`estado-trabajo ${mia ? 'calificada' : 'asignada'}`}>{mia ? `${String(mia.points).replace('.', ',')} de ${actividad.maxPoints}` : 'Sin calificar'}</span>
                  {mia?.feedback && <span className="tenue pequeno retro">{mia.feedback}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {seccion === 'personas' && <ListaPersonas cursoId={id} />}
      </div>
    </>
  );
}
