import { useRef } from 'react';
import { mensajeRango } from '../utils/mensajesMascota.js';
import { useMascotasVisibles } from './Mascota.jsx';
import OrbiSticker from './OrbiSticker.jsx';
import './Recorrido.css';

const ESTRELLA = 'M20 6.5l3.9 8.3 9 1.1-6.6 6.2 1.7 8.9L20 26.6 12 31l1.7-8.9-6.6-6.2 9-1.1z';
const DESTELLO = 'M20 7c1 6.5 3.4 9.5 10 10.6-6.6 1.2-9 4.2-10 10.8-1-6.6-3.4-9.6-10-10.8 6.6-1.1 9-4.1 10-10.6z';

// Ícono de cada rango: crece la luz de un destello a una constelación (la forma cambia, no solo el color).
export function IconoRango({ nivel = 0, tamano = 40 }) {
  const comun = { fill: '#C5EF6A', stroke: '#181B3E', strokeWidth: 2.2, strokeLinejoin: 'round', strokeLinecap: 'round' };
  let dibujo;
  if (nivel <= 0) dibujo = <circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 4" />;
  else if (nivel === 1) dibujo = <path {...comun} d={DESTELLO} transform="translate(20 20) scale(0.95) translate(-20 -18)" />;
  else if (nivel === 2) dibujo = <><path {...comun} d={DESTELLO} transform="translate(-3 1)" /><path {...comun} d={DESTELLO} transform="translate(30 9) scale(0.42) translate(-20 -18)" /></>;
  else if (nivel === 3) {
    dibujo = (
      <>
        <path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M32 8l-3.5 3.5M11.5 28.5L8 32" stroke="#181B3E" strokeWidth="2.4" strokeLinecap="round" />
        <circle {...comun} cx="20" cy="20" r="8.5" />
      </>
    );
  } else if (nivel === 4) dibujo = <path {...comun} d={ESTRELLA} />;
  else {
    dibujo = (
      <>
        <path d="M10 27L20 12L31 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 3" />
        <path {...comun} d={ESTRELLA} transform="translate(10 27) scale(0.42) translate(-20 -19)" />
        <path {...comun} d={ESTRELLA} transform="translate(20 12) scale(0.5) translate(-20 -19)" />
        <path {...comun} d={ESTRELLA} transform="translate(31 22) scale(0.42) translate(-20 -19)" />
      </>
    );
  }
  return <svg className="icono-rango" viewBox="0 0 40 40" width={tamano} height={tamano} aria-hidden="true" focusable="false">{dibujo}</svg>;
}

// Rango de avance del curso: nombre, barra y lo que falta, siempre también como texto.
// «children» reemplaza la figura grande (por ejemplo, el sticker de Orbi) y deja el ícono junto al nombre.
export default function RangoAvance({ rango, variante = 'tarjeta', children }) {
  if (!rango) return null;
  const sinRango = !rango.total;
  return (
    <div className={`rango rango-${variante}`}>
      {children || <IconoRango nivel={rango.level} tamano={variante === 'tabla' ? 24 : 40} />}
      <div className="rango-texto">
        <p className="rango-nombre">
          {children && <IconoRango nivel={rango.level} tamano={26} />}
          <span className="solo-lector">Rango de avance: </span>
          <strong>{rango.name}</strong>
          {!sinRango && <span className="rango-porcentaje"> · {rango.percent} %</span>}
        </p>
        {!sinRango && variante !== 'tabla' && (
          // Dentro de una tarjeta enlazada la barra es una imagen con texto; fuera, una barra de progreso.
          <div className="barra-avance" {...(variante === 'tarjeta'
            ? { role: 'img', 'aria-label': `Avance del curso: ${rango.percent} por ciento` }
            : { role: 'progressbar', 'aria-label': 'Avance del curso', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': rango.percent, 'aria-valuetext': `${rango.percent} % del curso` })}>
            <div style={{ width: `${rango.percent}%` }} />
          </div>
        )}
        {variante !== 'tabla' && <p className="rango-falta">{mensajeRango(rango)}</p>}
        {variante === 'banner' && !sinRango && (
          <p className="rango-detalle">
            {rango.lessons.done} de {rango.lessons.total} lecciones
            {rango.assignments.total > 0 && ` · ${rango.assignments.done} de ${rango.assignments.total} tareas entregadas`}
          </p>
        )}
      </div>
    </div>
  );
}

// Rango del curso en el encabezado, con Orbi como calcomanía: se despega la esquina al pasar el mouse o con el foco.
export function RangoConSticker({ rango, alVerMapa }) {
  const mascotas = useMascotasVisibles();
  const sticker = useRef(null);
  const despegar = (evento) => {
    if (evento.type === 'focus' && evento.currentTarget.contains(evento.relatedTarget)) return;
    sticker.current?.despegar();
  };
  const soltar = (evento) => {
    if (evento.type === 'blur' && evento.currentTarget.contains(evento.relatedTarget)) return;
    sticker.current?.soltar();
  };
  if (!rango) return null;
  return (
    <section className="banner-rango" aria-label="Tu rango en este curso" onMouseEnter={despegar} onMouseLeave={soltar} onFocus={despegar} onBlur={soltar}>
      {/* Sin mascotas queda solo el ícono del rango (una vez, a la izquierda). */}
      {mascotas
        ? <RangoAvance rango={rango} variante="banner"><OrbiSticker ref={sticker} ancho={96} /></RangoAvance>
        : <RangoAvance rango={rango} variante="banner" />}
      {rango.total > 0 && (
        <a href="?seccion=trabajo&ver=lecciones" onClick={(evento) => { evento.preventDefault(); alVerMapa(); }}>Ver el mapa</a>
      )}
    </section>
  );
}
