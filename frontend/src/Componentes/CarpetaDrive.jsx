import { useEffect, useState } from 'react';
import Campo from './Campo.jsx';
import { Cargando, Insignia, MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { fechaHora } from '../utils/fechas.js';

// Vincula una carpeta de Drive habilitada por la institución y la sincroniza.
export default function CarpetaDrive({ cursoId, alSincronizar }) {
  const drive = useDatos(`/courses/${cursoId}/drive`);
  const [carpeta, setCarpeta] = useState('');
  const { enviando, error, ejecutar } = useEnvio();
  const vinculo = drive.datos?.link;
  const sincronizando = vinculo?.syncState === 'running';

  // Mientras sincroniza, consulta el estado y refresca la lista de fuentes al terminar.
  const { recargar } = drive;
  useEffect(() => {
    if (!sincronizando) return undefined;
    const reloj = setInterval(() => { recargar(); alSincronizar?.(); }, 3000);
    return () => clearInterval(reloj);
  }, [sincronizando, recargar, alSincronizar]);

  async function accion(llamada) {
    if (await ejecutar(llamada)) { recargar(); alSincronizar?.(); }
  }

  if (drive.cargando && !drive.datos) return <Cargando />;
  if (drive.error) return <MensajeError error={drive.error} />;
  const carpetas = drive.datos.folders;

  return (
    <section className="tarjeta">
      <h2>Carpeta de Google Drive</h2>
      {!vinculo && carpetas.length === 0 && <p className="tenue">Tu institución aún no habilitó carpetas de Drive. Pídelo a la administración.</p>}
      {!vinculo && carpetas.length > 0 && (
        <div className="fila-formulario">
          <Campo etiqueta="Carpeta habilitada" tipo="select" valor={carpeta} alCambiar={setCarpeta}
            opciones={[{ valor: '', texto: 'Elige una carpeta' }, ...carpetas.map((item) => ({ valor: item.id, texto: item.label }))]} />
          <button type="button" className="boton" disabled={!carpeta || enviando} onClick={() => accion(() => api.put(`/courses/${cursoId}/drive`, { driveFolderId: Number(carpeta) }))}>Vincular</button>
        </div>
      )}
      {vinculo && (
        <>
          <p>
            <strong>{vinculo.folder?.label}</strong> <Insignia estado={vinculo.syncState} />
            <br />
            <span className="tenue pequeno">
              {vinculo.lastSyncCompletedAt ? `Última sincronización completa: ${fechaHora(vinculo.lastSyncCompletedAt)}` : 'Aún no se sincroniza.'}
              {vinculo.resumable && vinculo.syncState !== 'running' && ' · Hay una sincronización a medias que continuará donde quedó.'}
            </span>
          </p>
          {vinculo.lastError && <p className="aviso error pequeno">{vinculo.lastError}</p>}
          <div className="acciones">
            <button type="button" className="boton" disabled={enviando || sincronizando} onClick={() => accion(() => api.post(`/courses/${cursoId}/drive/sync`))}>
              {sincronizando ? 'Sincronizando…' : vinculo.resumable ? 'Reanudar sincronización' : 'Sincronizar ahora'}
            </button>
            <button type="button" className="boton secundario" disabled={enviando || sincronizando} onClick={() => accion(() => api.delete(`/courses/${cursoId}/drive`))}>Desvincular</button>
          </div>
          <p className="tenue pequeno">MENTOR solo lee la carpeta: los originales se quedan en Drive. Google Docs se exportan como texto; PDF, DOCX y TXT se descargan.</p>
        </>
      )}
      <MensajeError error={error} />
    </section>
  );
}
