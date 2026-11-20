import { useState } from 'react';
import { Link } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { colorDeCurso } from '../utils/cursos.js';

const DIA_MS = 24 * 3600 * 1000;

// Lunes a las 00:00 de la semana que contiene la fecha.
function inicioDeSemana(fecha) {
  const lunes = new Date(fecha);
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return lunes;
}

const mismoDia = (a, b) => a.toDateString() === b.toDateString();

// Enlace de cada evento según el rol.
function enlaceDe(item, rol) {
  if (item.type === 'admission') return `/admisiones/solicitudes/${item.applicationId}`;
  if (item.type === 'assignment') return rol === 'student' ? `/estudiante/tareas/${item.id}` : `${rol === 'teacher' ? '/docente' : '/admin'}/cursos/${item.courseId}/tareas`;
  return rol === 'student' ? `/estudiante/cursos/${item.courseId}?seccion=trabajo&ver=clases` : `${rol === 'teacher' ? '/docente' : '/admin'}/cursos/${item.courseId}/clases`;
}

// Calendario semanal con entregas de tareas y clases en vivo de todas las clases.
export default function Calendario() {
  const { usuario } = useSesion();
  const [lunes, setLunes] = useState(() => inicioDeSemana(new Date()));
  const [curso, setCurso] = useState('');
  const domingo = new Date(lunes.getTime() + 7 * DIA_MS);
  const ruta = `/me/calendar?from=${lunes.toISOString()}&to=${domingo.toISOString()}${curso ? `&courseId=${curso}` : ''}`;
  const calendario = useDatos(ruta);
  // Feriados de Costa Rica (API externa consultada por el backend); si falla, el calendario sigue funcionando.
  const feriados = useDatos(`/indicators/holidays?year=${lunes.getFullYear()}`);
  const feriadosFin = useDatos(domingo.getFullYear() !== lunes.getFullYear() ? `/indicators/holidays?year=${domingo.getFullYear()}` : null);
  const listaFeriados = [...(feriados.datos || []), ...(feriadosFin.datos || [])];
  const fechaLocal = (dia) => `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
  // Lista de clases para el filtro.
  const cursos = useDatos('/courses?limit=100');
  const opciones = cursos.datos || [];

  const dias = Array.from({ length: 7 }, (_, indice) => new Date(lunes.getTime() + indice * DIA_MS));
  const hoy = new Date();
  const rango = `${dias[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} al ${dias[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <>
      <div className="calendario-barra">
        <h1>Calendario</h1>
        <Campo etiqueta="Clase" tipo="select" valor={curso} alCambiar={setCurso}
          opciones={[{ valor: '', texto: 'Todas las clases' }, ...opciones.map((item) => ({ valor: item.id, texto: item.title }))]} />
        <div className="calendario-navegar">
          <button type="button" className="boton secundario" aria-label="Semana anterior" onClick={() => setLunes(new Date(lunes.getTime() - 7 * DIA_MS))}>‹</button>
          <span aria-live="polite">Del {rango}</span>
          <button type="button" className="boton secundario" aria-label="Semana siguiente" onClick={() => setLunes(new Date(lunes.getTime() + 7 * DIA_MS))}>›</button>
          <button type="button" className="boton-texto" onClick={() => setLunes(inicioDeSemana(new Date()))}>Hoy</button>
        </div>
      </div>
      <MensajeError error={calendario.error} />
      {calendario.cargando && !calendario.datos && <Cargando />}
      <div className="calendario-semana">
        {dias.map((dia) => {
          const eventos = (calendario.datos?.items || []).filter((item) => mismoDia(new Date(item.at), dia));
          return (
            <section key={dia.toISOString()} className={`calendario-dia ${mismoDia(dia, hoy) ? 'hoy' : ''}`} aria-label={dia.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}>
              <header>
                {listaFeriados.filter((item) => item.date === fechaLocal(dia)).map((item) => <span key={item.name} className="feriado">{item.name}</span>)}
                <span className="dia-nombre">{dia.toLocaleDateString('es', { weekday: 'short' })}</span>
                <span className="dia-numero">{dia.getDate()}</span>
              </header>
              <ul>
                {eventos.map((item) => (
                  <li key={`${item.type}-${item.id}`} style={{ '--color-clase': colorDeCurso(item.courseId) }} className={`evento ${item.type}`}>
                    <Link to={enlaceDe(item, usuario.role)}>
                      <span className="evento-hora">{new Date(item.at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="evento-titulo">{item.type === 'session' ? 'Clase: ' : ''}{item.title}{item.draft ? ' (borrador)' : ''}</span>
                      <span className="evento-curso">{item.courseTitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {calendario.datos?.items.length === 0 && <p className="tenue">No hay entregas ni clases en vivo esta semana.</p>}
    </>
  );
}
