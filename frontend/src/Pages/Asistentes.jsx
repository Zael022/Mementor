import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import Icono from '../Componentes/Iconos.jsx';
import IconoAsistente from '../Componentes/IconoAsistente.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { ASISTENTES_CON_PAGINA, estiloDe, rutaAsistente } from '../utils/asistentesVisual.js';
import { fechaHora } from '../utils/fechas.js';

// Botón de cada tarjeta: abre la página del asistente en otra pestaña, o la sección donde se usa.
function AccionAgente({ item, enlaceTutor, hayCursos }) {
  if (item.key === 'admissions_writer') return <Link className="boton secundario" to="/admisiones/candidatos">Abrir admisiones</Link>;
  if (item.link) {
    return enlaceTutor && hayCursos
      ? <Link className="boton secundario" to={enlaceTutor}>Abrir el tutor</Link>
      : <span className="tenue pequeno">Ábrelo desde un curso.</span>;
  }
  if (!ASISTENTES_CON_PAGINA.includes(item.key)) return null;
  return (
    <Link className="boton agente-boton" to={rutaAsistente(item.key)} target="_blank" rel="noopener">
      Usar <IconoAsistente nombre="externo" tamano={16} />
      <span className="solo-lector"> {item.name} (se abre en otra pestaña)</span>
    </Link>
  );
}

// Chip de color con el ícono y el nombre del asistente (historial).
function ChipAgente({ clave, nombre }) {
  const estilo = estiloDe(clave);
  return (
    <span className={`chip-agente acento-${estilo.color}`}>
      <span className="agente-icono"><IconoAsistente nombre={estilo.icono} tamano={14} /></span>
      {nombre}
    </span>
  );
}

// Asistentes de IA disponibles para el rol y el historial de uso propio.
export default function Asistentes() {
  const { usuario } = useSesion();
  const catalogo = useDatos('/agents');
  const cursos = useDatos(usuario.role === 'auditor' ? null : '/courses?limit=100');
  const historial = useDatos('/agents/runs');
  const recargarHistorial = historial.recargar;

  // Al volver de la pestaña de un asistente, el historial se pone al día.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') recargarHistorial(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [recargarHistorial]);

  if (catalogo.cargando && !catalogo.datos) return <Cargando texto="Cargando los asistentes…" forma="tarjetas" />;
  if (catalogo.error) return <MensajeError error={catalogo.error} />;

  const enlaceTutor = (item) => item.link?.[usuario.role]?.replace(':courseId', cursos.datos?.[0]?.id ?? '');
  const usosTotales = historial.datos?.length ?? 0;

  return (
    <>
      <header className="asistentes-hero acento-violeta">
        <div>
          <h1>Asistentes de IA</h1>
          <p>Cada asistente usa solo la información que tu rol puede ver y deja registro de su uso. Las respuestas son borradores: revísalas antes de usarlas.</p>
          <ul className="asistentes-datos">
            <li className="acento-violeta">{catalogo.datos.length} {catalogo.datos.length === 1 ? 'asistente' : 'asistentes'} para tu rol</li>
            <li className="acento-turquesa">{usosTotales} {usosTotales === 1 ? 'uso registrado' : 'usos registrados'}</li>
            <li className="acento-naranja">Se abren en otra pestaña</li>
          </ul>
        </div>
        <div className="asistentes-burbujas" aria-hidden="true">
          {catalogo.datos.slice(0, 6).map((item) => {
            const estilo = estiloDe(item.key);
            return <span key={item.key} className={`agente-icono acento-${estilo.color}`}><IconoAsistente nombre={estilo.icono} tamano={24} /></span>;
          })}
        </div>
      </header>

      <div className="rejilla rejilla-agentes">
        {catalogo.datos.map((item) => {
          const estilo = estiloDe(item.key);
          return (
            <article key={item.key} className={`tarjeta tarjeta-agente acento-${estilo.color}`}>
              <div className="agente-cabecera">
                <span className="agente-icono"><IconoAsistente nombre={estilo.icono} tamano={24} /></span>
                <span className="agente-categoria">{estilo.categoria}</span>
              </div>
              <h3>{item.name}</h3>
              <p>{item.purpose}</p>
              <p className="agente-privacidad"><Icono nombre="privacidad" tamano={16} /><span>{item.privacy}</span></p>
              <AccionAgente item={item} enlaceTutor={enlaceTutor(item)} hayCursos={Boolean(cursos.datos?.length)} />
            </article>
          );
        })}
      </div>

      <h2>Mi historial de uso</h2>
      {historial.datos?.length === 0 && <p className="tenue">Todavía no has usado ningún asistente.</p>}
      {historial.datos?.length > 0 && (
        <div className="tabla-desplazable">
          <table className="tabla">
            <thead><tr><th scope="col">Fecha</th><th scope="col">Asistente</th><th scope="col">Resultado</th><th scope="col">Tokens</th><th scope="col">Tiempo</th></tr></thead>
            <tbody>
              {historial.datos.slice(0, 20).map((fila) => (
                <tr key={fila.id}>
                  <td>{fechaHora(fila.createdAt)}</td>
                  <td><ChipAgente clave={fila.agent} nombre={fila.name} /></td>
                  <td><Insignia estado={fila.status} /></td>
                  <td>{fila.inputTokens ?? '—'} / {fila.outputTokens ?? '—'}</td>
                  <td>{fila.latencyMs ? `${(fila.latencyMs / 1000).toFixed(1)} s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
