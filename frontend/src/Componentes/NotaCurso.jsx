import { Contador } from './Animaciones.jsx';

const coma = (valor, decimales = 2) => Number(valor).toFixed(decimales).replace('.', ',');

// Una barra por cada parte de la nota, con su peso.
function Parte({ titulo, porcentaje, peso, contadas, detalle }) {
  return (
    <li className="parte-nota">
      <div className="parte-cabecera">
        <strong>{titulo}</strong>
        <span className="tenue pequeno">Peso {peso} %</span>
      </div>
      <div className="barra-avance" role="img" aria-label={porcentaje === null ? `${titulo}: sin calificaciones todavía` : `${titulo}: ${coma(porcentaje, 1)} por ciento`}>
        <div style={{ width: `${porcentaje ?? 0}%` }} />
      </div>
      <span className="tenue pequeno">{porcentaje === null ? 'Sin calificaciones todavía' : `${coma(porcentaje, 1)} % · ${contadas} ${detalle}`}</span>
    </li>
  );
}

// Nota del curso con su desglose: evaluaciones, tareas, trabajo en clase y bono.
export default function NotaCurso({ nota, politica }) {
  const topeAlcanzado = nota.bonusEarned > nota.bonusApplied;
  return (
    <section className="tarjeta nota-curso" aria-label="Nota del curso">
      <div className="nota-principal">
        <p className="tenue">Nota actual (de 0 a {politica.scale})</p>
        <p className="nota-grande">{nota.final === null ? '—' : <Contador valor={nota.final} decimales={2} />}</p>
        {nota.final === null && <p className="tenue pequeno">Aparecerá cuando tengas algo calificado.</p>}
        {nota.base !== null && <p className="tenue pequeno">{coma(nota.base)} de calificaciones + {coma(nota.bonusApplied)} de bono</p>}
      </div>
      <ul className="partes-nota">
        <Parte titulo="Evaluaciones" porcentaje={nota.assessmentsPct} peso={politica.assessmentsWeight} contadas={nota.assessmentsCounted} detalle="evaluación(es)" />
        <Parte titulo="Tareas" porcentaje={nota.assignmentsPct} peso={politica.assignmentsWeight} contadas={nota.assignmentsCounted} detalle="tarea(s) calificada(s)" />
        <Parte titulo="Trabajo en clase" porcentaje={nota.classworkPct} peso={politica.classworkWeight} contadas={nota.classworkCounted} detalle="actividad(es)" />
      </ul>
      <div className="bono-nota">
        <h3>Bono</h3>
        <ul className="meta">
          <li>Quizzes perfectos: {nota.perfectQuizzes} (+{coma(nota.quizBonus)})</li>
          <li>Días de racha: {nota.streakDaysEarned} (+{coma(nota.streakBonus)})</li>
          <li>Tope del curso: {coma(politica.bonusCap)}</li>
        </ul>
        {topeAlcanzado && <p className="aviso">Llegaste al tope del bono de este curso: ganaste {coma(nota.bonusEarned)}, pero cuentan {coma(nota.bonusApplied)}.</p>}
      </div>
    </section>
  );
}
