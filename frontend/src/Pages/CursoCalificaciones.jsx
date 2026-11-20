import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import Desplegable from '../Componentes/Desplegable.jsx';
import EncabezadoCurso, { useBaseGestion } from '../Componentes/EncabezadoCurso.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Aviso, Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const coma = (valor, decimales = 1) => (valor === null || valor === undefined ? '—' : Number(valor).toFixed(decimales).replace('.', ','));

// Pesos de la nota y valores del bono; los tres pesos deben sumar 100.
function FormularioPolitica({ cursoId, politica, alGuardar }) {
  const [valores, setValores] = useState(politica);
  const [guardado, setGuardado] = useState(false);
  const { enviando, error, ejecutar } = useEnvio();
  const suma = Number(valores.assessmentsWeight) + Number(valores.assignmentsWeight) + Number(valores.classworkWeight);
  const cambiar = (campo) => (valor) => { setGuardado(false); setValores((previos) => ({ ...previos, [campo]: valor })); };

  async function guardar(evento) {
    evento.preventDefault();
    const cuerpo = Object.fromEntries(['assessmentsWeight', 'assignmentsWeight', 'classworkWeight', 'quizBonus', 'streakDayBonus', 'bonusCap']
      .map((campo) => [campo, Number(valores[campo])]));
    if (await ejecutar(() => api.put(`/courses/${cursoId}/grade-policy`, cuerpo))) {
      setGuardado(true);
      alGuardar();
    }
  }

  return (
    <form className="tarjeta" onSubmit={guardar}>
      <h3>Pesos de la nota (deben sumar 100)</h3>
      <div className="fila-formulario">
        <Campo etiqueta="Evaluaciones (%)" tipo="number" min={0} max={100} valor={valores.assessmentsWeight} alCambiar={cambiar('assessmentsWeight')} required />
        <Campo etiqueta="Tareas (%)" tipo="number" min={0} max={100} valor={valores.assignmentsWeight} alCambiar={cambiar('assignmentsWeight')} required />
        <Campo etiqueta="Trabajo en clase (%)" tipo="number" min={0} max={100} valor={valores.classworkWeight} alCambiar={cambiar('classworkWeight')} required />
      </div>
      <p className={suma === 100 ? 'texto-exito' : 'texto-error'}>Suma: {suma} %</p>
      <h3>Bono (sobre una nota de 0 a 10)</h3>
      <div className="fila-formulario">
        <Campo etiqueta="Por quiz perfecto" tipo="number" min={0} max={10} step={0.01} valor={valores.quizBonus} alCambiar={cambiar('quizBonus')} required />
        <Campo etiqueta="Por día de racha" tipo="number" min={0} max={10} step={0.01} valor={valores.streakDayBonus} alCambiar={cambiar('streakDayBonus')} required />
        <Campo etiqueta="Tope del bono" tipo="number" min={0} max={10} step={0.01} valor={valores.bonusCap} alCambiar={cambiar('bonusCap')} required />
      </div>
      <p className="tenue pequeno">Un cambio en el valor del bono aplica a lo que se gane desde ahora; lo ya ganado conserva su valor. El tope se aplica siempre.</p>
      <button type="submit" className="boton" disabled={enviando || suma !== 100}>Guardar configuración</button>
      {guardado && <Aviso tipo="exito">Configuración guardada.</Aviso>}
      <MensajeError error={error} />
    </form>
  );
}

