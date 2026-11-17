import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import EditorLeccion from '../Componentes/EditorLeccion.jsx';
import DocentesCurso from '../Componentes/DocentesCurso.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Formulario corto de una sola línea para crear módulos y temas.
function FormularioTitulo({ etiqueta, boton, alCrear }) {
  const [titulo, setTitulo] = useState('');
  async function enviar(evento) {
    evento.preventDefault();
    if (await alCrear(titulo)) setTitulo('');
  }
  return (
    <form className="fila-formulario" onSubmit={enviar}>
      <Campo etiqueta={etiqueta} valor={titulo} alCambiar={setTitulo} required minLength={2} maxLength={180} />
      <button type="submit" className="boton secundario">{boton}</button>
    </form>
  );
}

// Permite organizar módulos, temas y lecciones del curso.
export default function CursoContenidos() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const curso = useDatos(`/courses/${id}`);
  const [leccion, setLeccion] = useState(null);
  const { error, ejecutar } = useEnvio();

  async function accion(llamada) {
    const respuesta = await ejecutar(llamada);
    if (respuesta) curso.recargar();
    return Boolean(respuesta);
  }

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;
  const datos = curso.datos;
  const temas = datos.modules.flatMap((modulo) => modulo.topics);

  return (
    <>
      <EncabezadoCurso curso={datos} />
      <MensajeError error={error} />

      <section className="tarjeta">
        <div className="tarjeta-cabecera">
          <div>
            <h2>Estado del curso</h2>
            <p className="tenue">Los estudiantes matriculados solo ven cursos publicados y lecciones publicadas.</p>
          </div>
          <div className="acciones">
            {datos.status !== 'published' && <button type="button" className="boton" onClick={() => accion(() => api.patch(`/courses/${id}`, { status: 'published' }))}>Publicar curso</button>}
            {datos.status === 'published' && <button type="button" className="boton secundario" onClick={() => accion(() => api.patch(`/courses/${id}`, { status: 'draft' }))}>Volver a borrador</button>}
          </div>
        </div>
        {usuario.role === 'institution_admin' && <DocentesCurso curso={datos} alCambiar={curso.recargar} />}
      </section>

      {datos.modules.length === 0 && <EstadoVacio ilustracion="libro" titulo="Este curso aún no tiene módulos" detalle="Agrega el primer módulo para empezar a organizar los temas." />}

      {datos.modules.map((modulo) => (
        <section className="tarjeta" key={modulo.id}>
          <div className="tarjeta-cabecera">
            <h2>{modulo.title}</h2>
            <button type="button" className="boton peligro" onClick={() => accion(() => api.delete(`/modules/${modulo.id}`))}>Eliminar módulo</button>
          </div>
          {modulo.topics.length === 0 && <p className="tenue">Este módulo aún no tiene temas.</p>}
          {modulo.topics.map((tema) => (
            <div className="subpanel" key={tema.id}>
              <div className="tarjeta-cabecera">
                <div>
                  <h3>{tema.title}</h3>
                  {tema.learningObjective && <p className="tenue">{tema.learningObjective}</p>}
                </div>
                <button type="button" className="boton peligro" onClick={() => accion(() => api.delete(`/topics/${tema.id}`))}>Eliminar tema</button>
              </div>
              <Campo
                etiqueta="Prerrequisito"
                tipo="select"
                valor={tema.prerequisiteIds[0] || ''}
                alCambiar={(valor) => accion(() => api.put(`/topics/${tema.id}/prerequisites`, { prerequisiteTopicIds: valor ? [Number(valor)] : [] }))}
                opciones={[{ valor: '', texto: 'Sin prerrequisito' }, ...temas.filter((otro) => otro.id !== tema.id).map((otro) => ({ valor: otro.id, texto: otro.title }))]}
              />
              <ul className="lista-simple">
                {tema.lessons.map((item) => (
                  <li key={item.id}>
                    <span>{item.title} <Insignia estado={item.status} /></span>
                    <button type="button" className="boton secundario" onClick={() => setLeccion({ id: item.id, topicId: tema.id })}>Editar</button>
                  </li>
                ))}
              </ul>
              {tema.lessons.length === 0 && <p className="tenue">Este tema aún no tiene lecciones.</p>}
              <button type="button" className="boton secundario" onClick={() => setLeccion({ id: null, topicId: tema.id })}>Nueva lección</button>
              {leccion?.topicId === tema.id && (
                <EditorLeccion leccionId={leccion.id} temaId={tema.id} cursoId={datos.id} alCerrar={() => setLeccion(null)} alGuardar={curso.recargar} />
              )}
            </div>
          ))}
          <FormularioTitulo etiqueta="Nuevo tema" boton="Agregar tema" alCrear={(title) => accion(() => api.post(`/modules/${modulo.id}/topics`, { title }))} />
        </section>
      ))}

      <section className="tarjeta">
        <FormularioTitulo etiqueta="Nuevo módulo" boton="Agregar módulo" alCrear={(title) => accion(() => api.post(`/courses/${id}/modules`, { title }))} />
      </section>
    </>
  );
}
