import { useState } from 'react';
import { Link } from 'react-router-dom';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { anunciar } from '../Componentes/Anunciador.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import TarjetaRacha from '../Componentes/TarjetaRacha.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { colorDeCurso } from '../utils/cursos.js';
import { fechaHora } from '../utils/fechas.js';

const PESTANAS = [
  { id: 'assigned', texto: 'Asignado', vacio: 'No tienes trabajo asignado pendiente.' },
  { id: 'missing', texto: 'Faltante', vacio: 'No tienes trabajo faltante. ¡Bien!' },
  { id: 'done', texto: 'Entregado', vacio: 'Todavía no has entregado trabajo.' },
];

// Entregas del docente que esperan calificación.
function PorRevisar({ datos, rol }) {
  const base = rol === 'teacher' ? '/docente' : '/admin';
  if (datos.toReview.length === 0) return <EstadoVacio ilustracion="tarea" titulo="No hay entregas por revisar" detalle="Cuando tus estudiantes entreguen tareas aparecerán aquí." />;
  return (
    <ul className="lista-trabajo">
      {datos.toReview.map((item) => (
        <li key={item.submissionId} style={{ '--color-clase': colorDeCurso(item.courseId) }}>
          <Link to={`${base}/cursos/${item.courseId}/tareas`}>{item.assignmentTitle}</Link>
          <span className="tenue pequeno">{item.studentName} · {item.courseTitle}</span>
          <span className="tenue pequeno">Entregada {fechaHora(item.submittedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

// Pendientes del estudiante (asignado, faltante, entregado y rachas) o entregas por revisar del docente.
export default function Pendientes() {
  const { usuario } = useSesion();
  const pendientes = useDatos('/me/todo');
  const [pestana, setPestana] = useState('assigned');

  if (pendientes.cargando && !pendientes.datos) return <Cargando texto="Cargando tus pendientes…" forma="lista" />;
  if (pendientes.error) return <MensajeError error={pendientes.error} />;
  if (usuario.role !== 'student') {
    return (
      <>
        <h1>Por revisar</h1>
        <PorRevisar datos={pendientes.datos} rol={usuario.role} />
      </>
    );
  }

  const datos = pendientes.datos;
  const actual = PESTANAS.find((opcion) => opcion.id === pestana);
  const rachasPendientes = datos.streaks.filter((racha) => !racha.completedToday);

  return (
    <>
      <h1>Pendientes</h1>
      {rachasPendientes.map((racha) => (
        <div key={racha.courseId}>
          <p className="tenue pequeno etiqueta-curso">{racha.courseTitle}</p>
          <TarjetaRacha racha={racha} enlace={`/estudiante/cursos/${racha.courseId}/racha`} />
        </div>
      ))}
      <nav className="pestanas" aria-label="Estado del trabajo">
        {PESTANAS.map((opcion) => (
          <a key={opcion.id} href={`#${opcion.id}`} className={pestana === opcion.id ? 'active' : ''} aria-current={pestana === opcion.id ? 'page' : undefined}
            onClick={(evento) => { evento.preventDefault(); setPestana(opcion.id); anunciar(`${opcion.texto}: ${datos[opcion.id].length}`); }}>
            {opcion.texto} <span className="contador">{datos[opcion.id].length}</span>
          </a>
        ))}
      </nav>
      {datos[pestana].length === 0 && <EstadoVacio ilustracion="tarea" titulo={actual.vacio} />}
      <ul className="lista-trabajo panel-seccion" key={pestana}>
        {datos[pestana].map((tarea) => (
          <li key={tarea.id} style={{ '--color-clase': colorDeCurso(tarea.courseId) }}>
            <Link to={`/estudiante/tareas/${tarea.id}`}>{tarea.title}</Link>
            <span className="tenue pequeno">{tarea.courseTitle}</span>
            <span className="tenue pequeno">
              {pestana === 'done'
                ? (tarea.gradePoints !== null ? `Calificada: ${tarea.gradePoints} de ${tarea.maxPoints}` : `Entregada ${fechaHora(tarea.submittedAt)}`)
                : (tarea.dueAt ? `Vence ${fechaHora(tarea.dueAt)}` : 'Sin fecha límite')}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
