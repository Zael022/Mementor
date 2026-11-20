import { useState } from 'react';
import { Link } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { Aviso, Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { fechaHora } from '../utils/fechas.js';

// Valores iniciales de cada formulario.
const INICIAL = {
  question_generator: { courseId: '', topic: '', count: 5 },
  feedback_assistant: { submissionId: '' },
  course_analyst: { courseId: '' },
  compliance_checker: { text: '' },
  announcement_writer: { courseId: '', brief: '', tone: 'cercano', format: 'anuncio' },
  study_coach: { courseId: '', minutes: 30 },
  lesson_summarizer: { courseId: '', lessonId: '' },
};

// Selector de curso reutilizado por varios formularios.
function SelectorCurso({ cursos, valor, alCambiar }) {
  return (
    <Campo etiqueta="Curso" tipo="select" valor={valor} alCambiar={alCambiar} required
      opciones={[{ valor: '', texto: 'Elige un curso' }, ...(cursos || []).map((curso) => ({ valor: curso.id, texto: curso.title }))]} />
  );
}

// Lecciones del curso elegido (solo para el resumen).
function SelectorLeccion({ cursoId, valor, alCambiar }) {
  const curso = useDatos(cursoId ? `/courses/${cursoId}` : null);
  const lecciones = curso.datos?.modules.flatMap((modulo) => modulo.topics.flatMap((tema) => tema.lessons)) || [];
  return (
    <Campo etiqueta="Lección" tipo="select" valor={valor} alCambiar={alCambiar} required
      opciones={[{ valor: '', texto: cursoId ? 'Elige una lección' : 'Primero elige un curso' }, ...lecciones.map((leccion) => ({ valor: leccion.id, texto: leccion.title }))]} />
  );
}

// Formulario según el agente.
function Formulario({ agente, valores, setValores, cursos }) {
  const cambiar = (campo) => (valor) => setValores({ ...valores, [campo]: valor });
  const entregas = useDatos(agente === 'feedback_assistant' ? '/me/todo' : null);
  switch (agente) {
    case 'question_generator':
      return (
        <>
          <SelectorCurso cursos={cursos} valor={valores.courseId} alCambiar={cambiar('courseId')} />
          <Campo etiqueta="Tema o enfoque" valor={valores.topic} alCambiar={cambiar('topic')} required minLength={3} maxLength={200} ayuda="Ejemplo: fracciones equivalentes" />
          <Campo etiqueta="Cantidad de preguntas" tipo="number" min={1} max={8} valor={valores.count} alCambiar={cambiar('count')} />
        </>
      );
    case 'feedback_assistant':
      return (
        <Campo etiqueta="Entrega por revisar" tipo="select" valor={valores.submissionId} alCambiar={cambiar('submissionId')} required
          opciones={[{ valor: '', texto: entregas.datos?.toReview?.length ? 'Elige una entrega' : 'No hay entregas por revisar' },
            ...(entregas.datos?.toReview || []).map((item) => ({ valor: item.submissionId, texto: `${item.assignmentTitle} · ${item.courseTitle}` }))]} />
      );
    case 'course_analyst':
      return <SelectorCurso cursos={cursos} valor={valores.courseId} alCambiar={cambiar('courseId')} />;
    case 'compliance_checker':
      return <Campo etiqueta="Texto a revisar" tipo="textarea" valor={valores.text} alCambiar={cambiar('text')} required minLength={20} maxLength={12000}
        ayuda="Pega un material, anuncio o comunicado antes de publicarlo." />;
    case 'announcement_writer':
      return (
        <>
          <SelectorCurso cursos={cursos} valor={valores.courseId} alCambiar={cambiar('courseId')} />
          <Campo etiqueta="¿Qué quieres comunicar?" tipo="textarea" valor={valores.brief} alCambiar={cambiar('brief')} required minLength={10} maxLength={1000} />
          <div className="fila-formulario">
            <Campo etiqueta="Tono" tipo="select" valor={valores.tone} alCambiar={cambiar('tone')}
              opciones={[{ valor: 'cercano', texto: 'Cercano' }, { valor: 'formal', texto: 'Formal' }, { valor: 'motivador', texto: 'Motivador' }]} />
            <Campo etiqueta="Formato" tipo="select" valor={valores.format} alCambiar={cambiar('format')}
              opciones={[{ valor: 'anuncio', texto: 'Anuncio del curso' }, { valor: 'redes', texto: 'Publicación para redes' }]} />
          </div>
        </>
      );
    case 'study_coach':
      return (
        <>
          <SelectorCurso cursos={cursos} valor={valores.courseId} alCambiar={cambiar('courseId')} />
          <Campo etiqueta="Minutos disponibles hoy" tipo="number" min={10} max={240} valor={valores.minutes} alCambiar={cambiar('minutes')} />
        </>
      );
    case 'lesson_summarizer':
      return (
        <>
          <SelectorCurso cursos={cursos} valor={valores.courseId} alCambiar={(valor) => setValores({ ...valores, courseId: valor, lessonId: '' })} />
          <SelectorLeccion cursoId={valores.courseId} valor={valores.lessonId} alCambiar={cambiar('lessonId')} />
        </>
      );
    default:
      return null;
  }
}

// Acción para llevar el borrador al sistema (el docente revisa antes de publicar).
function AccionBorrador({ agente, resultado, valores }) {
  const [hecho, setHecho] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();
  if (agente === 'announcement_writer') {
    const publicar = async () => {
      const cuerpo = resultado.hashtags?.length ? `${resultado.body}\n\n${resultado.hashtags.join(' ')}` : resultado.body;
      if (await ejecutar(() => api.post(`/courses/${valores.courseId}/announcements`, { title: resultado.title, body: cuerpo }))) setHecho('Anuncio publicado en el curso.');
    };
    return (
      <>
        <button type="button" className="boton" onClick={publicar} disabled={enviando || Boolean(hecho)}>Publicar como anuncio</button>
        {hecho && <Aviso tipo="exito">{hecho}</Aviso>}
        <MensajeError error={error} />
      </>
    );
  }
  if (agente === 'question_generator' && resultado.questions.length) {
    const crear = async () => {
      const respuesta = await ejecutar(async () => {
        const quiz = await api.post(`/courses/${valores.courseId}/quick-quizzes`, { title: `Borrador: ${valores.topic}`.slice(0, 180), secondsPerQuestion: 20 });
        for (const pregunta of resultado.questions) {
          await api.post(`/quick-quizzes/${quiz.data.id}/questions`, {
            prompt: pregunta.prompt, options: pregunta.options.map((texto, indice) => ({ body: texto, isCorrect: indice === pregunta.correctIndex })),
          });
        }
        return quiz;
      });
      if (respuesta) setHecho(respuesta.data.id);
    };
    return (
      <>
        <button type="button" className="boton" onClick={crear} disabled={enviando || Boolean(hecho)}>Crear un quiz en borrador con estas preguntas</button>
        {hecho && <Aviso tipo="exito">Quiz creado en borrador. <Link to={`/docente/cursos/${valores.courseId}/quizzes`}>Revísalo antes de publicarlo</Link>.</Aviso>}
        <MensajeError error={error} />
      </>
    );
  }
  return null;
}

// Presentación del resultado de cada agente.
function Resultado({ agente, datos, valores }) {
  if (datos.status === 'no_evidence') return <Aviso tipo="error">{datos.message} (No se consultó al modelo.)</Aviso>;
  const r = datos.result;
  return (
    <div className="resultado-agente" role="status">
      {agente === 'question_generator' && (
        <ol className="preguntas">
          {r.questions.map((pregunta) => (
            <li key={pregunta.prompt}>
              <p><strong>{pregunta.prompt}</strong> <span className="tenue pequeno">[{pregunta.citations.join(', ')}]</span></p>
              <ul>{pregunta.options.map((opcion, indice) => <li key={opcion} className={indice === pregunta.correctIndex ? 'correcta' : ''}>{opcion}{indice === pregunta.correctIndex ? ' — correcta' : ''}</li>)}</ul>
              {pregunta.explanation && <p className="tenue pequeno">{pregunta.explanation}</p>}
            </li>
          ))}
        </ol>
      )}
      {agente === 'feedback_assistant' && (
        <>
          <p><strong>Nota sugerida:</strong> {r.suggestedPoints} de {r.maxPoints} (orientativa; la decides tú en la pestaña Tareas)</p>
          <h4>Fortalezas</h4><ul>{r.strengths.map((texto) => <li key={texto}>{texto}</li>)}</ul>
          <h4>Por mejorar</h4><ul>{r.improvements.map((texto) => <li key={texto}>{texto}</li>)}</ul>
          <h4>Retroalimentación para el estudiante</h4><p className="cita-bloque">{r.feedback}</p>
        </>
      )}
      {agente === 'course_analyst' && (
        <>
          <p>{r.summary}</p>
          {[['Lo destacado', r.highlights], ['Riesgos', r.risks], ['Recomendaciones', r.recommendations]].map(([titulo, lista]) => lista.length > 0 && (
            <div key={titulo}><h4>{titulo}</h4><ul>{lista.map((texto) => <li key={texto}>{texto}</li>)}</ul></div>
          ))}
        </>
      )}
      {agente === 'compliance_checker' && (
        <>
          <p><strong>Riesgo:</strong> <span className={`riesgo ${r.riskLevel}`}>{r.riskLevel}</span> · {r.summary}</p>
          {r.automaticFindings.length > 0 && <p className="tenue pequeno">Detección automática: {r.automaticFindings.map((item) => `${item.type} (${item.sample})`).join(', ')}</p>}
          <ul>{r.issues.map((item) => <li key={item.detail}><strong>{item.type}:</strong> {item.detail} <em>Cómo corregir:</em> {item.fix}</li>)}</ul>
        </>
      )}
      {agente === 'announcement_writer' && (
        <>
          <h4>{r.title}</h4>
          <p className="cita-bloque">{r.body}</p>
          {r.hashtags.length > 0 && <p className="tenue">{r.hashtags.join(' ')}</p>}
        </>
      )}
      {agente === 'study_coach' && (
        <>
          <ol>{r.plan.map((paso) => <li key={paso.activity}><strong>{paso.minutes} min:</strong> {paso.activity} <span className="tenue pequeno">— {paso.why}</span></li>)}</ol>
          <p className="cita-bloque">{r.motivation}</p>
        </>
      )}
      {agente === 'lesson_summarizer' && (
        <>
          <p>{r.summary}</p>
          <h4>Ideas clave</h4><ul>{r.keyPoints.map((texto) => <li key={texto}>{texto}</li>)}</ul>
          {r.selfCheck.length > 0 && <><h4>Autoevaluación</h4>{r.selfCheck.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</>}
        </>
      )}
      {datos.sources?.length > 0 && <p className="tenue pequeno">Fuentes: {datos.sources.map((fuente) => `${fuente.id} ${fuente.title}`).join(' · ')}</p>}
      <p className="tenue pequeno">Generado por IA: revísalo antes de usarlo. Ejecución n.º {datos.runId}.</p>
      <AccionBorrador agente={agente} resultado={r} valores={valores} />
    </div>
  );
}

// Asistentes de IA disponibles para el rol, con su formulario, resultado y bitácora.
export default function Asistentes() {
  const { usuario } = useSesion();
  const catalogo = useDatos('/agents');
  const cursos = useDatos(usuario.role === 'auditor' ? null : '/courses?limit=100');
  const historial = useDatos('/agents/runs');
  const [elegido, setElegido] = useState(null);
  const [valores, setValores] = useState({});
  const [resultado, setResultado] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();

  if (catalogo.cargando && !catalogo.datos) return <Cargando />;
  if (catalogo.error) return <MensajeError error={catalogo.error} />;

  function elegir(agente) {
    setElegido(agente);
    setValores(INICIAL[agente] || {});
    setResultado(null);
  }

  async function ejecutarAgente(evento) {
    evento.preventDefault();
    setResultado(null);
    const respuesta = await ejecutar(() => api.post(`/agents/${elegido}/run`, valores));
    if (respuesta) {
      setResultado(respuesta.data);
      historial.recargar();
    }
  }

  const agente = catalogo.datos.find((item) => item.key === elegido);
  const enlaceTutor = (item) => item.link?.[usuario.role]?.replace(':courseId', cursos.datos?.[0]?.id ?? '');

  return (
    <>
      <h1>Asistentes de IA</h1>
      <p className="tenue">Cada asistente usa solo la información que tu rol puede ver y deja registro de su uso. Las respuestas son borradores: revísalas antes de usarlas.</p>
      <div className="rejilla rejilla-agentes">
        {catalogo.datos.map((item) => (
          <article key={item.key} className={`tarjeta tarjeta-agente ${elegido === item.key ? 'elegida' : ''}`}>
            <h3>{item.name}</h3>
            <p>{item.purpose}</p>
            <p className="tenue pequeno">{item.privacy}</p>
            {item.link
              ? (enlaceTutor(item) && cursos.datos?.length ? <Link className="boton secundario" to={enlaceTutor(item)}>Abrir el tutor</Link> : <span className="tenue pequeno">Ábrelo desde un curso.</span>)
              : <button type="button" className="boton secundario" onClick={() => elegir(item.key)} aria-pressed={elegido === item.key}>Usar</button>}
          </article>
        ))}
      </div>

      {agente && (
        <section className="tarjeta" aria-labelledby="titulo-agente">
          <h2 id="titulo-agente">{agente.name}</h2>
          <form onSubmit={ejecutarAgente}>
            <Formulario agente={elegido} valores={valores} setValores={setValores} cursos={cursos.datos} />
            <button type="submit" className="boton" disabled={enviando}>{enviando ? 'Generando…' : 'Generar'}</button>
          </form>
          <MensajeError error={error} />
          {resultado && <Resultado agente={elegido} datos={resultado} valores={valores} />}
        </section>
      )}

      <h2>Mi historial de uso</h2>
      {historial.datos?.length === 0 && <p className="tenue">Todavía no has usado ningún asistente.</p>}
      {historial.datos?.length > 0 && (
        <div className="tabla-desplazable">
          <table className="tabla">
            <thead><tr><th scope="col">Fecha</th><th scope="col">Asistente</th><th scope="col">Resultado</th><th scope="col">Tokens</th><th scope="col">Tiempo</th></tr></thead>
            <tbody>
              {historial.datos.slice(0, 20).map((fila) => (
                <tr key={fila.id}>
                  <td>{fechaHora(fila.createdAt)}</td>
                  <td>{fila.name}</td>
                  <td><Insignia estado={fila.status} /></td>
                  <td>{fila.inputTokens ?? '—'} / {fila.outputTokens ?? '—'}</td>
                  <td>{fila.latencyMs ? `${(fila.latencyMs / 1000).toFixed(1)} s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
