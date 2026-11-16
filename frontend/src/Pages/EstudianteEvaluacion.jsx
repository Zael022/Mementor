import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Aviso, Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Permite resolver un cuestionario y enviarlo para su corrección.
export default function EstudianteEvaluacion() {
  const { id } = useParams();
  const navegar = useNavigate();
  const evaluacion = useDatos(`/assessments/${id}`);
  const [intentoId, setIntentoId] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [confirmando, setConfirmando] = useState(false);
  const { enviando, error, ejecutar } = useEnvio();

  if (evaluacion.cargando && !evaluacion.datos) return <Cargando />;
  if (evaluacion.error) return <MensajeError error={evaluacion.error} />;
  const datos = evaluacion.datos;
  const restantes = datos.maxAttempts - datos.attemptsUsed;
  const sinResponder = datos.questions.filter((pregunta) => !respuestas[pregunta.id]).length;

  async function comenzar() {
    const respuesta = await ejecutar(() => api.post(`/assessments/${id}/attempts`));
    if (respuesta) setIntentoId(respuesta.data.attemptId);
  }

  async function enviar() {
    const answers = Object.entries(respuestas).map(([questionId, selectedOptionId]) => ({ questionId: Number(questionId), selectedOptionId }));
    const respuesta = await ejecutar(() => api.post(`/attempts/${intentoId}/submit`, { answers }));
    if (respuesta) navegar(`/estudiante/resultados/${intentoId}`);
  }

  return (
    <>
      <Link to={`/estudiante/cursos/${datos.courseId}`} className="volver">← Volver al curso</Link>
      <h1>{datos.title}</h1>
      <p className="tenue">{datos.questions.length} pregunta(s) · nota mínima {datos.passingScore} % · te quedan {restantes} intento(s)</p>
      <MensajeError error={error} />

      {!intentoId && (
        <section className="tarjeta">
          {datos.status !== 'published' && <Aviso>Esta evaluación ya no recibe intentos.</Aviso>}
          {datos.status === 'published' && restantes <= 0 && <Aviso>Ya usaste todos tus intentos.</Aviso>}
          {datos.status === 'published' && restantes > 0 && (
            <>
              <p>Al comenzar se registra un intento. Podrás revisar tus respuestas antes de enviarlas.</p>
              <button type="button" className="boton" disabled={enviando} onClick={comenzar}>
                {datos.inProgressAttemptId ? 'Continuar intento' : 'Comenzar intento'}
              </button>
            </>
          )}
        </section>
      )}

      {intentoId && (
        <form onSubmit={(evento) => { evento.preventDefault(); setConfirmando(true); }}>
          {datos.questions.map((pregunta, indice) => (
            <fieldset className="tarjeta pregunta" key={pregunta.id}>
              <legend>{indice + 1}. {pregunta.stem} <span className="tenue">({pregunta.points} pt)</span></legend>
              {pregunta.options.map((opcion) => (
                <label className="opcion" key={opcion.id}>
                  <input type="radio" name={`pregunta-${pregunta.id}`} checked={respuestas[pregunta.id] === opcion.id}
                    onChange={() => setRespuestas({ ...respuestas, [pregunta.id]: opcion.id })} />
                  <span>{opcion.body}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {confirmando ? (
            <section className="tarjeta destacada" role="alertdialog" aria-label="Confirmar envío">
              <p>
                {sinResponder > 0 ? `Tienes ${sinResponder} pregunta(s) sin responder; contarán como incorrectas. ` : ''}
                ¿Enviar el intento? No podrás cambiar las respuestas después.
              </p>
              <div className="acciones">
                <button type="button" className="boton" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Sí, enviar'}</button>
                <button type="button" className="boton secundario" onClick={() => setConfirmando(false)}>Seguir revisando</button>
              </div>
            </section>
          ) : (
            <button type="submit" className="boton">Enviar respuestas</button>
          )}
        </form>
      )}
    </>
  );
}
