import { useState } from 'react';
import { useDatos } from '../../hooks/useDatos.js';
import { EstadoCargaCrm, etiquetaEtapa, fecha } from './Comun.jsx';
import { Paginacion } from '../Estados.jsx';

export default function Historial({ applicationId }) {
  const [page, setPage] = useState(1); const history = useDatos(`/crm/solicitudes/${applicationId}/historial?page=${page}&limit=50`);
  const kinds = { initial: 'Registro', advance: 'Avance', correction: 'Corrección', activity: 'Actividad o reprogramación', administration: 'Revisión o asignación', enrollment: 'Matrícula', exceptional_link: 'Vinculación excepcional', origin_correction: 'Corrección de procedencia', privacy: 'Privacidad' };
  return <section><h2>Historial cronológico</h2><EstadoCargaCrm recurso={history} /><ol>{history.datos?.map((event) => {
    const meta = event.metadataJson || {}; const activity = meta.actividad || (meta.tipo ? meta : null);
    return <li key={event.id}><p>{fecha(event.effectiveAt)} · {etiquetaEtapa(event.fromStage) || 'Inicio'} → {etiquetaEtapa(event.toStage)} · {kinds[event.kind] || 'Registro'} · {event.reason}<small> Registrado: {fecha(event.recordedAt)} · persona responsable {event.actorId || 'Sistema'}</small></p>{activity && <p>Actividad: {activity.tipo} · Programada: {fecha(activity.programada)} · Realizada: {fecha(activity.efectiva)} · Resultado: {activity.resultado?.replaceAll('_', ' ') || 'Sin registrar'} · Evidencia: {activity.evidencia || 'Sin registrar'}</p>}{meta.status && <p>Estado: {meta.status.replaceAll('_', ' ')}</p>}{meta.kind && <p>Matrícula: {meta.kind}</p>}{meta.previousOrigin && <p>Procedencia anterior: {meta.previousOrigin} · Corrección: {meta.newOrigin}</p>}</li>;
  })}</ol><Paginacion meta={history.meta} pagina={page} alCambiar={setPage} /></section>;
}
