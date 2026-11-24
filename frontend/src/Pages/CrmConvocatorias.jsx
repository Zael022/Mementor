import { useState } from 'react';
import Campo from '../Componentes/Campo.jsx';
import { CrmNav, EstadoCargaCrm, ETIQUETAS, iso, useCambiosPendientes } from '../Componentes/Crm/Comun.jsx';
import { Aviso, MensajeError, Paginacion } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const initialConfig = () => ({ transiciones: Array.from({ length: 8 }, () => ({ ventanaDias: '', metaPct: null })), diasAlerta: '', conservacionCerradasDias: '', conservacionBorradoresDias: '', politica: '', politicaVersion: '', aprobacionConservacion: '' });

function Configuracion({ config, set }) {
  const change = (key, value) => set({ ...config, [key]: value });
  return <><fieldset><legend>Ventanas y metas de cada transición</legend>{config.transiciones.map((t, i) => <div className="fila-formulario" key={i}><strong>{ETIQUETAS[i]} → {ETIQUETAS[i + 1]}</strong><Campo etiqueta={`Ventana ${i + 1} (días)`} tipo="number" min="1" max="365" required valor={t.ventanaDias} alCambiar={(v) => change('transiciones', config.transiciones.map((x, n) => n === i ? { ...x, ventanaDias: Number(v) } : x))} /><Campo etiqueta={`Meta ${i + 1} (%) opcional`} tipo="number" min="0" max="100" step="0.1" valor={t.metaPct ?? ''} alCambiar={(v) => change('transiciones', config.transiciones.map((x, n) => n === i ? { ...x, metaPct: v === '' ? null : Number(v) } : x))} /></div>)}</fieldset>
    <div className="fila-formulario">{[['diasAlerta', 'Días sin avance para alerta'], ['conservacionCerradasDias', 'Conservación de contactos cerrados (días)'], ['conservacionBorradoresDias', 'Conservación de borradores (días)']].map(([key, label]) => <Campo key={key} etiqueta={label} tipo="number" min="1" max={key === 'diasAlerta' ? 365 : 3650} required valor={config[key]} alCambiar={(v) => change(key, Number(v))} />)}</div>
    <Campo etiqueta="Política autorizada de admisión" tipo="textarea" minLength={10} maxLength={4000} required valor={config.politica} alCambiar={(v) => change('politica', v)} ayuda="Incluye únicamente condiciones verificadas; no datos personales." />
    <Campo etiqueta="Versión de la política" required maxLength={40} valor={config.politicaVersion} alCambiar={(v) => change('politicaVersion', v)} />
    <Campo etiqueta="Referencia de aprobación institucional de conservación" required minLength={5} maxLength={200} valor={config.aprobacionConservacion} alCambiar={(v) => change('aprobacionConservacion', v)} ayuda="La institución decide los plazos por finalidad; no son un plazo legal universal." />
  </>;
}

export default function CrmConvocatorias() {
  const [page, setPage] = useState(1); const cycles = useDatos(`/crm/convocatorias?page=${page}&limit=20`); const courses = useDatos('/courses?limit=100');
  const [form, setForm] = useState({ courseId: '', nombre: '', sede: '', inicio: '', fin: '' });
  const [config, setConfig] = useState(initialConfig); const [editing, setEditing] = useState(null); const [dirty, setDirty] = useState(false); const [notice, setNotice] = useState('');
  const send = useEnvio(); useCambiosPendientes(dirty);
  const change = (k) => (v) => { setDirty(true); setForm((f) => ({ ...f, [k]: v })); };
  async function save(e) {
    e.preventDefault();
    const result = await send.ejecutar(() => editing ? api.patch(`/crm/convocatorias/${editing.id}`, { versionEsperada: editing.version, nombre: form.nombre, configuracion: config }) : api.post('/crm/convocatorias', { ...form, courseId: Number(form.courseId), inicio: iso(form.inicio), fin: iso(form.fin), configuracion: config }));
    if (result) { setDirty(false); setNotice('Convocatoria guardada. Las solicitudes existentes conservan su configuración histórica.'); setEditing(null); cycles.recargar(); }
  }
  function edit(c) { setEditing(c); setForm({ courseId: c.courseId, nombre: c.name, sede: c.campus, inicio: c.startsAt.slice(0, 16), fin: c.endsAt.slice(0, 16) }); setConfig(c.configJson); setDirty(false); }
  async function close(c) { if (window.confirm('Cerrar impide registrar nuevas solicitudes. El historial se conserva. ¿Continuar?')) { if (await send.ejecutar(() => api.patch(`/crm/convocatorias/${c.id}`, { versionEsperada: c.version, estado: c.status === 'open' ? 'closed' : 'open' }))) cycles.recargar(); } }
  return <><h1>Convocatorias</h1><CrmNav /><EstadoCargaCrm recurso={cycles} /><Aviso>{notice}</Aviso><ul>{cycles.datos?.map((c) => <li key={c.id}>{c.name} · {c.campus} · {c.status === 'open' ? 'Abierta' : 'Cerrada'} · versión {c.version} <button className="boton secundario" onClick={() => edit(c)}>Editar configuración</button> <button className="boton secundario" disabled={send.enviando} onClick={() => close(c)}>{c.status === 'open' ? 'Cerrar' : 'Reabrir'}</button></li>)}</ul>
    <Paginacion meta={cycles.meta} pagina={page} alCambiar={setPage} /><form className="tarjeta" onSubmit={save}><h2>{editing ? 'Editar convocatoria' : 'Nueva convocatoria'}</h2><div className="fila-formulario"><Campo etiqueta="Nombre" required minLength={3} maxLength={180} valor={form.nombre} error={send.error?.details?.find((d) => d.field === "nombre")?.message} alCambiar={change('nombre')} /><Campo etiqueta="Sede" required disabled={Boolean(editing)} valor={form.sede} error={send.error?.details?.find((d) => d.field === "sede")?.message} alCambiar={change('sede')} /><Campo etiqueta="Curso de destino" tipo="select" required disabled={Boolean(editing)} valor={form.courseId} error={send.error?.details?.find((d) => d.field === "courseId")?.message} alCambiar={change('courseId')} opciones={[{ valor: '', texto: 'Selecciona un curso' }, ...(courses.datos || []).filter((c) => c.status !== 'archived').map((c) => ({ valor: c.id, texto: c.title }))]} /><Campo etiqueta="Apertura" tipo="datetime-local" required disabled={Boolean(editing)} valor={form.inicio} alCambiar={change('inicio')} /><Campo etiqueta="Cierre" tipo="datetime-local" required disabled={Boolean(editing)} valor={form.fin} alCambiar={change('fin')} /></div>
      <Configuracion config={config} set={(v) => { setConfig(v); setDirty(true); }} /><MensajeError error={send.error || courses.error} /><button className="boton" disabled={send.enviando}>Guardar convocatoria</button>
    </form></>;
}
