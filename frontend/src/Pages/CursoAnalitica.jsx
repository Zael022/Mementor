import { useParams } from 'react-router-dom';
import { Contador, Revelar } from '../Componentes/Animaciones.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';

const porcentaje = (valor) => (valor === null ? 'n/a' : `${Math.round(valor)} %`);

// Muestra la analítica del curso calculada por el backend.
export default function CursoAnalitica() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const analitica = useDatos(`/teacher/courses/${id}/analytics`);

  if ((curso.cargando && !curso.datos) || (analitica.cargando && !analitica.datos)) return <Cargando />;
  if (curso.error || analitica.error) return <MensajeError error={curso.error || analitica.error} />;
  const datos = analitica.datos;
  const intentos = datos.assessments.reduce((total, evaluacion) => total + evaluacion.submittedAttempts, 0);

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <div className="indicadores">
        <div className="tarjeta indicador"><span>Estudiantes matriculados</span><strong><Contador valor={datos.enrolledStudents} /></strong></div>
        <div className="tarjeta indicador"><span>Evaluaciones</span><strong><Contador valor={datos.assessments.length} /></strong></div>
        <div className="tarjeta indicador"><span>Intentos enviados</span><strong><Contador valor={intentos} /></strong></div>
      </div>

      {intentos === 0 && (
        <EstadoVacio titulo="Aún no hay intentos enviados" detalle="Las estadísticas aparecerán cuando los estudiantes resuelvan evaluaciones publicadas." />
      )}

      <Revelar etiqueta="section" className="tarjeta">
        <h2>Evaluaciones</h2>
        {datos.assessments.length === 0 ? <p className="tenue">No hay evaluaciones en este curso.</p> : (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Evaluación</th><th>Estado</th><th>Intentos</th><th>Estudiantes</th><th>Promedio</th><th>Aprobación</th></tr></thead>
              <tbody>
                {datos.assessments.map((evaluacion) => (
                  <tr key={evaluacion.id}>
                    <td>{evaluacion.title}</td>
                    <td><Insignia estado={evaluacion.status} /></td>
                    <td>{evaluacion.submittedAttempts}</td>
                    <td>{evaluacion.studentsWithAttempts}</td>
                    <td>{porcentaje(evaluacion.averageScorePct)}</td>
                    <td>{porcentaje(evaluacion.passRatePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Revelar>

      <Revelar etiqueta="section" className="tarjeta">
        <h2>Resultados por tema</h2>
        <p className="tenue">El dominio es una estimación basada en respuestas; no es una calificación oficial.</p>
        {datos.topics.length === 0 ? <p className="tenue">No hay temas en este curso.</p> : (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Tema</th><th>Respuestas</th><th>Aciertos</th><th>Dominio promedio</th><th>Estudiantes con evidencia</th></tr></thead>
              <tbody>
                {datos.topics.map((tema) => (
                  <tr key={tema.id}>
                    <td>{tema.title}</td>
                    <td>{tema.answers}</td>
                    <td>{porcentaje(tema.correctPct)}</td>
                    <td>{tema.averageMastery === null ? 'n/a' : porcentaje(tema.averageMastery * 100)}</td>
                    <td>{tema.studentsWithEvidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Revelar>

      <Revelar etiqueta="section" className="tarjeta">
        <h2>Estudiantes</h2>
        {datos.students.length === 0 ? <p className="tenue">No hay estudiantes matriculados.</p> : (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Estudiante</th><th>Intentos enviados</th><th>Promedio</th><th>Último envío</th></tr></thead>
              <tbody>
                {datos.students.map((estudiante) => (
                  <tr key={estudiante.id}>
                    <td>{estudiante.displayName}</td>
                    <td>{estudiante.submittedAttempts}</td>
                    <td>{porcentaje(estudiante.averageScorePct)}</td>
                    <td>{estudiante.lastSubmittedAt ? new Date(estudiante.lastSubmittedAt).toLocaleString() : 'Sin envíos'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Revelar>
    </>
  );
}
