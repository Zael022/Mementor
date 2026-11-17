import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import CarpetaDrive from '../Componentes/CarpetaDrive.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Aviso, Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { fechaHora } from '../utils/fechas.js';

const ORIGEN = { lesson: 'Lección', material: 'Material', drive: 'Google Drive' };
const MOTIVO_RETIRO = {
  teacher_retired: 'retirada por el docente', lesson_unpublished: 'la lección volvió a borrador', lesson_deleted: 'la lección se eliminó',
  material_deleted: 'el material se eliminó', drive_removed: 'ya no está en la carpeta', drive_access_lost: 'se perdió el acceso a la carpeta',
  drive_unlinked: 'se desvinculó la carpeta', drive_folder_changed: 'se cambió la carpeta', drive_folder_disabled: 'la institución deshabilitó la carpeta',
};

// Una fuente con su estado, versiones y acciones.
function FilaFuente({ fuente, alCambiar }) {
  const { enviando, error, ejecutar } = useEnvio();
  const ultima = fuente.versions[0];
  async function accion(llamada) {
    if (await ejecutar(llamada)) alCambiar();
  }
  return (
    <li className="fuente">
      <div className="fuente-cabecera">
        <div>
          <strong>{fuente.title}</strong> <span className="tenue pequeno">· {ORIGEN[fuente.origin]}</span>
          <div className="acciones-compactas">
            <Insignia estado={fuente.status === 'retired' ? 'retired' : fuente.state} />
            {fuente.activeVersionNo && <span className="tenue pequeno">En uso: versión {fuente.activeVersionNo}</span>}
            {fuente.status === 'retired' && <span className="tenue pequeno">Motivo: {MOTIVO_RETIRO[fuente.retireReason] || fuente.retireReason}. Limpieza remota: {fuente.cleanupStatus === 'done' ? 'completa' : 'pendiente'}.</span>}
          </div>
        </div>
        {fuente.status === 'active' && (
          <div className="acciones-compactas">
            {ultima && ['error', 'processing'].includes(ultima.state) && (
              <button type="button" className="boton secundario" disabled={enviando} onClick={() => accion(() => api.post(`/knowledge/versions/${ultima.id}/retry`))}>
                {ultima.state === 'error' ? 'Reintentar' : 'Actualizar estado'}
              </button>
            )}
            <button type="button" className="boton peligro" disabled={enviando} onClick={() => accion(() => api.post(`/knowledge/sources/${fuente.id}/retire`))}>Retirar del tutor</button>
          </div>
        )}
      </div>
      {fuente.state === 'error' && fuente.errorMessage && <p className="aviso error pequeno">{fuente.errorMessage}</p>}
      <details className="versiones">
        <summary>Versiones ({fuente.versions.length})</summary>
        <table className="tabla">
          <thead><tr><th scope="col">Versión</th><th scope="col">Estado</th><th scope="col">Creada</th><th scope="col">Usada en respuestas</th></tr></thead>
          <tbody>
            {fuente.versions.map((version) => (
              <tr key={version.id}>
                <td>{version.versionNo}{version.active ? ' (vigente)' : ''}</td>
                <td><Insignia estado={version.state} /></td>
                <td>{fechaHora(version.createdAt)}</td>
                <td>{version.usedInAnswers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <MensajeError error={error} />
    </li>
  );
}

// Fuentes que el tutor puede consultar en el curso, con su estado de indexación.
export default function CursoFuentes() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const fuentes = useDatos(`/courses/${id}/knowledge`);
  const { enviando, error, ejecutar } = useEnvio();
  const enCurso = (fuentes.datos?.sources || []).some((fuente) => fuente.status === 'active' && ['pending', 'processing'].includes(fuente.state));

  // Mientras haya importaciones en curso, se actualiza el estado cada pocos segundos.
  const { recargar } = fuentes;
  useEffect(() => {
    if (!enCurso) return undefined;
    const reloj = setInterval(recargar, 5000);
    return () => clearInterval(reloj);
  }, [enCurso, recargar]);

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;
  const datos = fuentes.datos;
  const activas = datos?.sources.filter((fuente) => fuente.status === 'active') || [];
  const retiradas = datos?.sources.filter((fuente) => fuente.status === 'retired') || [];

  async function indexarExistentes() {
    if (await ejecutar(() => api.post(`/courses/${id}/knowledge/index-existing`))) recargar();
  }

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <section className="tarjeta">
        <h2>Fuentes del tutor</h2>
        <p className="tenue">
          El tutor solo responde con estas fuentes: lecciones publicadas, archivos PDF con texto, DOCX y TXT del curso y documentos de la carpeta de Drive vinculada.
          Una fuente retirada deja de usarse en el acto.
        </p>
        {datos && (
          <p className="pequeno">
            Búsqueda: <strong>{datos.mode === 'vertex' ? 'RAG Engine de Google Cloud (por significado)' : 'local por palabras'}</strong>
            {datos.corpus && <> · Corpus del curso: <Insignia estado={datos.corpus.status} /></>}
          </p>
        )}
        {datos && !datos.configured && <Aviso tipo="error">{datos.reason}</Aviso>}
        {datos?.notIndexed.length > 0 && (
          <div className="aviso info">
            <p>Hay {datos.notIndexed.length} lecciones o archivos que existían antes y aún no son fuentes del tutor.</p>
            <button type="button" className="boton" disabled={enviando} onClick={indexarExistentes}>{enviando ? 'Indexando…' : 'Indexar ahora'}</button>
          </div>
        )}
        <MensajeError error={error || fuentes.error} />
      </section>

      <CarpetaDrive cursoId={id} alSincronizar={recargar} />

      {fuentes.cargando && !datos && <Cargando />}
      {datos && activas.length === 0 && (
        <EstadoVacio ilustracion="libro" titulo="Aún no hay fuentes" detalle="Publica una lección, sube un PDF, DOCX o TXT en «Anuncios y materiales» o vincula una carpeta de Drive." />
      )}
      {activas.length > 0 && (
        <section className="tarjeta">
          <h2>Activas ({activas.length})</h2>
          <ul className="lista-fuentes">{activas.map((fuente) => <FilaFuente key={fuente.id} fuente={fuente} alCambiar={recargar} />)}</ul>
        </section>
      )}
      {retiradas.length > 0 && (
        <section className="tarjeta">
          <h2>Retiradas ({retiradas.length})</h2>
          <ul className="lista-fuentes">{retiradas.map((fuente) => <FilaFuente key={fuente.id} fuente={fuente} alCambiar={recargar} />)}</ul>
        </section>
      )}
    </>
  );
}
