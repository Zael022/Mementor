import { useState } from 'react';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, MensajeError, Paginacion } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';

// Muestra la bitácora de acciones sensibles.
export default function AdminAuditoria() {
  const [pagina, setPagina] = useState(1);
  const registros = useDatos(`/audit-logs?page=${pagina}&limit=25`);

  return (
    <>
      <h1>Auditoría</h1>
      <MensajeError error={registros.error} />
      {registros.cargando && <Cargando />}
      {registros.datos?.length === 0 && <EstadoVacio titulo="No hay eventos registrados" detalle="Aquí aparecerán las acciones sensibles a medida que ocurran." />}
      {registros.datos?.length > 0 && (
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Recurso</th></tr></thead>
            <tbody>
              {registros.datos.map((registro) => (
                <tr key={registro.id}>
                  <td>{new Date(registro.createdAt).toLocaleString()}</td>
                  <td>{registro.actor?.displayName || 'Sistema'}</td>
                  <td><code>{registro.action}</code></td>
                  <td>{registro.resourceType}{registro.resourceId ? ` #${registro.resourceId}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion meta={registros.meta} pagina={pagina} alCambiar={setPagina} />
    </>
  );
}
