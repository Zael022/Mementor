import { memo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso, Cargando, MensajeError } from '../Componentes/Estados.jsx';
import MensajeTutor from '../Componentes/MensajeTutor.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useChatTutor } from '../hooks/useChatTutor.js';
import { useDatos } from '../hooks/useDatos.js';

// El historial conserva sus referencias mientras llega texto al borrador.
const HistorialTutor = memo(function HistorialTutor({ mensajes, esEstudiante }) {
  return mensajes.map((mensaje) => <MensajeTutor key={mensaje.id} mensaje={mensaje} esEstudiante={esEstudiante} />);
});

// Página del tutor; la clave por curso reinicia el chat y descarta respuestas del curso anterior.
export default function TutorCurso() {
  const { courseId } = useParams();
  return <ChatTutor key={courseId} courseId={courseId} />;
}

// Chat con el tutor IA, limitado al material autorizado del curso.
function ChatTutor({ courseId }) {
  const { usuario } = useSesion();
  const esEstudiante = usuario.role === 'student';
  const curso = useDatos(`/courses/${courseId}`);
  const estado = useDatos('/tutor/status');
  const hilos = useDatos(`/courses/${courseId}/tutor/threads`);
  const chat = useChatTutor(courseId, hilos.datos, hilos.recargar);
  const [pregunta, setPregunta] = useState('');

  async function enviar(texto, intent) {
    if (await chat.preguntar(texto, intent)) setPregunta('');
  }

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;
  const volver = esEstudiante ? `/estudiante/cursos/${courseId}` : `/docente/cursos/${courseId}/contenidos`;
  const configurado = estado.datos?.configured;
  const hayRespuesta = chat.mensajes.some((mensaje) => mensaje.role === 'assistant' && mensaje.kind !== 'notice' && mensaje.estado !== 'interrumpido');

  return (
    <>
      <Link to={volver} className="volver">← Volver al curso</Link>
      <h1>Tutor IA · {curso.datos.title}</h1>
      <p className="tenue">
        El tutor responde solo con el material publicado de este curso y cita sus fuentes. Puede equivocarse: verifica con el material y con tu docente.
      </p>

      {estado.datos && !configurado && (
        <Aviso tipo="error">
          El tutor de IA no está configurado en el servidor (AI_NOT_CONFIGURED). {estado.datos.reason} El resto de la plataforma funciona con normalidad.
        </Aviso>
      )}

      {hilos.datos?.length > 0 && (
        <div className="campo selector-hilo">
          <label htmlFor="hilo-tutor">Conversación</label>
          <select id="hilo-tutor" value={chat.seleccion ?? ''} onChange={(evento) => chat.elegirHilo(evento.target.value ? Number(evento.target.value) : null)}>
            <option value="">Nueva conversación</option>
            {hilos.datos.map((hilo) => <option key={hilo.id} value={hilo.id}>{hilo.title}</option>)}
          </select>
        </div>
      )}

      {/* Solo este aviso se anuncia: el texto que llega en vivo no se lee trozo por trozo. */}
      <p className="solo-lector" role="status" aria-live="polite">{chat.anuncio}</p>
      <section className="tarjeta chat" aria-label="Conversación con el tutor">
        {chat.cargandoHistorial && <Cargando texto="Cargando conversación…" />}
        {!chat.cargandoHistorial && chat.mensajes.length === 0 && <p className="tenue">Aún no hay mensajes en esta conversación.</p>}
        <HistorialTutor mensajes={chat.mensajes} esEstudiante={esEstudiante} />
        {chat.borrador && <MensajeTutor mensaje={chat.borrador} esEstudiante={esEstudiante} />}
        {chat.enviando && !chat.borrador?.content && <Cargando texto="Buscando en el material del curso…" />}
      </section>

      <MensajeError error={chat.error} />
      <form className="chat-formulario" onSubmit={(evento) => { evento.preventDefault(); enviar(pregunta); }}>
        <label htmlFor="pregunta-tutor" className="etiqueta">Tu pregunta</label>
        <textarea id="pregunta-tutor" rows={3} value={pregunta} onChange={(evento) => setPregunta(evento.target.value)}
          onKeyDown={(evento) => {
            // Ctrl/Cmd + Enter envía sin salir del teclado.
            if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey) && !chat.enviando) { evento.preventDefault(); enviar(pregunta); }
          }}
          aria-describedby="ayuda-pregunta"
          maxLength={2000} placeholder="Escribe tu duda sobre el curso" disabled={!configurado || chat.cargandoHistorial} required />
        <small id="ayuda-pregunta" className="tenue">Ctrl + Enter para enviar.</small>
        <div className="acciones">
          {chat.enviando
            ? <button key="detener" type="button" className="boton" onClick={chat.detener}>Detener</button>
            : <button key="enviar" type="submit" className="boton" disabled={!configurado || chat.cargandoHistorial}>Enviar</button>}
          <button type="button" className="boton secundario" disabled={chat.enviando || !configurado || !hayRespuesta}
            onClick={() => enviar('Explícalo de una forma diferente y más sencilla.', 'rephrase')}>Explica diferente</button>
          <button type="button" className="boton secundario" disabled={chat.enviando || !configurado || !hayRespuesta}
            onClick={() => enviar('Dame solo una pista, sin la respuesta completa.', 'hint')}>Dame una pista</button>
          <button type="button" className="boton secundario" onClick={chat.nuevaConversacion} disabled={chat.seleccion === null && chat.mensajes.length === 0}>Nueva conversación</button>
        </div>
      </form>
    </>
  );
}
