import { useEffect, useState } from 'react';
import './crm.css';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useSesion } from '../../context/SesionContext.jsx';
import { useDatos } from '../../hooks/useDatos.js';
import Campo from '../Campo.jsx';
import { Cargando, MensajeError, Paginacion } from '../Estados.jsx';

export const ETAPAS = ['prospecto', 'candidato', 'agenda_campus_day', 'asiste_campus_day', 'prueba_tecnica', 'entrevista', 'admitido', 'semana_prueba', 'estudiante'];
export const ETIQUETAS = ['Prospecto', 'Candidato', 'Agenda Campus Day', 'Asiste Campus Day', 'Prueba Técnica', 'Entrevista', 'Admitido', 'Semana de Prueba', 'Estudiante'];
export const etiquetaEtapa = (s) => ETIQUETAS[ETAPAS.indexOf(s)] || s;
export const fecha = (v) => v ? new Date(v).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }) : 'No registrada';
export const iso = (v) => v ? new Date(v).toISOString() : undefined;
export const porcentaje = (v) => v === null || v === undefined ? 'Sin base de cálculo' : `${v.toFixed(2)} %`;

export function CrmNav() {
  const { usuario } = useSesion();
  const links = usuario.role === 'auditor' ? [['', 'Embudo']] : usuario.role === 'teacher' ? [['/candidatos', 'Mis solicitudes'], ['/atencion', 'Atención']] : [['', 'Embudo'], ['/candidatos', 'Candidatos'], ['/atencion', 'Atención'], ['/convocatorias', 'Convocatorias']];
  return <nav className="pestanas" aria-label="Admisiones">{links.map(([p, t]) => <NavLink key={p} end to={`/admisiones${p}`}>{t}</NavLink>)}</nav>;
}

export function useCrmFilters() {
  const [params, setParams] = useSearchParams();
  const [cyclesPage, setCyclesPage] = useState(1);
  const cycles = useDatos(`/crm/convocatorias?page=${cyclesPage}&limit=100`);
  const set = (key, value) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next); };
  return { params, set, cycles, cyclesPage, setCyclesPage, query: params.toString() };
}

export function FiltrosCrm({ filters, etapas = false, fechas = false }) {
  const { params, set, cycles } = filters;
  return <div className="tarjeta fila-formulario">
    <Campo etiqueta="Convocatoria" tipo="select" valor={params.get('convocatoriaId') || ''} alCambiar={(v) => set('convocatoriaId', v)} opciones={[{ valor: '', texto: 'Selecciona una convocatoria' }, ...(cycles.datos || []).map((c) => ({ valor: c.id, texto: `${c.name} · ${c.campus}` }))]} />
    {etapas && <Campo etiqueta="Etapa" tipo="select" valor={params.get('etapa') || ''} alCambiar={(v) => set('etapa', v)} opciones={[{ valor: '', texto: 'Todas' }, ...ETAPAS.map((s, i) => ({ valor: s, texto: ETIQUETAS[i] }))]} />}
    {etapas && <Campo etiqueta="Estado del filtro" tipo="select" valor={params.get('estado') || ''} alCambiar={(v) => set('estado', v)} opciones={[{ valor: '', texto: 'Todos' }, ...['activo', 'lista_de_espera', 'retirado', 'rechazado', 'matriculado'].map((v) => ({ valor: v, texto: v.replaceAll('_', ' ') }))]} />}
    <Campo etiqueta="Sede" valor={params.get('sede') || ''} alCambiar={(v) => set('sede', v)} />
    <Paginacion meta={cycles.meta} pagina={filters.cyclesPage} alCambiar={filters.setCyclesPage} />
    {fechas && <><Campo etiqueta="Cohorte desde" tipo="date" valor={params.get('desde')?.slice(0, 10) || ''} alCambiar={(v) => set('desde', v ? `${v}T00:00:00-06:00` : '')} /><Campo etiqueta="Cohorte hasta" tipo="date" valor={params.get('hasta')?.slice(0, 10) || ''} alCambiar={(v) => set('hasta', v ? `${v}T23:59:59-06:00` : '')} /></>}
  </div>;
}

export function EstadoCargaCrm({ recurso }) {
  return <>{recurso.cargando && <Cargando />}<MensajeError error={recurso.error} />{recurso.error && <button className="boton secundario" onClick={recurso.recargar}>Reintentar</button>}</>;
}

export function useCambiosPendientes(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const unload = (e) => { e.preventDefault(); e.returnValue = ''; };
    const links = (e) => { if (e.target.closest('a[href]') && !window.confirm('Hay cambios sin guardar. ¿Salir de esta pantalla?')) { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', links, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', links, true); };
  }, [dirty]);
}
