// Indica que los datos se están cargando.
export function Cargando({ texto = 'Cargando…' }) {
  return (
    <p className="cargando" role="status">
      <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
      {texto}
    </p>
  );
}

// Muestra un error de forma accesible.
export function MensajeError({ error }) {
  if (!error) return null;
  return <p className="aviso error" role="alert">{error.message || String(error)}</p>;
}

// Muestra un aviso informativo o de éxito.
export function Aviso({ tipo = 'info', children }) {
  if (!children) return null;
  return <p className={`aviso ${tipo}`} role="status">{children}</p>;
}

// Etiqueta de estado con texto legible.
const ETIQUETAS = {
  draft: 'Borrador', published: 'Publicado', archived: 'Archivado', closed: 'Cerrada',
  upcoming: 'Próxima', live: 'En vivo', ended: 'Finalizada', cancelled: 'Cancelada',
  active: 'Activo', invited: 'Invitado', disabled: 'Deshabilitado', withdrawn: 'Retirado', inactive: 'Inactiva',
  pending: 'Pendiente', processing: 'Procesando', ready: 'Listo', error: 'Error', retired: 'Retirada', superseded: 'Reemplazada',
  not_indexed: 'Sin indexar', not_indexable: 'No indexable', idle: 'Al día', running: 'Sincronizando', interrupted: 'Interrumpida',
  enabled: 'Habilitada', creating: 'Creando', completed: 'Completada', rejected: 'Rechazada',
};

export function Insignia({ estado }) {
  return <span className={`insignia ${estado}`}>{ETIQUETAS[estado] || estado}</span>;
}

// Controles para cambiar de página en listas largas.
export function Paginacion({ meta, pagina, alCambiar }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="paginacion">
      <button type="button" className="boton secundario" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>Anterior</button>
      <span>Página {meta.page} de {meta.totalPages}</span>
      <button type="button" className="boton secundario" disabled={pagina >= meta.totalPages} onClick={() => alCambiar(pagina + 1)}>Siguiente</button>
    </div>
  );
}
