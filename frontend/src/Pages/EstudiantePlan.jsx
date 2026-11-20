import { useState } from 'react';
import { Link } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Aviso, Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { zonaDelNavegador } from '../services/preferencias.js';

const NOTAS = [
  { grade: 1, texto: 'No lo recordé' },
  { grade: 2, texto: 'Me costó' },
  { grade: 3, texto: 'Bien' },
  { grade: 4, texto: 'Fácil' },
];
const TIPOS = { learn: 'Aprender', reinforce: 'Reforzar', practice: 'Practicar', review: 'Repasar' };
const DIAS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [7, 'Dom']];

// Fecha AAAA-MM-DD en una zona horaria concreta.
function hoyEn(zona) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function sumarDias(dia, cantidad) {
  const [anio, mes, fecha] = dia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, fecha + cantidad)).toISOString().slice(0, 10);
}
// El mediodía UTC evita que la fecha cambie al mostrarla en otra zona.
const nombreDia = (dia) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });

// Repasos del curso: los que tocan hoy se pueden registrar con una autoevaluación.
function Repasos({ cursoId }) {
  const repasos = useDatos(`/me/reviews?courseId=${cursoId}`);
  const envio = useEnvio();
  const [mensaje, setMensaje] = useState('');

  async function registrar(tema, grade) {
    const respuesta = await envio.ejecutar(() => api.post(`/topics/${tema.topicId}/reviews`, { grade }));
    if (respuesta) {
      setMensaje(`«${tema.topicTitle}» volverá en ${respuesta.data.scheduledDays} ${respuesta.data.scheduledDays === 1 ? 'día' : 'días'}.`);
      repasos.recargar();
    }
  }

  if (repasos.cargando && !repasos.datos) return <Cargando />;
  const lista = repasos.datos || [];
  const tocan = lista.filter((tema) => tema.status === 'due');
  const programados = lista.filter((tema) => tema.status === 'scheduled');
  const nuevos = lista.filter((tema) => tema.status === 'new');

  return (
    <section className="tarjeta" aria-labelledby="titulo-repaso">
      <h2 id="titulo-repaso">Repaso espaciado</h2>
      <p className="tenue">
        Cada tema vuelve justo antes de que sea probable olvidarlo. Tus evaluaciones lo programan solas;
        al repasar, intenta recordar sin mirar y luego elige qué tan bien te fue.
      </p>
      <MensajeError error={repasos.error || envio.error} />
      <p role="status" className="texto-exito">{mensaje}</p>

      <h3>Toca hoy ({tocan.length})</h3>
      {tocan.length === 0 && <p className="tenue">No tienes repasos pendientes hoy.</p>}
      <ul className="lista-repaso">
        {tocan.map((tema) => (
          <li key={tema.topicId} className="toca">
            <div>
              <h3>{tema.topicTitle}</h3>
              <p className="tenue pequeno">Probabilidad estimada de recordarlo: {tema.recallPct} %</p>
            </div>
            <Link to={`/estudiante/cursos/${cursoId}`} className="pequeno">Releer el curso</Link>
            <div className="botones-nota" role="group" aria-label={`¿Qué tan bien recordaste ${tema.topicTitle}?`}>
              {NOTAS.map((nota) => (
                <button key={nota.grade} type="button" className={nota.grade === 3 ? 'boton' : 'boton secundario'} disabled={envio.enviando}
                  onClick={() => registrar(tema, nota.grade)}>{nota.texto}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {programados.length > 0 && (
        <>
          <h3>Próximos repasos</h3>
          <ul className="lista-repaso">
            {programados.map((tema) => (
              <li key={tema.topicId}>
                <div>
                  <h3>{tema.topicTitle}</h3>
                  <p className="tenue pequeno">Toca el {fechaCorta(tema.dueAt)}</p>
                </div>
                <div className="memoria" title="Estimación del modelo, no una calificación">
                  <div className="memoria-barra" aria-hidden="true"><div style={{ width: `${tema.recallPct}%` }} /></div>
                  <span>{tema.recallPct} %</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {nuevos.length > 0 && (
        <p className="tenue pequeno">
          {nuevos.length} {nuevos.length === 1 ? 'tema aún no tiene' : 'temas aún no tienen'} repasos: se programan cuando respondes una evaluación.
        </p>
      )}
    </section>
  );
}

// Formulario para crear (o rehacer) el plan.
function FormularioPlan({ cursoId, alCrear, alCancelar }) {
  const { preferencias } = useSesion();
  const zona = preferencias.timeZone || zonaDelNavegador() || 'UTC';
  const hoy = hoyEn(zona);
  const [fecha, setFecha] = useState(sumarDias(hoy, 14));
  const [minutos, setMinutos] = useState(String(preferencias.dailyGoalMinutes || 30));
  const [dias, setDias] = useState([1, 2, 3, 4, 5]);
  const envio = useEnvio();

  const alternarDia = (dia) => setDias((actuales) => (actuales.includes(dia) ? actuales.filter((item) => item !== dia) : [...actuales, dia]));

  async function crear(evento) {
    evento.preventDefault();
    const respuesta = await envio.ejecutar(() => api.post(`/courses/${cursoId}/study-plan`, {
      targetDate: fecha, minutesPerSession: Number(minutos), studyDays: dias, timeZone: zona,
    }));
    if (respuesta) alCrear();
  }

  return (
    <form onSubmit={crear} className="formulario-plan">
      <Campo etiqueta="¿Hasta qué fecha?" tipo="date" valor={fecha} alCambiar={setFecha} min={hoy} max={sumarDias(hoy, 180)} required
        ayuda="Por ejemplo, el día de tu próxima evaluación." />
      <Campo etiqueta="Minutos por día de estudio" tipo="number" valor={minutos} alCambiar={setMinutos} min={15} max={240} step={5} required />
      <fieldset className="grupo-opciones ancho-completo">
        <legend>Días en que puedes estudiar</legend>
        <div className="dias-semana">
          {DIAS.map(([numero, corto]) => (
            <label key={numero}>
              <input type="checkbox" checked={dias.includes(numero)} onChange={() => alternarDia(numero)} />
              {corto}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="tenue pequeno ancho-completo">
        Zona horaria: <strong>{zona.replaceAll('_', ' ')}</strong>
        {!preferencias.timeZone && ' (la de este equipo; puedes fijarla en Configuración)'}.
      </p>
      <div className="acciones-compactas ancho-completo">
        <button type="submit" className="boton" disabled={envio.enviando || dias.length === 0}>Crear plan</button>
        {alCancelar && <button type="button" className="boton secundario" onClick={alCancelar}>Cancelar</button>}
      </div>
      <div className="ancho-completo"><MensajeError error={envio.error} /></div>
    </form>
  );
}

// Plan vigente agrupado por día, con sesiones que se marcan, omiten o mueven.
function PlanVigente({ plan, alCambiar, alRehacer }) {
  const envio = useEnvio();
  const porDia = new Map();
  for (const item of plan.items) porDia.set(item.scheduledDate, [...(porDia.get(item.scheduledDate) || []), item]);
  const avance = plan.totalMinutes ? Math.round((plan.doneMinutes / plan.totalMinutes) * 100) : 0;

  async function editar(item, cambios) {
    const respuesta = await envio.ejecutar(() => api.patch(`/study-plan-items/${item.id}`, cambios));
    if (respuesta) alCambiar(respuesta.data);
  }
  async function archivar() {
    if (!window.confirm('¿Archivar este plan? Podrás crear otro cuando quieras.')) return;
    if (await envio.ejecutar(() => api.delete(`/study-plans/${plan.id}`)) !== undefined) alCambiar(null);
  }

  return (
    <>
      <ul className="meta">
        <li>Hasta el {nombreDia(plan.targetDate)}</li>
        <li>{plan.minutesPerSession} min por día</li>
        <li>{plan.doneMinutes} de {plan.totalMinutes} min hechos ({avance} %)</li>
      </ul>
      <div className="medidor-barra" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del plan">
        <div style={{ width: `${avance}%` }} />
      </div>
      {plan.unscheduledMinutes > 0 && (
        <Aviso tipo="error">
          No caben {plan.unscheduledMinutes} minutos antes de la fecha objetivo. Elige una fecha posterior, más días o más minutos y rehaz el plan.
        </Aviso>
      )}
      <MensajeError error={envio.error} />
      {plan.items.length === 0 && <p className="tenue">No hay nada pendiente en este curso por ahora. ¡Buen trabajo!</p>}
      {[...porDia.entries()].map(([dia, items]) => (
        <div key={dia}>
          <h3 className={`plan-dia${dia === plan.today ? ' hoy' : ''}`}>{nombreDia(dia)}</h3>
          <ul className="plan-sesiones">
            {items.map((item) => (
              <li key={item.id} className={item.status}>
                <input type="checkbox" checked={item.status === 'done'} disabled={envio.enviando}
                  aria-label={`Marcar como hecha: ${item.description}`}
                  onChange={(evento) => editar(item, { status: evento.target.checked ? 'done' : 'pending' })} />
                <div className="sesion-texto">
                  <span className={`insignia ${item.kind}`}>{TIPOS[item.kind]}</span> {item.description}
                  {item.status === 'skipped' && <span className="tenue pequeno"> · omitida</span>}
                </div>
                <span className="tenue minutos">{item.minutes} min</span>
                {item.status !== 'done' && (
                  <div className="acciones-compactas">
                    <label className="pequeno">
                      Mover a{' '}
                      <input type="date" value={item.scheduledDate} min={plan.today} max={plan.targetDate} disabled={envio.enviando}
                        onChange={(evento) => evento.target.value && editar(item, { scheduledDate: evento.target.value })} />
                    </label>
                    <button type="button" className="boton-texto enlace pequeno" disabled={envio.enviando}
                      onClick={() => editar(item, { status: item.status === 'skipped' ? 'pending' : 'skipped' })}>
                      {item.status === 'skipped' ? 'Recuperar' : 'Omitir'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="acciones-compactas" style={{ marginTop: 18 }}>
        <button type="button" className="boton secundario" onClick={alRehacer}>Rehacer con mi dominio actual</button>
        <button type="button" className="boton-texto enlace" onClick={archivar}>Archivar plan</button>
      </div>
    </>
  );
}

function PlanEstudio({ cursoId }) {
  const consulta = useDatos(`/courses/${cursoId}/study-plan`);
  const [local, setLocal] = useState(undefined);
  const [rehaciendo, setRehaciendo] = useState(false);
  const plan = local === undefined ? consulta.datos : local;

  const recargar = () => { setLocal(undefined); setRehaciendo(false); consulta.recargar(); };

  return (
    <section className="tarjeta" aria-labelledby="titulo-plan">
      <h2 id="titulo-plan">Plan de estudio</h2>
      <p className="tenue">
        Se arma con tu dominio por tema y los prerrequisitos del curso: primero lo que más te cuesta, sin pasar de los minutos que elijas.
      </p>
      {consulta.cargando && !consulta.datos && <Cargando />}
      <MensajeError error={consulta.error} />
      {!consulta.cargando && (!plan || rehaciendo) && (
        <FormularioPlan cursoId={cursoId} alCrear={recargar} alCancelar={plan ? () => setRehaciendo(false) : null} />
      )}
      {plan && !rehaciendo && <PlanVigente plan={plan} alCambiar={setLocal} alRehacer={() => setRehaciendo(true)} />}
    </section>
  );
}

// Página del estudiante con su repaso espaciado y su plan de estudio por curso.
export default function EstudiantePlan() {
  const cursos = useDatos('/courses?limit=100');
  const [elegido, setElegido] = useState('');
  const cursoId = elegido || cursos.datos?.[0]?.id || null;

  if (cursos.cargando) return <Cargando />;
  if (cursos.error) return <MensajeError error={cursos.error} />;
  if (cursos.datos.length === 0) {
    return (
      <>
        <h1>Mi plan</h1>
        <EstadoVacio ilustracion="grafica" titulo="Aún no hay nada que planificar" detalle="Tu plan y tus repasos aparecerán cuando estés matriculado en un curso." />
      </>
    );
  }

  return (
    <>
      <h1>Mi plan</h1>
      <Campo etiqueta="Curso" tipo="select" valor={cursoId} alCambiar={setElegido}
        opciones={cursos.datos.map((curso) => ({ valor: curso.id, texto: curso.title }))} />
      {/* La clave reinicia el estado al cambiar de curso. */}
      <Repasos key={`r${cursoId}`} cursoId={cursoId} />
      <PlanEstudio key={`p${cursoId}`} cursoId={cursoId} />
    </>
  );
}
