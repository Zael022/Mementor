import { useState } from 'react';
import { Cargando, MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { fechaHora } from '../utils/fechas.js';

// Un comentario con su autor y la opción de borrarlo.
function Comentario({ comentario, alBorrar, children }) {
  return (
    <div className={`comentario ${comentario.parentId ? 'respuesta' : ''}`}>
      <p className="comentario-autor">
        <strong>{comentario.author.displayName}</strong>
        {comentario.author.isStaff && <span className="insignia published">Docente</span>}
        <span className="tenue pequeno">{fechaHora(comentario.createdAt)}</span>
      </p>
      <p>{comentario.body}</p>
      <div className="acciones">
        {children}
        {comentario.canDelete && <button type="button" className="enlace-boton" onClick={() => alBorrar(comentario.id)}>Borrar</button>}
      </div>
    </div>
  );
}

// Hilo de preguntas y respuestas de una lección.
export default function Comentarios({ leccionId }) {
  const comentarios = useDatos(`/lessons/${leccionId}/comments`);
  const [texto, setTexto] = useState('');
  const [respondiendo, setRespondiendo] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const { enviando, error, ejecutar } = useEnvio();

  async function publicar(evento) {
    evento.preventDefault();
    if (await ejecutar(() => api.post(`/lessons/${leccionId}/comments`, { body: texto }))) {
      setTexto('');
      comentarios.recargar();
    }
  }

  async function responder(evento) {
    evento.preventDefault();
    if (await ejecutar(() => api.post(`/lessons/${leccionId}/comments`, { body: respuesta, parentId: respondiendo }))) {
      setRespuesta('');
      setRespondiendo(null);
      comentarios.recargar();
    }
  }

  async function borrar(id) {
    if (await ejecutar(() => api.delete(`/comments/${id}`))) comentarios.recargar();
  }

  const lista = comentarios.datos || [];
  const preguntas = lista.filter((comentario) => !comentario.parentId);

  return (
    <section className="tarjeta">
      <h2>Preguntas y respuestas</h2>
      <form onSubmit={publicar}>
        <label htmlFor="nueva-pregunta" className="etiqueta">Escribe tu pregunta o comentario</label>
        <textarea id="nueva-pregunta" rows={2} value={texto} onChange={(evento) => setTexto(evento.target.value)} maxLength={4000} required />
        <div className="acciones"><button type="submit" className="boton" disabled={enviando}>Publicar</button></div>
      </form>
      <MensajeError error={error || comentarios.error} />
      {comentarios.cargando && !comentarios.datos && <Cargando />}
      {comentarios.datos && preguntas.length === 0 && <p className="tenue">Aún no hay preguntas en esta lección. Sé la primera persona en preguntar.</p>}

      {preguntas.map((pregunta) => (
        <div className="hilo" key={pregunta.id}>
          <Comentario comentario={pregunta} alBorrar={borrar}>
            <button type="button" className="enlace-boton" onClick={() => setRespondiendo(respondiendo === pregunta.id ? null : pregunta.id)}>Responder</button>
          </Comentario>
          {lista.filter((comentario) => comentario.parentId === pregunta.id).map((item) => (
            <Comentario key={item.id} comentario={item} alBorrar={borrar} />
          ))}
          {respondiendo === pregunta.id && (
            <form className="comentario respuesta" onSubmit={responder}>
              <label htmlFor={`respuesta-${pregunta.id}`} className="etiqueta">Tu respuesta</label>
              <textarea id={`respuesta-${pregunta.id}`} rows={2} value={respuesta} onChange={(evento) => setRespuesta(evento.target.value)} maxLength={4000} required />
              <div className="acciones">
                <button type="submit" className="boton secundario" disabled={enviando}>Enviar respuesta</button>
              </div>
            </form>
          )}
        </div>
      ))}
    </section>
  );
}
