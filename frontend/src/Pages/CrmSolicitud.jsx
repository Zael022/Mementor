import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { Aviso, MensajeError } from '../Componentes/Estados.jsx';
import EnlaceInvitacion from '../Componentes/EnlaceInvitacion.jsx';
import { CrmNav, EstadoCargaCrm, ETAPAS, ETIQUETAS, etiquetaEtapa, fecha, iso } from '../Componentes/Crm/Comun.jsx';
import Dialogo from '../Componentes/Crm/Dialogo.jsx';
import Actividad, { actividadVacia, payloadActividad } from '../Componentes/Crm/Actividad.jsx';
import Borradores from '../Componentes/Crm/Borradores.jsx';
import PrivacidadCrm from '../Componentes/Crm/Privacidad.jsx';
import Historial from '../Componentes/Crm/Historial.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

function Seguimientos({ row, reload, users }) {
  const { usuario } = useSesion(); const send = useEnvio(); const [due, setDue] = useState(''); const [owner, setOwner] = useState(String(usuario.id)); const [note, setNote] = useState(''); const [results, setResults] = useState({});
  async function add(e) { e.preventDefault(); const r = await send.ejecutar(() => api.post(`/crm/solicitudes/${row.id}/seguimientos`, { versionEsperada: row.version, responsableId: Number(owner), vence: iso(due), tipo: 'contacto', nota: note })); if (r) { setNote(''); reload(); } }
  async function finish(f) { const r = await send.ejecutar(() => api.patch(`/crm/solicitudes/${row.id}/seguimientos/${f.id}`, { versionEsperada: row.version, resultado: results[f.id] || '' })); if (r) reload(); }
  return <section><h2>Seguimientos</h2><form className="tarjeta fila-formulario" onSubmit={add}><Campo etiqueta="Responsable del seguimiento" tipo="select" valor={owner} alCambiar={setOwner} opciones={users.map((u) => ({ valor: u.id, texto: u.displayName }))} /><Campo etiqueta="Próximo contacto" tipo="datetime-local" required valor={due} alCambiar={setDue} /><Campo etiqueta="Nota breve" maxLength={500} valor={note} alCambiar={setNote} /><button className="boton" disabled={send.enviando}>Programar seguimiento</button></form><ul>{row.followups.map((f) => <li key={f.id}>Responsable {f.responsibleId} · {fecha(f.dueAt)} · {f.status === 'pending' ? new Date(f.dueAt) < new Date() ? 'Pendiente vencido' : 'Pendiente' : 'Cerrado'} · {f.note} {f.result}{f.status === 'pending' && (usuario.role === 'institution_admin' || Number(f.responsibleId) === Number(usuario.id)) && <div className="fila-formulario"><Campo etiqueta={`Resultado del seguimiento ${f.id}`} valor={results[f.id] || ''} maxLength={300} alCambiar={(v) => setResults({ ...results, [f.id]: v })} /><button className="boton secundario" disabled={send.enviando} onClick={() => finish(f)}>Cerrar seguimiento</button></div>}</li>)}</ul><MensajeError error={send.error} /></section>;
}

