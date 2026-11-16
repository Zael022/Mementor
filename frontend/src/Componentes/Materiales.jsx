import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBaseGestion } from './EncabezadoCurso.jsx';
import Campo from './Campo.jsx';
import CargaArchivo from './CargaArchivo.jsx';
import { Cargando, Insignia, MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { tamanoArchivo } from '../utils/fechas.js';

// Enlace para abrir o descargar un material.
function EnlaceMaterial({ material }) {
  if (material.kind === 'link') {
    return <a href={material.url} target="_blank" rel="noopener noreferrer">{material.title}</a>;
  }
  return <a href={`/api/v1/materials/${material.id}/download`} download>{material.title}</a>;
}

// Lista los materiales de un curso o de una lección.
export function ListaMateriales({ cursoId, leccionId, vacio = 'No hay materiales todavía.', mostrarLeccion = false }) {
  const materiales = useDatos(`/courses/${cursoId}/materials${leccionId ? `?lessonId=${leccionId}` : ''}`);
  if (materiales.cargando) return <Cargando />;
  if (materiales.error) return <MensajeError error={materiales.error} />;
  if (materiales.datos.length === 0) return <p className="tenue">{vacio}</p>;

  return (
    <ul className="lista-simple">
      {materiales.datos.map((material) => (
        <li key={material.id}>
          <span><span className="icono-material">{material.kind === 'link' ? 'Enlace' : 'Archivo'}</span> <EnlaceMaterial material={material} /></span>
          <span className="tenue pequeno">
            {mostrarLeccion && material.lessonTitle ? `${material.lessonTitle} · ` : ''}
            {material.kind === 'file' ? `${material.fileName} · ${tamanoArchivo(material.sizeBytes)}` : 'Se abre en otra pestaña'}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Estado de indexación que informa la API (solo lo ve quien gestiona el curso).
function EstadoIndexacion({ knowledge, cursoId }) {
  const base = useBaseGestion();
  if (!knowledge || knowledge.state === 'not_indexable') return null;
  return (
    <span className="estado-indexacion">
      <Insignia estado={knowledge.state} />
      {knowledge.state === 'error' && knowledge.errorMessage && <span className="texto-error pequeno"> {knowledge.errorMessage}</span>}
      {knowledge.state === 'not_indexed' && <Link className="pequeno" to={`${base}/cursos/${cursoId}/fuentes`}> Indexar</Link>}
    </span>
  );
}

// Permite al docente agregar enlaces o subir archivos.
export function GestorMateriales({ cursoId, leccionId = null }) {
  const materiales = useDatos(`/courses/${cursoId}/materials${leccionId ? `?lessonId=${leccionId}` : ''}`);
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [rechazo, setRechazo] = useState(null);
  const [subido, setSubido] = useState(null);
  const enCurso = useRef(false);
  const { enviando, error, ejecutar, limpiarError } = useEnvio();
  const propios = (materiales.datos || []).filter((material) => (leccionId ? true : material.lessonId === null));

  async function agregarEnlace() {
    const respuesta = await ejecutar(() => api.post(`/courses/${cursoId}/materials`, { title: titulo, url, lessonId: leccionId }));
    if (!respuesta) return;
    setTitulo('');
    setUrl('');
    materiales.recargar();
  }

  function elegir(nuevo) {
    setArchivo(nuevo);
    setRechazo(null);
    setSubido(null);
    limpiarError();
  }

  // Una sola petición por confirmación; si falla, el archivo sigue elegido para reintentar.
  async function subirArchivo() {
    if (!archivo || enCurso.current) return;
    enCurso.current = true;
    const datos = new FormData();
    datos.append('file', archivo);
    if (titulo) datos.append('title', titulo);
    if (leccionId) datos.append('lessonId', String(leccionId));
    const respuesta = await ejecutar(() => api.upload(`/courses/${cursoId}/materials/upload`, datos));
    enCurso.current = false;
    if (!respuesta) return;
    setSubido(respuesta.data);
    setTitulo('');
    setArchivo(null);
    materiales.recargar();
  }

  async function eliminar(id) {
    if (await ejecutar(() => api.delete(`/materials/${id}`))) materiales.recargar();
  }

  return (
    <div className="gestor-materiales">
      {materiales.cargando && !materiales.datos && <Cargando />}
      {propios.length === 0 && !materiales.cargando && <p className="tenue">No hay materiales todavía.</p>}
      <ul className="lista-simple">
        {propios.map((material) => (
          <li key={material.id}>
            <span>
              <span className="icono-material">{material.kind === 'link' ? 'Enlace' : 'Archivo'}</span> <EnlaceMaterial material={material} />
              {material.kind === 'file' && <EstadoIndexacion knowledge={material.knowledge} cursoId={cursoId} />}
            </span>
            <button type="button" className="boton peligro" onClick={() => eliminar(material.id)}>Quitar</button>
          </li>
        ))}
      </ul>
      <Campo etiqueta="Título del material" valor={titulo} alCambiar={setTitulo} maxLength={180} ayuda="Opcional si subes un archivo: se usa el nombre del archivo." />
      <div className="fila-formulario">
        <Campo etiqueta="Enlace (https://…)" tipo="url" valor={url} alCambiar={setUrl} placeholder="https://" />
        <button type="button" className="boton secundario" disabled={enviando || !titulo || !url} onClick={agregarEnlace}>Agregar enlace</button>
      </div>
      <CargaArchivo archivo={archivo} alElegir={elegir} alRechazar={(motivo) => { setArchivo(null); setRechazo(motivo); }} deshabilitado={enviando} />
      <div className="acciones">
        <button type="button" className="boton" disabled={enviando || !archivo} onClick={subirArchivo}>
          {enviando && archivo ? 'Subiendo…' : error && archivo ? 'Reintentar subida' : 'Subir archivo'}
        </button>
      </div>
      {rechazo && <p className="aviso error" role="alert">{rechazo}</p>}
      {subido && (
        <p className="aviso exito" role="status">
          «{subido.title}» se subió.
          {subido.knowledge && subido.knowledge.state !== 'not_indexable' && <> Indexación para el tutor: <Insignia estado={subido.knowledge.state} /></>}
        </p>
      )}
      <MensajeError error={error || materiales.error} />
    </div>
  );
}
