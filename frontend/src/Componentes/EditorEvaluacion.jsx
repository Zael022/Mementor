import { useState } from 'react';
import Campo from './Campo.jsx';
import { Cargando, MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const PREGUNTA_VACIA = { stem: '', explanation: '', points: 1, options: ['', '', '', ''], correcta: 0 };

// Permite agregar preguntas de opción múltiple y publicar la evaluación.
export default function EditorEvaluacion({ evaluacionId, alCambiar }) {
  const evaluacion = useDatos(`/assessments/${evaluacionId}`);
  const [pregunta, setPregunta] = useState(PREGUNTA_VACIA);
  const { enviando, error, ejecutar } = useEnvio();

  async function accion(llamada) {
    const respuesta = await ejecutar(llamada);
    if (respuesta) {
      evaluacion.recargar();
      alCambiar();
    }
    return respuesta;
  }

  function cambiarOpcion(indice, valor) {
    setPregunta((previa) => ({ ...previa, options: previa.options.map((texto, posicion) => (posicion === indice ? valor : texto)) }));
  }

  async function agregar(evento) {
    evento.preventDefault();
    const opciones = pregunta.options
      .map((texto, indice) => ({ body: texto.trim(), isCorrect: indice === pregunta.correcta }))
      .filter((opcion) => opcion.body);
    const respuesta = await accion(() => api.post(`/assessments/${evaluacionId}/questions`, {
      stem: pregunta.stem,
      explanation: pregunta.explanation || undefined,
      points: Number(pregunta.points),
      options: opciones,
    }));
    if (respuesta) setPregunta(PREGUNTA_VACIA);
  }

  if (evaluacion.cargando && !evaluacion.datos) return <Cargando />;
  if (evaluacion.error) return <MensajeError error={evaluacion.error} />;
  const datos = evaluacion.datos;
  const borrador = datos.status === 'draft';

  return (
    <div className="subpanel">
      {datos.questions.length === 0 && <p className="tenue">Esta evaluación aún no tiene preguntas.</p>}
      <ol className="preguntas">
        {datos.questions.map((item) => (
          <li key={item.id}>
            <p><strong>{item.stem}</strong> <span className="tenue">({item.points} pt)</span></p>
            <ul>
              {item.options.map((opcion) => (
                <li key={opcion.id} className={opcion.isCorrect ? 'correcta' : ''}>{opcion.body}{opcion.isCorrect ? ' — correcta' : ''}</li>
              ))}
            </ul>
            {item.explanation && <p className="tenue">Explicación: {item.explanation}</p>}
            {borrador && <button type="button" className="boton peligro" onClick={() => accion(() => api.delete(`/questions/${item.id}`))}>Eliminar pregunta</button>}
          </li>
        ))}
      </ol>

      {borrador ? (
        <form className="editor" onSubmit={agregar}>
          <h4>Agregar pregunta</h4>
          <Campo etiqueta="Enunciado" tipo="textarea" filas={2} valor={pregunta.stem} alCambiar={(valor) => setPregunta({ ...pregunta, stem: valor })} required minLength={3} />
          <fieldset>
            <legend>Opciones (marca la correcta; deja vacías las que no uses)</legend>
            {pregunta.options.map((texto, indice) => (
              <div className="opcion-editor" key={indice}>
                <input type="radio" name={`correcta-${evaluacionId}`} checked={pregunta.correcta === indice}
                  onChange={() => setPregunta({ ...pregunta, correcta: indice })} aria-label={`Marcar la opción ${indice + 1} como correcta`} />
                <input type="text" value={texto} onChange={(evento) => cambiarOpcion(indice, evento.target.value)}
                  placeholder={`Opción ${indice + 1}`} aria-label={`Texto de la opción ${indice + 1}`} maxLength={500} />
              </div>
            ))}
          </fieldset>
          <div className="fila-formulario">
            <Campo etiqueta="Explicación (opcional)" valor={pregunta.explanation} alCambiar={(valor) => setPregunta({ ...pregunta, explanation: valor })} />
            <Campo etiqueta="Puntos" tipo="number" min={1} max={100} valor={pregunta.points} alCambiar={(valor) => setPregunta({ ...pregunta, points: valor })} required />
          </div>
          <div className="acciones">
            <button type="submit" className="boton secundario" disabled={enviando}>Agregar pregunta</button>
            <button type="button" className="boton" disabled={enviando || datos.questions.length === 0}
              onClick={() => accion(() => api.post(`/assessments/${evaluacionId}/publish`))}>Publicar evaluación</button>
          </div>
          <p className="tenue pequeno">Al publicar, las preguntas quedan bloqueadas para no alterar intentos ya calificados.</p>
        </form>
      ) : (
        <div className="acciones">
          {datos.status === 'published' && (
            <button type="button" className="boton secundario" onClick={() => accion(() => api.post(`/assessments/${evaluacionId}/close`))}>Cerrar evaluación</button>
          )}
          <p className="tenue pequeno">Una evaluación publicada o cerrada no admite cambios en sus preguntas.</p>
        </div>
      )}
      <MensajeError error={error} />
    </div>
  );
}
