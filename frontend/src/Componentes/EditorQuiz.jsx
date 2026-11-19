import { useState } from 'react';
import Campo from './Campo.jsx';
import { Cargando, MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const VACIA = { prompt: '', options: ['', '', '', ''], correcta: 0 };

// Preguntas del quiz: hasta 4 opciones con una correcta; solo se edita en borrador.
export default function EditorQuiz({ quizId, alCambiar }) {
  const quiz = useDatos(`/quick-quizzes/${quizId}`);
  const [pregunta, setPregunta] = useState(VACIA);
  const { enviando, error, ejecutar } = useEnvio();

  async function accion(llamada) {
    const respuesta = await ejecutar(llamada);
    if (respuesta) {
      quiz.recargar();
      alCambiar();
    }
    return respuesta;
  }

  async function agregar(evento) {
    evento.preventDefault();
    const opciones = pregunta.options
      .map((texto, indice) => ({ body: texto.trim(), isCorrect: indice === pregunta.correcta }))
      .filter((opcion) => opcion.body);
    const respuesta = await accion(() => api.post(`/quick-quizzes/${quizId}/questions`, { prompt: pregunta.prompt, options: opciones }));
    if (respuesta) setPregunta(VACIA);
  }

  if (quiz.cargando && !quiz.datos) return <Cargando />;
  if (quiz.error) return <MensajeError error={quiz.error} />;
  const datos = quiz.datos;
  const borrador = datos.status === 'draft';

  return (
    <div className="subpanel">
      {datos.questions.length === 0 && <p className="tenue">Este quiz aún no tiene preguntas.</p>}
      <ol className="preguntas">
        {datos.questions.map((item) => (
          <li key={item.id}>
            <p><strong>{item.prompt}</strong></p>
            <ul>
              {item.options.map((opcion) => (
                <li key={opcion.id} className={opcion.isCorrect ? 'correcta' : ''}>{opcion.body}{opcion.isCorrect ? ' — correcta' : ''}</li>
              ))}
            </ul>
            {borrador && <button type="button" className="boton peligro" onClick={() => accion(() => api.delete(`/quick-questions/${item.id}`))}>Eliminar pregunta</button>}
          </li>
        ))}
      </ol>

      {borrador && (
        <form className="editor" onSubmit={agregar}>
          <h4>Agregar pregunta</h4>
          <Campo etiqueta="Pregunta" valor={pregunta.prompt} alCambiar={(valor) => setPregunta({ ...pregunta, prompt: valor })} required minLength={3} maxLength={500} />
          <fieldset>
            <legend>Opciones (marca la correcta; deja vacías las que no uses)</legend>
            {pregunta.options.map((texto, indice) => (
              <div className="opcion-editor" key={indice}>
                <input type="radio" name={`correcta-quiz-${quizId}`} checked={pregunta.correcta === indice}
                  onChange={() => setPregunta({ ...pregunta, correcta: indice })} aria-label={`Marcar la opción ${indice + 1} como correcta`} />
                <input type="text" value={texto} maxLength={200} placeholder={`Opción ${indice + 1}`} aria-label={`Texto de la opción ${indice + 1}`}
                  onChange={(evento) => setPregunta({ ...pregunta, options: pregunta.options.map((actual, posicion) => (posicion === indice ? evento.target.value : actual)) })} />
              </div>
            ))}
          </fieldset>
          <button type="submit" className="boton secundario" disabled={enviando}>Agregar pregunta</button>
        </form>
      )}

      <div className="acciones">
        {borrador && <button type="button" className="boton" disabled={enviando || datos.questions.length === 0} onClick={() => accion(() => api.post(`/quick-quizzes/${quizId}/publish`))}>Publicar quiz</button>}
        {borrador && <button type="button" className="boton peligro" disabled={enviando} onClick={() => accion(() => api.delete(`/quick-quizzes/${quizId}`))}>Eliminar quiz</button>}
        {datos.status === 'published' && <button type="button" className="boton secundario" disabled={enviando} onClick={() => accion(() => api.post(`/quick-quizzes/${quizId}/archive`))}>Archivar</button>}
      </div>
      {datos.status === 'published' && <p className="tenue pequeno">Publicado: ya no se puede editar. Sus preguntas forman parte de la práctica diaria de la clase.</p>}
      <MensajeError error={error} />
    </div>
  );
}
