import { useDatos } from '../hooks/useDatos.js';
import { CrmNav, FiltrosCrm, EstadoCargaCrm, useCrmFilters, porcentaje, fecha, etiquetaEtapa } from '../Componentes/Crm/Comun.jsx';
import Campo from '../Componentes/Campo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';

export default function CrmPanel() {
  const filters = useCrmFilters();
  const report = useDatos(filters.params.get('convocatoriaId') ? `/crm/embudo?${filters.query}` : null);
  const trace = useDatos('/crm/trazabilidad?limit=20');
  return <><h1>Admisiones</h1><CrmNav /><FiltrosCrm filters={filters} fechas />
    <div className="fila-formulario"><Campo etiqueta="Fecha de corte (Costa Rica)" tipo="datetime-local" valor={filters.params.get('corte')?.slice(0, 16) || ''} alCambiar={(v) => filters.set('corte', v ? `${v}:00-06:00` : '')} /><Campo etiqueta="Versión de configuración" tipo="number" valor={filters.params.get('configuracionVersion') || ''} min="1" alCambiar={(v) => filters.set('configuracionVersion', v)} /></div>
    <EstadoCargaCrm recurso={report} />
    {!filters.params.get('convocatoriaId') && <EstadoVacio titulo="Selecciona una convocatoria" detalle="El embudo usa solicitudes reales y el historial registrado hasta la fecha de corte." />}
    {report.datos && <><p>Corte: {fecha(report.datos.cutoff)} · Actualización: {fecha(report.datos.generatedAt)} · Configuración {report.datos.configVersion}</p><p>{report.datos.cohort.applications} solicitudes. {report.datos.cohort.unit}. Las versiones de configuración se consultan por separado: {report.datos.availableVersions.join(', ')}.</p><p>Los porcentajes observados son provisionales. Sin conversión en plazo no significa abandono definitivo. {report.datos.expenseMessage}.</p>
      <div className="tabla-contenedor"><table><caption>Embudo histórico por transición; tiempos en días</caption><thead><tr><th>Etapa</th><th>Actuales / alcanzaron</th><th>Observada A/N</th><th>En plazo AM/M</th><th>Sin conversión en plazo</th><th>Meta / brecha madura</th><th>Pendientes vigente / vencido / espera</th><th>Ventanas abiertas / datos faltantes</th><th>Tiempo medio / mediana / espera</th><th>Cierres</th></tr></thead><tbody>{report.datos.stages.map((s) => <tr key={s.stage}><th scope="row">{s.label}</th><td>{s.current} / {s.N}</td><td>{porcentaje(s.observedPct)} {s.A !== null && `(${s.A}/${s.N})`}</td><td>{porcentaje(s.maturePct)} {s.M !== null && `(${s.AM}/${s.M}), ventana ${s.windowDays} días`}</td><td>{porcentaje(s.nonConversionPct)} {s.M > 0 && `(${s.M - s.AM}/${s.M})`}</td><td>{s.targetPct === null || s.targetPct === undefined ? 'Sin meta' : `${s.targetPct} %`} / {s.gapPoints == null ? 'Sin base comparable' : `${s.gapPoints.toFixed(2)} pp`}</td><td>{s.pendingInTime ?? '—'} / {s.pendingOverdue ?? '—'} / {s.waiting ?? '—'}</td><td>{s.openWindows ?? '—'} / {s.missingDates ?? '—'}</td><td>{[s.meanDays, s.medianDays, s.waitingMeanDays].map((v) => v == null ? '—' : v.toFixed(1)).join(' / ')}</td><td>{s.closures ? `Retirados ${s.closures.retirado}; rechazados ${s.closures.rechazado}` : `Nuevas ${s.conversionKinds.nueva}; vinculadas ${s.conversionKinds.vinculada}; reintegradas ${s.conversionKinds.reintegrada}`}</td></tr>)}</tbody></table></div></>}
    <h2>Trazabilidad sin datos de contacto</h2><EstadoCargaCrm recurso={trace} /><ul>{trace.datos?.map((e) => <li key={e.id}>Solicitud {e.applicationId}: {etiquetaEtapa(e.fromStage) || 'Inicio'} → {etiquetaEtapa(e.toStage)} · {fecha(e.effectiveAt)}</li>)}</ul>
  </>;
}
