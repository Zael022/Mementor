import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import Desplegable from '../Componentes/Desplegable.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import EditorEvaluacion from '../Componentes/EditorEvaluacion.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Permite crear cuestionarios y administrar sus preguntas.
export default function CursoEvaluaciones() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const evaluaciones = useDatos(`/courses/${id}/assessments`);
  const [formulario, setFormulario] = useState({ title: '', topicId: '', passingScore: 60, maxAttempts: 3 });
  const [abierta, setAbierta] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();
  const cambiar = (campo) => (valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;
  const temas = curso.datos.modules.flatMap((modulo) => modulo.topics);

  async function crear(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post(`/courses/${id}/assessments`, {
      title: formulario.title,
      topicId: Number(formulario.topicId),
      passingScore: Number(formulario.passingScore),
      maxAttempts: Number(formulario.maxAttempts),
    }));
    if (!respuesta) return;
    setFormulario({ title: '', topicId: '', passingScore: 60, maxAttempts: 3 });
    setAbierta(respuesta.data.id);
    evaluaciones.recargar();
  }

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <Desplegable etiqueta="Nueva evaluación" sugerirAbierto={evaluaciones.datos?.length === 0}>
        <section className="tarjeta">
          {temas.length === 0 ? (
            <p className="tenue">Primero crea al menos un tema en Contenidos; cada evaluación se asocia a un tema.</p>
          ) : (
            <form onSubmit={crear}>
              <div className="fila-formulario">
                <Campo etiqueta="Título" valor={formulario.title} alCambiar={cambiar('title')} required minLength={2} />
                <Campo etiqueta="Tema" tipo="select" valor={formulario.topicId} alCambiar={cambiar('topicId')} required
                  opciones={[{ valor: '', texto: 'Selecciona un tema' }, ...temas.map((tema) => ({ valor: tema.id, texto: tema.title }))]} />
                <Campo etiqueta="Nota mínima (%)" tipo="number" min={1} max={100} valor={formulario.passingScore} alCambiar={cambiar('passingScore')} required />
                <Campo etiqueta="Intentos máximos" tipo="number" min={1} max={20} valor={formulario.maxAttempts} alCambiar={cambiar('maxAttempts')} required />
              </div>
              <button type="submit" className="boton" disabled={enviando}>Crear evaluación</button>
            </form>
          )}
          <MensajeError error={error} />
        </section>
      </Desplegable>

      <MensajeError error={evaluaciones.error} />
      {evaluaciones.cargando && <Cargando />}
      {evaluaciones.datos?.length === 0 && <EstadoVacio titulo="No hay evaluaciones todavía" detalle="Crea un cuestionario y agrégale preguntas antes de publicarlo." />}
      {evaluaciones.datos?.map((evaluacion) => (
        <article className="tarjeta" key={evaluacion.id}>
          <div className="tarjeta-cabecera">
            <div>
              <h3>{evaluacion.title} <Insignia estado={evaluacion.status} /></h3>
              <p className="tenue">Tema: {evaluacion.topicTitle} · {evaluacion.questionCount} pregunta(s) · mínimo {evaluacion.passingScore} % · {evaluacion.maxAttempts} intento(s)</p>
            </div>
            <button type="button" className="boton secundario" onClick={() => setAbierta(abierta === evaluacion.id ? null : evaluacion.id)}>
              {abierta === evaluacion.id ? 'Ocultar' : 'Ver preguntas'}
            </button>
          </div>
          {abierta === evaluacion.id && <EditorEvaluacion evaluacionId={evaluacion.id} alCambiar={evaluaciones.recargar} />}
        </article>
      ))}
    </>
  );
}
