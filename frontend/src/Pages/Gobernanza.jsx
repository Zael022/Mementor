import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { fechaHora } from '../utils/fechas.js';
import { NOMBRE_DOCUMENTO } from '../utils/legal.js';

const NOTIFICACION = { sent: 'Enviada', not_configured: 'Correo no configurado', failed: 'Falló el envío' };

// Gobernanza de datos para administración y auditoría (solo lectura).
export default function Gobernanza() {
  const solicitudes = useDatos('/governance/deletion-requests');
  const consentimientos = useDatos('/governance/consents');

  return (
    <>
      <h1>Gobernanza de datos</h1>
      <p className="tenue">Vista de solo lectura de las aceptaciones de documentos y de las solicitudes de baja (Ley N.º 8968).</p>

      <h2>Aceptación de documentos</h2>
      <MensajeError error={consentimientos.error} />
      {consentimientos.cargando && !consentimientos.datos && <Cargando />}
      {consentimientos.datos && (
        <table className="tabla">
          <thead><tr><th scope="col">Documento</th><th scope="col">Versión</th><th scope="col">Aceptaciones</th></tr></thead>
          <tbody>
            {consentimientos.datos.accepted.map((fila) => (
              <tr key={`${fila.document}-${fila.version}`}>
                <td>{NOMBRE_DOCUMENTO[fila.document]}</td>
                <td>{fila.version}{fila.version === consentimientos.datos.current[fila.document] ? ' (vigente)' : ''}</td>
                <td>{fila.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Solicitudes de baja</h2>
      <MensajeError error={solicitudes.error} />
      {solicitudes.datos?.length === 0 && <EstadoVacio ilustracion="busqueda" titulo="No hay solicitudes de baja" />}
      {solicitudes.datos?.length > 0 && (
        <div className="tabla-desplazable">
          <table className="tabla">
            <thead><tr><th scope="col">N.º</th><th scope="col">Estado</th><th scope="col">Solicitada</th><th scope="col">Procesada</th><th scope="col">Vía</th><th scope="col">Aviso</th></tr></thead>
            <tbody>
              {solicitudes.datos.map((fila) => (
                <tr key={fila.id}>
                  <td>{fila.id}</td>
                  <td><Insignia estado={fila.status} /></td>
                  <td>{fechaHora(fila.createdAt)}</td>
                  <td>{fila.processedAt ? fechaHora(fila.processedAt) : '—'}</td>
                  <td>{fila.processedVia || '—'}</td>
                  <td>{NOTIFICACION[fila.notificationStatus] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
