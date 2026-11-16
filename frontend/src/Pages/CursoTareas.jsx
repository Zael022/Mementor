import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import Desplegable from '../Componentes/Desplegable.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import RevisionTarea from '../Componentes/RevisionTarea.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { aIso, fechaHora } from '../utils/fechas.js';

const VACIO = { title: '', instructions: '', dueAt: '', maxPoints: 100 };

// Permite crear tareas, publicarlas y calificar las entregas.
export default function CursoTareas() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const tareas = useDatos(`/courses/${id}/assignments`);
  const [formulario, setFormulario] = useState(VACIO);
  const [abierta, setAbierta] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();
  const cambiar = (campo) => (valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;

  async function accion(llamada) {
    const respuesta = await ejecutar(llamada);
    if (respuesta) tareas.recargar();
    return respuesta;
  }

  async function crear(evento) {
    evento.preventDefault();
    const respuesta = await accion(() => api.post(`/courses/${id}/assignments`, {
      title: formulario.title,
      instructions: formulario.instructions,
      dueAt: aIso(formulario.dueAt),
      maxPoints: Number(formulario.maxPoints),
    }));
    if (respuesta) setFormulario(VACIO);
  }

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <Desplegable etiqueta="Nueva tarea" sugerirAbierto={tareas.datos?.length === 0}>
        <form className="tarjeta" onSubmit={crear}>
          <div className="fila-formulario">
            <Campo etiqueta="Título" valor={formulario.title} alCambiar={cambiar('title')} required minLength={2} maxLength={180} />
            <Campo etiqueta="Fecha de entrega (opcional)" tipo="datetime-local" valor={formulario.dueAt} alCambiar={cambiar('dueAt')} />
            <Campo etiqueta="Puntos" tipo="number" min={1} max={1000} valor={formulario.maxPoints} alCambiar={cambiar('maxPoints')} required />
          </div>
          <Campo etiqueta="Instrucciones (admite Markdown)" tipo="textarea" filas={4} valor={formulario.instructions} alCambiar={cambiar('instructions')} required />
          <button type="submit" className="boton" disabled={enviando}>Crear tarea</button>
          <p className="tenue pequeno">La tarea se crea como borrador; los estudiantes la ven cuando la publicas.</p>
          <MensajeError error={error} />
        </form>
      </Desplegable>

      <MensajeError error={tareas.error} />
      {tareas.cargando && !tareas.datos && <Cargando />}
      {tareas.datos?.length === 0 && <EstadoVacio titulo="No hay tareas todavía" detalle="Crea la primera tarea con el formulario de arriba." />}
      {tareas.datos?.map((tarea) => (
        <article className="tarjeta" key={tarea.id}>
          <div className="tarjeta-cabecera">
            <div>
              <h3>{tarea.title} <Insignia estado={tarea.status} /></h3>
              <ul className="meta">
                <li>{tarea.dueAt ? `Entrega: ${fechaHora(tarea.dueAt)}` : 'Sin fecha límite'}</li>
                <li>{tarea.maxPoints} puntos</li>
                <li>{tarea.submissionCount} entrega(s), {tarea.pendingGradeCount} sin calificar</li>
              </ul>
            </div>
            <div className="acciones">
              {tarea.status === 'draft'
                ? <button type="button" className="boton secundario" onClick={() => accion(() => api.patch(`/assignments/${tarea.id}`, { status: 'published' }))}>Publicar</button>
                : <button type="button" className="boton secundario" onClick={() => accion(() => api.patch(`/assignments/${tarea.id}`, { status: 'draft' }))}>Ocultar</button>}
              <button type="button" className="boton secundario" onClick={() => setAbierta(abierta === tarea.id ? null : tarea.id)}>
                {abierta === tarea.id ? 'Ocultar entregas' : 'Ver entregas'}
              </button>
              {tarea.submissionCount === 0 && (
                <button type="button" className="boton peligro" onClick={() => accion(() => api.delete(`/assignments/${tarea.id}`))}>Eliminar</button>
              )}
            </div>
          </div>
          {abierta === tarea.id && <RevisionTarea tareaId={tarea.id} alCalificar={tareas.recargar} />}
        </article>
      ))}
    </>
  );
}
