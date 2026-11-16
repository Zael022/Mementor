import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Campo from './Campo.jsx';
import Markdown from './Markdown.jsx';
import { GestorMateriales } from './Materiales.jsx';
import { useBaseGestion } from './EncabezadoCurso.jsx';
import { Cargando, MensajeError } from './Estados.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Permite crear o editar una lección en Markdown con vista previa.
export default function EditorLeccion({ leccionId, temaId, cursoId, alCerrar, alGuardar }) {
  const base = useBaseGestion();
  const [formulario, setFormulario] = useState({ title: '', bodyMd: '', videoUrl: '', status: 'draft' });
  const [cargando, setCargando] = useState(Boolean(leccionId));
  const { enviando, error, ejecutar } = useEnvio();
  const cambiar = (campo) => (valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  useEffect(() => {
    if (!leccionId) {
      setFormulario({ title: '', bodyMd: '', videoUrl: '', status: 'draft' });
      setCargando(false);
      return;
    }
    setCargando(true);
    api.get(`/lessons/${leccionId}`)
      .then(({ data }) => setFormulario({ title: data.title, bodyMd: data.bodyMd, videoUrl: data.videoUrl || '', status: data.status }))
      .finally(() => setCargando(false));
  }, [leccionId]);

  async function guardar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(async () => {
      if (leccionId) return api.patch(`/lessons/${leccionId}`, formulario);
      const creada = await api.post(`/topics/${temaId}/lessons`, { title: formulario.title, bodyMd: formulario.bodyMd, videoUrl: formulario.videoUrl });
      return formulario.status === 'published' ? api.patch(`/lessons/${creada.data.id}`, { status: 'published' }) : creada;
    });
    if (!respuesta) return;
    alGuardar();
    alCerrar();
  }

  async function eliminar() {
    if (await ejecutar(() => api.delete(`/lessons/${leccionId}`))) {
      alGuardar();
      alCerrar();
    }
  }

  if (cargando) return <Cargando />;

  return (
    <form className="editor" onSubmit={guardar}>
      <h4>{leccionId ? 'Editar lección' : 'Nueva lección'}</h4>
      <Campo etiqueta="Título" valor={formulario.title} alCambiar={cambiar('title')} required minLength={2} maxLength={180} />
      <div className="dos-columnas">
        <Campo etiqueta="Contenido (Markdown)" tipo="textarea" filas={12} valor={formulario.bodyMd} alCambiar={cambiar('bodyMd')} required />
        <div>
          <p className="etiqueta">Vista previa</p>
          <div className="vista-previa"><Markdown texto={formulario.bodyMd} /></div>
        </div>
      </div>
      <Campo etiqueta="Video de la lección (YouTube o Vimeo, opcional)" tipo="url" valor={formulario.videoUrl} alCambiar={cambiar('videoUrl')}
        placeholder="https://www.youtube.com/watch?v=…" ayuda="El video se reproduce dentro de la lección." />
      {leccionId ? (
        <fieldset>
          <legend>Materiales de esta lección</legend>
          <GestorMateriales cursoId={cursoId} leccionId={leccionId} />
        </fieldset>
      ) : (
        <p className="tenue pequeno">Guarda la lección para poder adjuntarle materiales.</p>
      )}
      <Campo etiqueta="Estado" tipo="select" valor={formulario.status} alCambiar={cambiar('status')}
        opciones={[{ valor: 'draft', texto: 'Borrador' }, { valor: 'published', texto: 'Publicada' }]} />
      <MensajeError error={error} />
      <div className="acciones">
        <button type="submit" className="boton" disabled={enviando}>Guardar lección</button>
        <button type="button" className="boton secundario" onClick={alCerrar}>Cancelar</button>
        {leccionId && <Link className="boton secundario" to={`${base}/lecciones/${leccionId}`}>Ver como estudiante</Link>}
        {leccionId && <button type="button" className="boton peligro" onClick={eliminar}>Eliminar</button>}
      </div>
    </form>
  );
}