function Ficha({ row, reload }) {
  const { usuario } = useSesion(); const admin = usuario.role === 'institution_admin'; const send = useEnvio();
  const people = useDatos(admin ? '/users?limit=100' : null); const users = admin ? (people.datos || []).filter((u) => ['teacher', 'institution_admin'].includes(u.role) && u.status === 'active') : [{ id: usuario.id, displayName: usuario.displayName }];
  const [dialog, setDialog] = useState(''); const [stage, setStage] = useState(ETAPAS[Math.min(ETAPAS.indexOf(row.stage) + 1, 7)]); const [reason, setReason] = useState(''); const [activity, setActivity] = useState(() => ({ ...actividadVacia(), tipo: admin ? 'campus' : 'entrevista' })); const [mode, setMode] = useState('nueva'); const [exceptional, setExceptional] = useState(false); const [owner, setOwner] = useState(row.responsibleId || ''); const [status, setStatus] = useState(row.status); const [invitation, setInvitation] = useState(null); const [notice, setNotice] = useState(''); const [exemption, setExemption] = useState(row.retentionException || '');
  const route = `/crm/solicitudes/${row.id}`;
  async function submit(e) {
    e.preventDefault(); let call;
    if (dialog === 'stage') call = () => api.patch(`/crm/prospectos/${row.prospectId}/etapa`, { solicitudId: Number(row.id), etapa: stage, versionEsperada: row.version, motivo: reason, ...(activity.programada || activity.resultado ? { actividad: payloadActividad(activity) } : {}) });
    if (dialog === 'activity') call = () => api.post(`${route}/actividades`, { versionEsperada: row.version, motivo: reason, actividad: payloadActividad(activity) });
    if (dialog === 'convert') call = () => api.post(`${route}/matricular`, { versionEsperada: row.version, modo: mode, motivo: reason, decisionConfirmada: true, excepcional: exceptional, ...(activity.resultado ? { actividad: payloadActividad(activity) } : {}) });
    const r = await send.ejecutar(call); if (r) { if (r.data.invitacion) setInvitation(r.data.invitacion); setDialog(''); setNotice(dialog === 'convert' ? `Matrícula confirmada: ${r.data.tipo}. ${r.data.activacionPendiente ? 'Activación de cuenta pendiente.' : ''}` : 'Cambio registrado con historial.'); reload(); }
  }
  async function manage(e) { e.preventDefault(); const r = await send.ejecutar(() => api.patch(route, { versionEsperada: row.version, responsableId: owner ? Number(owner) : null, ...(row.enrollmentId ? {} : { estado: status }), revisada: true, excepcionConservacion: exemption || null, motivo: reason })); if (r) { setNotice('Responsable, revisión y estado actualizados.'); reload(); } }
  return <><h1>{row.prospect.name}</h1><CrmNav /><p><Link to="/admisiones/candidatos">Volver a candidatos</Link></p><Aviso>{notice}</Aviso><EnlaceInvitacion invitacion={invitation} alCerrar={() => setInvitation(null)} />
    <section className="tarjeta"><h2>Solicitud {row.id} · {row.cycle.name}</h2><p>{row.prospect.email} · {row.prospect.phone || 'Sin teléfono'} · Procedencia: {row.prospect.origin}</p><dl className="crm-resumen"><dt>Etapa de admisión</dt><dd>{etiquetaEtapa(row.stage)}</dd><dt>Proceso</dt><dd>{row.status.replaceAll('_', ' ')}</dd><dt>Cuenta</dt><dd>{row.account ? row.account.status === 'invited' ? 'Invitada: activación pendiente' : row.account.status === 'active' ? 'Activa' : 'Deshabilitada' : 'Sin cuenta vinculada'}</dd><dt>Matrícula</dt><dd>{row.enrollment ? `${row.enrollment.status === 'active' ? 'Activa' : 'Retirada'} · ${row.conversionKind}` : 'Sin matrícula vinculada'}</dd><dt>Último avance</dt><dd>{fecha(row.lastStageChangedAt)}</dd><dt>Último contacto</dt><dd>{fecha(row.lastContactAt)}</dd><dt>Revisión</dt><dd>{fecha(row.reviewedAt)}</dd></dl>{row.enrollment && <Link className="boton secundario" to={`/admin/cursos/${row.enrollment.courseId}/matriculas`}>Abrir matrículas del aula</Link>}
      <div className="acciones">{admin && !row.enrollmentId && <><button className="boton" onClick={() => setDialog('stage')}>Mover a</button><button className="boton secundario" onClick={() => setDialog('convert')}>Confirmar matrícula</button></>}<button className="boton secundario" onClick={() => setDialog('activity')}>Registrar / reprogramar actividad</button></div>
    </section>
    {admin && <form className="tarjeta" onSubmit={manage}><h2>Asignación y revisión</h2><div className="fila-formulario"><Campo etiqueta="Responsable de solicitud" tipo="select" valor={owner} alCambiar={setOwner} opciones={[{ valor: '', texto: 'Sin asignar' }, ...users.map((u) => ({ valor: u.id, texto: u.displayName }))]} />{!row.enrollmentId && <Campo etiqueta="Estado del proceso" tipo="select" valor={status} alCambiar={setStatus} opciones={['activo', 'lista_de_espera', 'retirado', 'rechazado'].map((v) => ({ valor: v, texto: v.replaceAll('_', ' ') }))} />}<Campo etiqueta="Motivo de administración" required minLength={5} maxLength={500} valor={reason} alCambiar={setReason} /><Campo etiqueta="Excepción de conservación (si existe)" valor={exemption} alCambiar={setExemption} minLength={10} maxLength={300} /></div><button className="boton secundario" disabled={send.enviando}>Guardar y marcar revisada</button><MensajeError error={people.error} /></form>}
    <MensajeError error={send.error} />{send.error?.status === 409 && <button className="boton secundario" onClick={reload}>Actualizar ficha conservando el formulario</button>}
    <Seguimientos row={row} reload={reload} users={users} />
    <section className="tarjeta"><h2>Actividades registradas</h2>{Object.entries(row.activityJson).map(([k, a]) => <p key={k}>{k}: programada {fecha(a.programada)}, realizada {fecha(a.efectiva)}, resultado {a.resultado || 'Sin registrar'}, evidencia {a.evidencia || 'Sin registrar'}</p>)}</section>
    {admin && <><Borradores application={row} reload={reload} /><PrivacidadCrm application={row} reload={reload} /></>}
    <Historial key={`${row.id}-${row.version}`} applicationId={row.id} />
    {dialog && <Dialogo titulo={dialog === 'stage' ? 'Confirmar cambio de etapa' : dialog === 'convert' ? 'Confirmar matrícula y cuenta' : 'Registrar actividad con historial'} alCerrar={() => setDialog('')}><form onSubmit={submit}>
      {dialog === 'stage' && <><p>Se registrará un evento desde {etiquetaEtapa(row.stage)}. Los retrocesos conservan los eventos anteriores y requieren motivo. Estudiante se obtiene mediante matrícula.</p><Campo etiqueta="Etapa de destino" tipo="select" valor={stage} alCambiar={setStage} opciones={ETAPAS.slice(0, Math.min(ETAPAS.indexOf(row.stage) + 2, 8)).filter((s) => s !== row.stage).map((s) => ({ valor: s, texto: etiquetaEtapa(s) }))} /><p>Requisitos: Candidato exige revisión; Agenda exige fecha; Asiste exige asistencia; Prueba Técnica exige resultado y evidencia; Entrevista exige prueba aprobada y fecha; Admitido exige entrevista favorable; Semana de Prueba exige fecha.</p></>}
      {dialog === 'convert' && <><p>Se validará la decisión, el curso publicado y la institución. La operación vincula o invita la cuenta sin contraseña predeterminada y confirma todo en una transacción. Una invitación mantiene activación pendiente.</p><Campo etiqueta="Operación de matrícula" tipo="select" valor={mode} alCambiar={setMode} opciones={[{ valor: 'nueva', texto: 'Nueva matrícula' }, { valor: 'vincular', texto: 'Vincular matrícula activa existente' }, { valor: 'reintegrar', texto: 'Reintegrar matrícula retirada' }]} /><label><input type="checkbox" checked={exceptional} onChange={(e) => setExceptional(e.target.checked)} /> Vinculación excepcional de matrícula activa existente (sin acreditar actividades intermedias)</label><p>Para matrícula normal: registra Semana de Prueba completada, con fecha efectiva y evidencia.</p></>}
      <Actividad value={activity} set={setActivity} soloEntrevista={!admin} /><Campo etiqueta="Motivo de la operación" tipo="textarea" required minLength={5} maxLength={500} valor={reason} alCambiar={setReason} /><MensajeError error={send.error} /><button className="boton" disabled={send.enviando}>Confirmar operación</button>
    </form></Dialogo>}
  </>;
}

export default function CrmSolicitud() {
  const { id } = useParams(); const data = useDatos(`/crm/solicitudes/${id}`);
  return <><EstadoCargaCrm recurso={data} />{data.datos && <Ficha key={id} row={data.datos} reload={data.recargar} />}</>;
}
