import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import OpcionesQuiz from '../Componentes/OpcionesQuiz.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const coma = (valor) => String(valor).replace('.', ',');

// Cuenta regresiva visual; avisa una sola vez cuando el tiempo se acaba.
function useTemporizador(segundos, activo, alTerminar) {
  const [restante, setRestante] = useState(segundos);
  const terminado = useRef(false);
  const avisar = useRef(alTerminar);
  avisar.current = alTerminar;

  useEffect(() => {
    terminado.current = false;
    setRestante(segundos);
    if (!activo) return undefined;
    const limite = Date.now() + segundos * 1000;
    const intervalo = setInterval(() => {
      const quedan = Math.max(0, (limite - Date.now()) / 1000);
      setRestante(quedan);
      if (quedan === 0 && !terminado.current) {
        terminado.current = true;
        clearInterval(intervalo);
        avisar.current();
      }
    }, 100);
    return () => clearInterval(intervalo);
  }, [segundos, activo]);

  return restante;
}

// Confeti hecho con CSS para celebrar un quiz perfecto.
function Confeti() {
  return (
    <div className="confeti" aria-hidden="true">
      {Array.from({ length: 24 }, (_, indice) => <i key={indice} style={{ '--i': indice }} />)}
    </div>
  );
}

// Quiz rápido: preguntas con tiempo, puntos por rapidez y tabla de posiciones al final.
export default function JugarQuiz() {
  const { id: cursoId, quizId } = useParams();
  const quizzes = useDatos(`/courses/${cursoId}/quick-quizzes`);
  const nota = useDatos(`/courses/${cursoId}/my-grade`);
  const [fase, setFase] = useState('inicio');
  const [partida, setPartida] = useState(null);
  const [pregunta, setPregunta] = useState(null);
  const [respuesta, setRespuesta] = useState(null);
  const [elegida, setElegida] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [resultado, setResultado] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();
  const respondiendo = useRef(false);

  const quiz = quizzes.datos?.find((item) => String(item.id) === quizId);

  const terminar = useCallback(async (playId) => {
    const final = await ejecutar(() => api.get(`/quiz-plays/${playId}`));
    if (final) {
      setResultado(final.data);
      setFase('final');
    }
  }, [ejecutar]);

  const siguiente = useCallback(async (playId) => {
    const datos = await ejecutar(() => api.post(`/quiz-plays/${playId}/next`));
    if (!datos) return;
    if (datos.data.finished) {
      setResumen(datos.data);
      await terminar(playId);
      return;
    }
    respondiendo.current = false;
    setRespuesta(null);
    setElegida(null);
    setPregunta(datos.data);
    setFase('pregunta');
  }, [ejecutar, terminar]);

  async function comenzar() {
    const datos = await ejecutar(() => api.post(`/quick-quizzes/${quizId}/plays`));
    if (!datos) return;
    setPartida(datos.data);
    setResumen(null);
    setResultado(null);
    await siguiente(datos.data.playId);
  }

  const responder = useCallback(async (opcionId) => {
    if (respondiendo.current || !pregunta) return;
    respondiendo.current = true;
    setElegida(opcionId);
    const datos = await ejecutar(() => api.post(`/quiz-plays/${partida.playId}/answers`, { questionId: pregunta.question.id, optionId: opcionId }));
    if (!datos) {
      respondiendo.current = false;
      return;
    }
    setRespuesta(datos.data);
    if (datos.data.summary) setResumen(datos.data.summary);
    setFase('respuesta');
  }, [ejecutar, partida, pregunta]);

  const restante = useTemporizador(pregunta?.secondsLeft ?? 0, fase === 'pregunta', () => responder(null));

  if (quizzes.cargando && !quizzes.datos) return <Cargando />;
  if (quizzes.error) return <MensajeError error={quizzes.error} />;
  if (!quiz) return <MensajeError error={new Error('Este quiz no está disponible.')} />;

  const volver = `/estudiante/cursos/${cursoId}?seccion=quizzes`;

  if (fase === 'inicio') {
    return (
      <section className="quiz-portada">
        <Link to={volver} className="volver">← Volver a la clase</Link>
        <p className="pildora clara">Quiz rápido</p>
        <h1>{quiz.title}</h1>
        <ul className="meta">
          <li>{quiz.questionCount} pregunta(s)</li>
          <li>{quiz.secondsPerQuestion} s por pregunta</li>
          {quiz.bestScore !== null && <li>Tu mejor puntaje: {quiz.bestScore}</li>}
        </ul>
        <p>Responde rápido: cada acierto vale hasta 1000 puntos según el tiempo.
          {nota.datos && ` Si aciertas todas, ganas ${coma(nota.datos.policy.quizBonus)} en tu nota (una vez por quiz).`}</p>
        {quiz.perfect && <p className="aviso exito">Ya ganaste el bono de este quiz. Puedes seguir jugando para mejorar tu puntaje.</p>}
        <button type="button" className="boton boton-grande" disabled={enviando} onClick={comenzar}>Comenzar</button>
        <MensajeError error={error} />
      </section>
    );
  }

  if (fase === 'final' && resultado) {
    const bono = resumen?.bonus;
    return (
      <section className="quiz-final">
        {resultado.perfect && <Confeti />}
        <h1>{resultado.perfect ? '¡Perfecto!' : '¡Quiz terminado!'}</h1>
        <p className="puntaje-final">{resultado.score} <span>puntos</span></p>
        <p>Acertaste {resultado.correctCount} de {resultado.totalQuestions}.</p>
        {bono?.awarded && <p className="aviso exito bono-ganado" role="status">+{coma(bono.amount)} a tu nota del curso</p>}
        {resultado.perfect && bono && !bono.awarded && <p className="aviso">Ya habías ganado el bono de este quiz.</p>}
        {!resultado.perfect && <p className="tenue">Acierta todas las preguntas para ganar el bono de tu nota.</p>}

        <h2>Tabla de posiciones</h2>
        <ol className="tabla-posiciones">
          {resultado.leaderboard.map((fila) => (
            <li key={fila.position} className={fila.isMe ? 'mia' : ''} style={{ '--i': fila.position }}>
              <span className="posicion">{fila.position}</span>
              <span>{fila.displayName}{fila.isMe && ' (tú)'}</span>
              <strong>{fila.score}</strong>
            </li>
          ))}
        </ol>
        <div className="acciones">
          <button type="button" className="boton" disabled={enviando} onClick={comenzar}>Jugar de nuevo</button>
          <Link className="boton secundario" to={volver}>Volver a la clase</Link>
        </div>
        <MensajeError error={error} />
      </section>
    );
  }

  if (!pregunta) return <Cargando />;
  const segundos = pregunta.secondsPerQuestion;
  const porcentaje = fase === 'pregunta' ? (restante / segundos) * 100 : 0;

  return (
    <section className="quiz-juego">
      <div className="quiz-barra">
        <span>Pregunta {pregunta.index} de {pregunta.total}</span>
        <span className="quiz-puntaje">Puntaje: {respuesta?.score ?? '…'}</span>
      </div>
      <div className={`tiempo ${restante <= 5 && fase === 'pregunta' ? 'urgente' : ''}`} role="timer" aria-label={`Quedan ${Math.ceil(restante)} segundos`}>
        <div style={{ width: `${porcentaje}%` }} />
        <span aria-hidden="true">{fase === 'pregunta' ? Math.ceil(restante) : ''}</span>
      </div>
      <h1 className="quiz-enunciado" key={pregunta.question.id}>{pregunta.question.prompt}</h1>
      <OpcionesQuiz opciones={pregunta.question.options} alElegir={responder} elegida={elegida}
        correcta={respuesta?.correctOptionId ?? null} bloqueada={enviando || fase !== 'pregunta'} />

      {respuesta && (
        <div className={`quiz-retro ${respuesta.isCorrect ? 'bien' : 'mal'}`} role="status">
          <strong>{respuesta.isCorrect ? '¡Correcto!' : respuesta.timedOut ? 'Se acabó el tiempo' : 'Incorrecto'}</strong>
          {respuesta.isCorrect && <span className="puntos-ganados">+{respuesta.points}</span>}
          <button type="button" className="boton" disabled={enviando}
            onClick={() => (respuesta.isLast ? terminar(partida.playId) : siguiente(partida.playId))}>
            {respuesta.isLast ? 'Ver resultados' : 'Siguiente'}
          </button>
        </div>
      )}
      <MensajeError error={error} />
    </section>
  );
}
