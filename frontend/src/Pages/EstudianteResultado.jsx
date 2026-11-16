import { Link, useParams } from 'react-router-dom';
import { AnilloPuntaje, Contador } from '../Componentes/Animaciones.jsx';
import { Aviso, Cargando, MensajeError } from '../Componentes/Estados.jsx';
import Recomendaciones from '../Componentes/Recomendaciones.jsx';
import { useDatos } from '../hooks/useDatos.js';

// Muestra la corrección del intento y las recomendaciones resultantes.
export default function EstudianteResultado() {
  const { attemptId } = useParams();
  const resultado = useDatos(`/attempts/${attemptId}/result`);
  const cursoId = resultado.datos?.assessment.courseId;
  const recomendaciones = useDatos(cursoId ? `/me/recommendations?courseId=${cursoId}` : null);

  if (resultado.cargando && !resultado.datos) return <Cargando />;
  if (resultado.error) return <MensajeError error={resultado.error} />;
  const datos = resultado.datos;

  return (
    <>
      <Link to={`/estudiante/cursos/${cursoId}`} className="volver">← Volver al curso</Link>
      <h1>Resultado: {datos.assessment.title}</h1>
      <div className="indicadores">
        <div className="tarjeta indicador"><span>Puntaje</span><AnilloPuntaje porcentaje={Math.round(datos.scorePct)} aprobado={datos.passed} /></div>
        <div className="tarjeta indicador"><span>Puntos</span><strong><Contador valor={datos.earnedPoints} /> de {datos.totalPoints}</strong></div>
        <div className="tarjeta indicador"><span>Nota mínima {datos.assessment.passingScore} %</span><strong>{datos.passed ? 'Aprobado' : 'No aprobado'}</strong></div>
      </div>
      {!datos.keyRevealed && <Aviso>Las respuestas correctas se muestran cuando ya no te quedan intentos o la evaluación se cierra.</Aviso>}

      <Recomendaciones lista={recomendaciones.datos} />

      <h2>Revisión</h2>
      {datos.questions.map((pregunta, indice) => (
        <article className="tarjeta" key={pregunta.id}>
          <p><strong>{indice + 1}. {pregunta.stem}</strong></p>
          <p className={pregunta.isCorrect ? 'texto-exito' : 'texto-error'}>
            {pregunta.isCorrect ? 'Correcta' : 'Incorrecta'} · {pregunta.earnedPoints} de {pregunta.points} pt
          </p>
          <ul className="lista-opciones">
            {pregunta.options.map((opcion) => (
              <li key={opcion.id}>
                {opcion.body}
                {opcion.id === pregunta.selectedOptionId && <span className="tenue"> — tu respuesta</span>}
                {opcion.isCorrect && <span className="texto-exito"> — correcta</span>}
              </li>
            ))}
          </ul>
          {pregunta.selectedOptionId === null && <p className="tenue">No respondiste esta pregunta.</p>}
          {pregunta.explanation && <p><span className="tenue">Explicación:</span> {pregunta.explanation}</p>}
        </article>
      ))}
    </>
  );
}
