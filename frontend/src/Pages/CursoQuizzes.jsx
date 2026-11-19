import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import Desplegable from '../Componentes/Desplegable.jsx';
import EditorQuiz from '../Componentes/EditorQuiz.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// El docente crea quizzes rápidos; al publicarlos alimentan la práctica diaria de la racha.
export default function CursoQuizzes() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const quizzes = useDatos(`/courses/${id}/quick-quizzes`);
  const [formulario, setFormulario] = useState({ title: '', secondsPerQuestion: 20 });
  const [abierto, setAbierto] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;

  async function crear(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post(`/courses/${id}/quick-quizzes`, {
      title: formulario.title, secondsPerQuestion: Number(formulario.secondsPerQuestion),
    }));
    if (!respuesta) return;
    setFormulario({ title: '', secondsPerQuestion: 20 });
    setAbierto(respuesta.data.id);
    quizzes.recargar();
  }

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <p className="tenue">Los quizzes se juegan contra el reloj. Un quiz perfecto suma bono a la nota del estudiante (una vez por quiz) y sus preguntas forman la práctica diaria que mantiene la racha.</p>
      <Desplegable etiqueta="Nuevo quiz" sugerirAbierto={quizzes.datos?.length === 0}>
        <form className="tarjeta" onSubmit={crear}>
          <div className="fila-formulario">
            <Campo etiqueta="Título" valor={formulario.title} alCambiar={(valor) => setFormulario({ ...formulario, title: valor })} required minLength={2} maxLength={180} />
            <Campo etiqueta="Segundos por pregunta" tipo="number" min={5} max={120} valor={formulario.secondsPerQuestion}
              alCambiar={(valor) => setFormulario({ ...formulario, secondsPerQuestion: valor })} required />
          </div>
          <button type="submit" className="boton" disabled={enviando}>Crear quiz</button>
          <MensajeError error={error} />
        </form>
      </Desplegable>

      <MensajeError error={quizzes.error} />
      {quizzes.cargando && !quizzes.datos && <Cargando />}
      {quizzes.datos?.length === 0 && <EstadoVacio ilustracion="tarea" titulo="No hay quizzes todavía" detalle="Crea uno, agrégale preguntas y publícalo para que tus estudiantes lo jueguen." />}
      {quizzes.datos?.map((quiz) => (
        <article className="tarjeta" key={quiz.id}>
          <div className="tarjeta-cabecera">
            <div>
              <h3>{quiz.title} <Insignia estado={quiz.status} /></h3>
              <p className="tenue">{quiz.questionCount} pregunta(s) · {quiz.secondsPerQuestion} s por pregunta</p>
            </div>
            <button type="button" className="boton secundario" onClick={() => setAbierto(abierto === quiz.id ? null : quiz.id)}>
              {abierto === quiz.id ? 'Ocultar' : 'Ver preguntas'}
            </button>
          </div>
          {abierto === quiz.id && <EditorQuiz quizId={quiz.id} alCambiar={quizzes.recargar} />}
        </article>
      ))}
    </>
  );
}
