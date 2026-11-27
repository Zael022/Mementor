import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { anunciar } from '../Componentes/Anunciador.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useMascotasVisibles } from '../Componentes/Mascota.jsx';
import OrbiSticker from '../Componentes/OrbiSticker.jsx';
import OpcionesQuiz, { useRetroalimentacion } from '../Componentes/OpcionesQuiz.jsx';
import { Llama } from '../Componentes/TarjetaRacha.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const coma = (valor) => String(valor).replace('.', ',');

// Práctica del día: responder todas las preguntas mantiene la racha (acertar no es obligatorio).
export default function PracticaDiaria() {
  const { id: cursoId } = useParams();
  const practica = useDatos(`/courses/${cursoId}/daily-practice`);
  const [respuestas, setRespuestas] = useState({});
  const [racha, setRacha] = useState(null);
  const [bono, setBono] = useState(null);
  const [actual, setActual] = useState(0);
  const { enviando, error, ejecutar } = useEnvio();
  const mascotas = useMascotasVisibles();
  const sticker = useRef(null);

  // Retoma donde se quedó: la primera pregunta sin responder.
  useEffect(() => {
    if (!practica.datos?.available) return;
    const guardadas = Object.fromEntries(practica.datos.questions.filter((q) => q.answer).map((q) => [q.id, q.answer]));
    setRespuestas(guardadas);
    setRacha(practica.datos.streak);
    const pendiente = practica.datos.questions.findIndex((q) => !q.answer);
    setActual(pendiente === -1 ? practica.datos.questions.length : pendiente);
  }, [practica.datos]);

  const listaPreguntas = practica.datos?.questions || [];
  const enCurso = listaPreguntas[Math.min(actual, listaPreguntas.length - 1)];
  const botonSeguir = useRetroalimentacion(enCurso ? respuestas[enCurso.id] : null, enCurso?.options);
  const practicaTerminada = listaPreguntas.length > 0 && actual >= listaPreguntas.length;
  const diasRacha = racha?.current ?? 0;

  // Anuncia el cierre de la práctica con la racha alcanzada.
  useEffect(() => {
    if (practicaTerminada) anunciar(`Práctica completada. Racha de ${diasRacha} ${diasRacha === 1 ? 'día' : 'días'}.`);
  }, [practicaTerminada, diasRacha]);

  if (practica.cargando && !practica.datos) return <Cargando />;
  if (practica.error) return <MensajeError error={practica.error} />;
  const volver = `/estudiante/cursos/${cursoId}?seccion=quizzes`;

  if (!practica.datos.available) {
    return (
      <>
        <Link to={volver} className="volver">← Volver a la clase</Link>
        <EstadoVacio ilustracion="tarea" titulo="Todavía no hay práctica diaria"
          detalle="La práctica usa las preguntas de los quizzes publicados de esta clase. Aparecerá cuando tu docente publique el primero." />
      </>
    );
  }

  const preguntas = practica.datos.questions;
  const terminada = actual >= preguntas.length;
  const pregunta = preguntas[Math.min(actual, preguntas.length - 1)];
  const respuesta = respuestas[pregunta.id];

  async function responder(opcionId) {
    const datos = await ejecutar(() => api.post(`/courses/${cursoId}/daily-practice/answers`, { questionId: pregunta.id, optionId: opcionId }));
    if (!datos) return;
    setRespuestas((previas) => ({ ...previas, [pregunta.id]: { optionId: opcionId, isCorrect: datos.data.isCorrect, correctOptionId: datos.data.correctOptionId } }));
    setRacha(datos.data.streak);
    if (datos.data.bonus.awarded) setBono(datos.data.bonus.amount);
    // Solo una reacción visual: un error arruga el papel (y se alisa con una sonrisa); un acierto, un saltito.
    if (datos.data.isCorrect) sticker.current?.saltar();
    else sticker.current?.arrugar();
  }

  return (
    <section className="practica-diaria">
      <Link to={volver} className="volver">← Volver a la clase</Link>
      <div className="practica-cabecera">
        <h1>Práctica del día</h1>
        {mascotas && <OrbiSticker ref={sticker} ancho={84} className="practica-orbi" onTerminar={(nombre) => nombre === 'arrugar' && sticker.current?.alisar()} />}
        <div className="racha-mini" aria-label={`Racha: ${racha?.current ?? 0} días`}>
          <Llama encendida={(racha?.current ?? 0) > 0} tamano={28} /><strong key={racha?.current ?? 0} className="cuenta-sube">{racha?.current ?? 0}</strong>
        </div>
      </div>
      <ol className="puntos-progreso" aria-label={`Respondidas ${Object.keys(respuestas).length} de ${preguntas.length}`}>
        {preguntas.map((q, indice) => (
          <li key={q.id} className={`${respuestas[q.id] ? (respuestas[q.id].isCorrect ? 'bien' : 'mal') : ''} ${indice === actual ? 'actual' : ''}`} />
        ))}
      </ol>

      {terminada ? (
        <div className="practica-lista">
          <Llama encendida tamano={96} />
          <h2>¡Racha de {racha?.current ?? 0} {racha?.current === 1 ? 'día' : 'días'}!</h2>
          {bono !== null && <p className="aviso exito bono-ganado">+{coma(bono)} a tu nota del curso</p>}
          <p>Acertaste {Object.values(respuestas).filter((r) => r.isCorrect).length} de {preguntas.length}. Vuelve mañana para mantener tu racha.</p>
          <Link className="boton" to={volver}>Volver a la clase</Link>
        </div>
      ) : (
        <>
          <p className="tenue">Pregunta {actual + 1} de {preguntas.length}</p>
          <h2 className="quiz-enunciado" key={pregunta.id}>{pregunta.prompt}</h2>
          <OpcionesQuiz opciones={pregunta.options} alElegir={responder} elegida={respuesta?.optionId ?? null}
            correcta={respuesta?.correctOptionId ?? null} bloqueada={enviando} />
          {respuesta && (
            <div className={`quiz-retro ${respuesta.isCorrect ? 'bien' : 'mal'}`}>
              <strong>{respuesta.isCorrect ? '¡Correcto!' : 'No era esa; la correcta quedó marcada.'}</strong>
              <button type="button" className="boton" ref={botonSeguir} onClick={() => setActual((indice) => indice + 1)}>
                {actual + 1 === preguntas.length ? 'Terminar' : 'Siguiente'}
              </button>
            </div>
          )}
        </>
      )}
      <MensajeError error={error} />
    </section>
  );
}
