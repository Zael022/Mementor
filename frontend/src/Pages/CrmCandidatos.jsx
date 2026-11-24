import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';
import { CrmNav, EstadoCargaCrm, FiltrosCrm, useCrmFilters, ETAPAS, ETIQUETAS, etiquetaEtapa, useCambiosPendientes } from '../Componentes/Crm/Comun.jsx';
import Campo from '../Componentes/Campo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { MensajeError, Paginacion } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

function Registro({ cycles, cycleId }) {
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '', procedencia: '', convocatoriaId: cycleId || '' });
  const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const send = useEnvio(); const navigate = useNavigate();
  const existing = useDatos(query ? `/crm/prospectos?buscar=${encodeURIComponent(query)}` : null);
  useCambiosPendientes(Boolean(form.nombre || form.correo));
  const change = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  async function register(e) { e.preventDefault(); const r = await send.ejecutar(() => api.post('/crm/prospectos', { ...form, convocatoriaId: Number(form.convocatoriaId) })); if (r) { setForm((f) => ({ ...f, nombre: '', correo: '' })); navigate(`/admisiones/solicitudes/${r.data.solicitudId}`); } }
  async function reuse(p) { const r = await send.ejecutar(() => api.post('/crm/solicitudes', { convocatoriaId: Number(form.convocatoriaId), prospectoId: Number(p.id) })); if (r) navigate(`/admisiones/solicitudes/${r.data.solicitudId}`); }
  return <details className="tarjeta"><summary>Registrar prospecto o reutilizar una ficha</summary><form onSubmit={register}><div className="fila-formulario"><Campo etiqueta="Convocatoria de registro" tipo="select" required valor={form.convocatoriaId} alCambiar={change('convocatoriaId')} opciones={[{ valor: '', texto: 'Selecciona' }, ...(cycles || []).filter((c) => c.status === 'open').map((c) => ({ valor: c.id, texto: c.name }))]} /><Campo etiqueta="Nombre del prospecto" required minLength={2} maxLength={120} valor={form.nombre} error={send.error?.details?.find((d) => d.field === "nombre")?.message} alCambiar={change('nombre')} /><Campo etiqueta="Correo del prospecto" tipo="email" required maxLength={190} valor={form.correo} error={send.error?.details?.find((d) => d.field === "correo")?.message} alCambiar={change('correo')} /><Campo etiqueta="Teléfono opcional" maxLength={30} valor={form.telefono} error={send.error?.details?.find((d) => d.field === "telefono")?.message} alCambiar={change('telefono')} /><Campo etiqueta="Procedencia" required maxLength={80} valor={form.procedencia} error={send.error?.details?.find((d) => d.field === "procedencia")?.message} alCambiar={change('procedencia')} /></div><button className="boton" disabled={send.enviando}>Crear ficha y solicitud</button></form>
    <form className="fila-formulario" onSubmit={(e) => { e.preventDefault(); setQuery(search); }}><Campo etiqueta="Buscar una ficha existente por nombre o correo" valor={search} alCambiar={setSearch} /><button className="boton secundario">Buscar ficha</button></form><EstadoCargaCrm recurso={existing} /><ul>{existing.datos?.map((p) => <li key={p.id}>{p.name} · {p.email} <button className="boton secundario" disabled={send.enviando || !form.convocatoriaId} onClick={() => reuse(p)}>Crear solicitud con esta ficha</button></li>)}</ul><MensajeError error={send.error} />
  </details>;
}

export default function CrmCandidatos() {
  const filters = useCrmFilters(); const { usuario } = useSesion(); const [board, setBoard] = useState(false); const [column, setColumn] = useState('prospecto');
  const [search, setSearch] = useState(''); const [searchQuery, setSearchQuery] = useState('');
  const data = useDatos(`/crm/solicitudes?${filters.query}${searchQuery ? `&buscar=${encodeURIComponent(searchQuery)}` : ''}`);
  const render = (r) => <article className="tarjeta crm-card" key={r.id}><h3><Link to={`/admisiones/solicitudes/${r.id}`}>{r.prospect.name}</Link></h3><p>{r.cycle.name} · {r.cycle.campus}</p><p>{etiquetaEtapa(r.stage)} · {r.status.replaceAll('_', ' ')}</p><Link className="boton secundario" to={`/admisiones/solicitudes/${r.id}`}>Abrir ficha / Mover a</Link></article>;
  return <><h1>Candidatos</h1><CrmNav /><FiltrosCrm filters={filters} etapas fechas /><form className="fila-formulario" onSubmit={(e) => { e.preventDefault(); setSearchQuery(search); }}><Campo etiqueta="Buscar solicitudes por nombre" valor={search} alCambiar={setSearch} /><button className="boton secundario">Buscar</button><Campo etiqueta="Procedencia del filtro" valor={filters.params.get('procedencia') || ''} alCambiar={(v) => filters.set('procedencia', v)} /><Campo etiqueta="ID del responsable" tipo="number" min="1" valor={filters.params.get('responsableId') || ''} alCambiar={(v) => filters.set('responsableId', v)} /></form>
    {usuario.role === 'institution_admin' && <Registro cycles={filters.cycles.datos} cycleId={filters.params.get('convocatoriaId')} />}
    <button className="boton secundario" aria-pressed={board} onClick={() => setBoard(!board)}>{board ? 'Ver lista accesible' : 'Ver tablero'}</button><EstadoCargaCrm recurso={data} />
    {data.datos?.length === 0 && <EstadoVacio titulo="No hay solicitudes" detalle="Registra una persona o cambia los filtros. No hay prospectos precargados." />}
    {board ? <><p>El tablero muestra la página actual. Todas las operaciones están disponibles en la ficha mediante teclado o toque.</p><div className="crm-selector-movil"><Campo etiqueta="Columna del tablero" tipo="select" valor={column} alCambiar={setColumn} opciones={ETAPAS.map((s, i) => ({ valor: s, texto: ETIQUETAS[i] }))} /></div><div className="crm-tablero">{ETAPAS.map((s, i) => <section key={s} className={`crm-columna ${s === column ? 'seleccionada' : ''}`}><h2>{ETIQUETAS[i]}</h2>{data.datos?.filter((r) => r.stage === s).map(render)}</section>)}</div></> : <div className="crm-lista">{data.datos?.map(render)}</div>}
    <Paginacion meta={data.meta} pagina={Number(filters.params.get('page') || 1)} alCambiar={(v) => filters.set('page', v)} />
  </>;
}
