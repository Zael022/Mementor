import { useState } from 'react';
import Campo from '../Componentes/Campo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// La administración habilita las carpetas de Drive que los cursos pueden vincular.
export default function AdminDrive() {
  const carpetas = useDatos('/institution/drive-folders');
  const [folderId, setFolderId] = useState('');
  const [label, setLabel] = useState('');
  const { enviando, error, ejecutar } = useEnvio();

  async function habilitar(evento) {
    evento.preventDefault();
    if (await ejecutar(() => api.post('/institution/drive-folders', { folderId: folderId.trim(), label }))) {
      setFolderId('');
      setLabel('');
      carpetas.recargar();
    }
  }

  return (
    <>
      <h1>Carpetas de Google Drive</h1>
      <p className="tenue">
        Comparte la carpeta con la cuenta de servicio de MENTOR (permiso de lector) y pega aquí su identificador: es la parte final de la dirección de la carpeta.
        MENTOR comprueba el acceso antes de habilitarla y nunca modifica los originales.
      </p>
      <section className="tarjeta">
        <form className="fila-formulario" onSubmit={habilitar}>
          <Campo etiqueta="Identificador de la carpeta" valor={folderId} alCambiar={setFolderId} required minLength={10} maxLength={128} pattern="[A-Za-z0-9_-]+" />
          <Campo etiqueta="Nombre para mostrar" valor={label} alCambiar={setLabel} required minLength={2} maxLength={180} />
          <button type="submit" className="boton" disabled={enviando} aria-busy={enviando}>{enviando ? 'Comprobando…' : 'Habilitar carpeta'}</button>
        </form>
        <MensajeError error={error} />
      </section>
      {carpetas.cargando && !carpetas.datos && <Cargando />}
      <MensajeError error={carpetas.error} />
      {carpetas.datos?.length === 0 && <EstadoVacio titulo="Sin carpetas habilitadas" detalle="Cuando habilites una carpeta, los docentes podrán vincularla a sus cursos." />}
      {carpetas.datos?.length > 0 && (
        <section className="tarjeta">
          <ul className="lista-simple">
            {carpetas.datos.map((carpeta) => (
              <li key={carpeta.id}>
                <span>{carpeta.label} <Insignia estado={carpeta.status} /><br /><span className="tenue pequeno">{carpeta.folderId}</span></span>
                {carpeta.status === 'enabled' && (
                  <button type="button" className="boton peligro" onClick={async () => { if (await ejecutar(() => api.post(`/institution/drive-folders/${carpeta.id}/disable`))) carpetas.recargar(); }}>Deshabilitar</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
