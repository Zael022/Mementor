import { Link } from 'react-router-dom';
import { prefiereMenosMovimiento, useConteo, useEnPantalla } from '../hooks/useMovimiento.js';

// Muestra su contenido con una transición al entrar en pantalla.
export function Revelar({ children, retraso = 0, etiqueta = 'div', className = '' }) {
  const Etiqueta = etiqueta;
  const [referencia, visible] = useEnPantalla();
  return (
    <Etiqueta ref={referencia} className={`revelar ${visible ? 'visible' : ''} ${className}`} style={{ '--retraso': `${retraso}s` }}>
      {children}
    </Etiqueta>
  );
}

// Número que sube hasta su valor real cuando se vuelve visible.
export function Contador({ valor, sufijo = '', decimales = 0 }) {
  const [referencia, visible] = useEnPantalla();
  const actual = useConteo(valor, visible);
  return <span ref={referencia}>{actual.toFixed(decimales)}{sufijo}</span>;
}

// Anillo que se llena según el porcentaje obtenido.
export function AnilloPuntaje({ porcentaje, aprobado }) {
  const [referencia, visible] = useEnPantalla();
  const radio = 54;
  const largo = 2 * Math.PI * radio;
  const avance = visible ? largo * (1 - Math.min(100, Math.max(0, porcentaje)) / 100) : largo;
  return (
    <div ref={referencia} className={`anillo ${aprobado ? 'aprobado' : ''}`} role="img" aria-label={`Puntaje ${porcentaje} por ciento`}>
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <circle className="pista" cx="66" cy="66" r={radio} />
        <circle className="avance" cx="66" cy="66" r={radio} strokeDasharray={largo} strokeDashoffset={avance} />
      </svg>
      <strong><Contador valor={porcentaje} sufijo=" %" /></strong>
    </div>
  );
}

// Tarjeta enlazada que se inclina y se ilumina siguiendo el cursor.
export function TarjetaInteractiva({ to, children, color }) {
  function mover(evento) {
    if (prefiereMenosMovimiento()) return;
    const caja = evento.currentTarget.getBoundingClientRect();
    const x = (evento.clientX - caja.left) / caja.width;
    const y = (evento.clientY - caja.top) / caja.height;
    evento.currentTarget.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
    evento.currentTarget.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
    evento.currentTarget.style.setProperty('--px', `${x * 100}%`);
    evento.currentTarget.style.setProperty('--py', `${y * 100}%`);
  }

  function salir(evento) {
    evento.currentTarget.style.setProperty('--ry', '0deg');
    evento.currentTarget.style.setProperty('--rx', '0deg');
  }

  return (
    <Link className={`tarjeta tarjeta-enlace ${color ? 'tarjeta-clase' : ''}`} to={to} onMouseMove={mover} onMouseLeave={salir}
      style={color ? { '--color-clase': color } : undefined}>
      {children}
    </Link>
  );
}
