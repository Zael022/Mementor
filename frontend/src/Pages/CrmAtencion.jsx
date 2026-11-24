import { Link } from 'react-router-dom';
import { CrmNav, FiltrosCrm, EstadoCargaCrm, useCrmFilters, etiquetaEtapa } from '../Componentes/Crm/Comun.jsx';
import { Paginacion } from '../Componentes/Estados.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { useDatos } from '../hooks/useDatos.js';

export default function CrmAtencion() {
  const filters = useCrmFilters(); const data = useDatos(`/crm/atencion?${filters.query}`);
  return <><h1>Atención de admisiones</h1><CrmNav /><p>Prioridad: 3 seguimientos vencidos; 2 revisión, falta de avance o activación; 1 citas próximas. Las citas futuras y la lista de espera no se marcan como abandono. Una nota no reinicia el tiempo de etapa.</p><FiltrosCrm filters={filters} /><EstadoCargaCrm recurso={data} />{data.datos?.length === 0 && <EstadoVacio titulo="Sin solicitudes que requieran atención" detalle="Los motivos se calculan con fechas e historial reales." />}<div className="crm-lista">{data.datos?.map((r) => <article className="tarjeta" key={r.id}><h2><Link to={`/admisiones/solicitudes/${r.id}`}>{r.prospect.name}</Link></h2><p>{etiquetaEtapa(r.stage)} · {r.status.replaceAll('_', ' ')}</p><ul>{r.reasons.map((reason) => <li key={reason.code}>Prioridad {reason.priority}: {reason.text}</li>)}</ul></article>)}</div><Paginacion meta={data.meta} pagina={Number(filters.params.get('page') || 1)} alCambiar={(p) => filters.set('page', p)} /></>;
}