// Calificación de una actividad: un campo de puntos y uno de comentario por estudiante.
function CalificarActividad({ actividad, estudiantes, alGuardar }) {
  const [notas, setNotas] = useState({});
  const [guardado, setGuardado] = useState(false);
  const { enviando, error, ejecutar } = useEnvio();

  useEffect(() => {
    setNotas(Object.fromEntries(estudiantes.map((estudiante) => {
      const nota = actividad.grades.find((item) => item.studentId === estudiante.studentId);
      return [estudiante.studentId, { points: nota ? String(nota.points) : '', feedback: nota?.feedback || '' }];
    })));
  }, [actividad, estudiantes]);

  // El aviso de guardado solo se borra al cambiar de actividad, no al recargar los datos tras guardar.
  useEffect(() => { setGuardado(false); }, [actividad.id]);

  async function guardar(evento) {
    evento.preventDefault();
    const grades = Object.entries(notas).map(([studentId, nota]) => ({
      studentId: Number(studentId),
      points: nota.points === '' ? null : Number(nota.points),
      ...(nota.feedback ? { feedback: nota.feedback } : {}),
    }));
    if (await ejecutar(() => api.put(`/class-work/${actividad.id}/grades`, { grades }))) {
      setGuardado(true);
      alGuardar();
    }
  }

  const cambiar = (studentId, campo, valor) => {
    setGuardado(false);
    setNotas((previas) => ({ ...previas, [studentId]: { ...previas[studentId], [campo]: valor } }));
  };

  return (
    <form onSubmit={guardar}>
      <table className="tabla tabla-notas">
        <thead><tr><th scope="col">Estudiante</th><th scope="col">Puntos (de {actividad.maxPoints})</th><th scope="col">Comentario</th></tr></thead>
        <tbody>
          {estudiantes.map((estudiante) => (
            <tr key={estudiante.studentId}>
              <th scope="row">{estudiante.displayName}</th>
              <td>
                <input type="number" min={0} max={actividad.maxPoints} step={0.01} value={notas[estudiante.studentId]?.points ?? ''}
                  aria-label={`Puntos de ${estudiante.displayName}`} onChange={(evento) => cambiar(estudiante.studentId, 'points', evento.target.value)} />
              </td>
              <td>
                <input type="text" maxLength={1000} value={notas[estudiante.studentId]?.feedback ?? ''}
                  aria-label={`Comentario para ${estudiante.displayName}`} onChange={(evento) => cambiar(estudiante.studentId, 'feedback', evento.target.value)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tenue pequeno">Deja vacío el campo de puntos para quitar una calificación.</p>
      <button type="submit" className="boton" disabled={enviando}>Guardar calificaciones</button>
      {guardado && <Aviso tipo="exito">Calificaciones guardadas.</Aviso>}
      <MensajeError error={error} />
    </form>
  );
}

// Libro de calificaciones del docente: nota final, trabajo en clase y configuración de la nota.
export default function CursoCalificaciones() {
  const { id } = useParams();
  const base = useBaseGestion();
  const curso = useDatos(`/courses/${id}`);
  const notas = useDatos(`/courses/${id}/grades`);
  const actividades = useDatos(`/courses/${id}/class-work`);
  const [seleccionada, setSeleccionada] = useState(null);
  const [nueva, setNueva] = useState({ title: '', maxPoints: 100, workDate: '' });
  const { enviando, error, ejecutar } = useEnvio();

  if ((curso.cargando && !curso.datos) || (notas.cargando && !notas.datos)) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;
  if (notas.error) return <MensajeError error={notas.error} />;

  const { policy: politica, students: estudiantes } = notas.datos;
  const actividad = actividades.datos?.find((item) => item.id === seleccionada) || actividades.datos?.[0] || null;
  const recargarTodo = () => { notas.recargar(); actividades.recargar(); };

  async function crearActividad(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post(`/courses/${id}/class-work`, {
      title: nueva.title, maxPoints: Number(nueva.maxPoints), workDate: nueva.workDate || null,
    }));
    if (!respuesta) return;
    setNueva({ title: '', maxPoints: 100, workDate: '' });
    setSeleccionada(respuesta.data.id);
    actividades.recargar();
  }

  async function borrarActividad() {
    if (await ejecutar(() => api.delete(`/class-work/${actividad.id}`))) {
      setSeleccionada(null);
      recargarTodo();
    }
  }

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />

      <h2>Libro de calificaciones</h2>
      <p className="tenue">
        Nota de 0 a {politica.scale}: evaluaciones {politica.assessmentsWeight} %, tareas {politica.assignmentsWeight} % y trabajo en clase {politica.classworkWeight} %,
        más el bono (tope {coma(politica.bonusCap, 2)}). Las tareas se califican en la pestaña <Link to={`${base}/cursos/${id}/tareas`}>Tareas</Link>.
      </p>
      {estudiantes.length === 0 ? (
        <EstadoVacio ilustracion="grafica" titulo="No hay estudiantes matriculados" detalle="Matricula estudiantes en la pestaña Personas para ver sus notas." />
      ) : (
        <div className="tabla-desplazable">
          <table className="tabla tabla-notas">
            <thead>
              <tr>
                <th scope="col">Estudiante</th>
                <th scope="col">Evaluaciones</th>
                <th scope="col">Tareas</th>
                <th scope="col">Trabajo en clase</th>
                <th scope="col">Bono</th>
                <th scope="col">Racha</th>
                <th scope="col">Nota final</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes.map((fila) => (
                <tr key={fila.studentId}>
                  <th scope="row">{fila.displayName}</th>
                  <td>{fila.assessmentsPct === null ? '—' : `${coma(fila.assessmentsPct)} %`}</td>
                  <td>{fila.assignmentsPct === null ? '—' : `${coma(fila.assignmentsPct)} %`}</td>
                  <td>{fila.classworkPct === null ? '—' : `${coma(fila.classworkPct)} %`}</td>
                  <td title={`Ganado ${coma(fila.bonusEarned, 2)}`}>+{coma(fila.bonusApplied, 2)}</td>
                  <td>{fila.streak.current} {fila.streak.current === 1 ? 'día' : 'días'}</td>
                  <td><strong>{coma(fila.final, 2)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Trabajo en clase</h2>
      <Desplegable etiqueta="Nueva actividad" sugerirAbierto={actividades.datos?.length === 0}>
        <form className="tarjeta" onSubmit={crearActividad}>
          <div className="fila-formulario">
            <Campo etiqueta="Actividad" valor={nueva.title} alCambiar={(valor) => setNueva({ ...nueva, title: valor })} required minLength={2} maxLength={180} />
            <Campo etiqueta="Puntos máximos" tipo="number" min={1} max={1000} valor={nueva.maxPoints} alCambiar={(valor) => setNueva({ ...nueva, maxPoints: valor })} required />
            <Campo etiqueta="Fecha (opcional)" tipo="date" valor={nueva.workDate} alCambiar={(valor) => setNueva({ ...nueva, workDate: valor })} />
          </div>
          <button type="submit" className="boton" disabled={enviando}>Crear actividad</button>
        </form>
      </Desplegable>
      <MensajeError error={error || actividades.error} />
      {actividades.datos?.length === 0 && <p className="tenue">Crea una actividad (participación, práctica guiada, exposición…) para calificarla.</p>}
      {actividad && (
        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <Campo etiqueta="Actividad a calificar" tipo="select" valor={actividad.id} alCambiar={(valor) => setSeleccionada(Number(valor))}
              opciones={actividades.datos.map((item) => ({ valor: item.id, texto: `${item.title}${item.workDate ? ` (${item.workDate})` : ''}` }))} />
            <button type="button" className="boton peligro" disabled={enviando} onClick={borrarActividad}>Eliminar actividad</button>
          </div>
          {estudiantes.length > 0 && <CalificarActividad actividad={actividad} estudiantes={estudiantes} alGuardar={recargarTodo} />}
        </section>
      )}

      <h2>Configuración de la nota</h2>
      <FormularioPolitica key={JSON.stringify(politica)} cursoId={id} politica={politica} alGuardar={notas.recargar} />
    </>
  );
}
