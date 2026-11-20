import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { gsap, useGSAP } from '../utils/gsap.js';

// React pinta siempre el estado final; GSAP solo anima «desde» un estado inicial.
// Si JavaScript falla o el movimiento está reducido, el contenido se ve completo.

// Muestra su contenido con una entrada suave cuando llega a la pantalla.
// Con «inmediato» entra al montarse (respuesta a una acción) y sigue pudiendo recibir el foco.
export function Revelar({ children, retraso = 0, etiqueta = 'div', className = '', inmediato = false }) {
  const Etiqueta = etiqueta;
  const referencia = useRef(null);

  useGSAP(() => {
    if (prefiereMenosMovimiento()) return;
    if (inmediato) {
      gsap.from(referencia.current, { opacity: 0, y: 12, duration: 0.4, delay: retraso, ease: 'power2.out', clearProps: 'opacity,transform' });
      return;
    }
    // Solo opacidad (sin «visibility»): el contenido sigue siendo alcanzable con el teclado antes de animarse.
    gsap.from(referencia.current, {
      opacity: 0, y: 20, duration: 0.6, delay: retraso, ease: 'power2.out', clearProps: 'opacity,transform',
      scrollTrigger: { trigger: referencia.current, start: 'top 92%', once: true },
    });
  }, { scope: referencia });

  return <Etiqueta ref={referencia} className={className || undefined}>{children}</Etiqueta>;
}

// Número que sube hasta su valor real; el lector de pantalla recibe solo el valor final.
export function Contador({ valor, sufijo = '', decimales = 0 }) {
  const numero = Number.isFinite(valor) ? valor : 0;
  const final = `${numero.toFixed(decimales)}${sufijo}`;
  const referencia = useRef(null);

  useGSAP(() => {
    const texto = referencia.current?.firstChild;
    if (!texto || prefiereMenosMovimiento() || !Number.isFinite(valor)) return;
    const estado = { actual: 0 };
    const pintar = () => { texto.nodeValue = `${estado.actual.toFixed(decimales)}${sufijo}`; };
    pintar();
    gsap.to(estado, {
      actual: numero, duration: 0.9, ease: 'power3.out', onUpdate: pintar,
      onComplete: () => { texto.nodeValue = final; },
      scrollTrigger: { trigger: referencia.current, start: 'top 95%', once: true },
    });
    return () => { texto.nodeValue = final; };
  }, { scope: referencia, dependencies: [valor, decimales, sufijo] });

  return (
    <span>
      <span ref={referencia} aria-hidden="true">{final}</span>
      <span className="solo-lector">{final}</span>
    </span>
  );
}

// Anillo que se llena según el porcentaje obtenido.
export function AnilloPuntaje({ porcentaje, aprobado }) {
  const referencia = useRef(null);
  const radio = 54;
  const largo = 2 * Math.PI * radio;
  const avance = largo * (1 - Math.min(100, Math.max(0, porcentaje)) / 100);

  useGSAP(() => {
    if (prefiereMenosMovimiento()) return;
    gsap.from(referencia.current.querySelector('.avance'), {
      attr: { 'stroke-dashoffset': largo }, duration: 1.2, ease: 'power2.out',
      scrollTrigger: { trigger: referencia.current, start: 'top 95%', once: true },
    });
  }, { scope: referencia, dependencies: [porcentaje] });

  return (
    <div ref={referencia} className={`anillo ${aprobado ? 'aprobado' : ''}`} role="img" aria-label={`Puntaje ${porcentaje} por ciento`}>
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <circle className="pista" cx="66" cy="66" r={radio} />
        <circle className="avance" cx="66" cy="66" r={radio} strokeDasharray={largo} strokeDashoffset={avance} />
      </svg>
      <strong aria-hidden="true"><Contador valor={porcentaje} sufijo=" %" /></strong>
    </div>
  );
}

// Tarjeta enlazada que se inclina siguiendo el cursor y sube al recibir el foco del teclado.
export function TarjetaInteractiva({ to, children, color }) {
  const referencia = useRef(null);
  const { contextSafe } = useGSAP({ scope: referencia });

  const mover = contextSafe((evento) => {
    const tarjeta = referencia.current;
    const caja = tarjeta.getBoundingClientRect();
    const x = (evento.clientX - caja.left) / caja.width;
    const y = (evento.clientY - caja.top) / caja.height;
    tarjeta.style.setProperty('--px', `${x * 100}%`);
    tarjeta.style.setProperty('--py', `${y * 100}%`);
    if (prefiereMenosMovimiento()) return;
    gsap.to(tarjeta, { rotationY: (x - 0.5) * 10, rotationX: (0.5 - y) * 10, y: -4, transformPerspective: 900, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
  });

  const subir = contextSafe(() => {
    if (prefiereMenosMovimiento()) return;
    gsap.to(referencia.current, { y: -4, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
  });

  const volver = contextSafe(() => {
    gsap.to(referencia.current, { rotationX: 0, rotationY: 0, y: 0, duration: prefiereMenosMovimiento() ? 0 : 0.3, ease: 'power2.out', overwrite: 'auto' });
  });

  return (
    <Link ref={referencia} className={`tarjeta tarjeta-enlace ${color ? 'tarjeta-clase' : ''}`} to={to}
      onMouseMove={mover} onMouseLeave={volver} onFocus={subir} onBlur={volver}
      style={color ? { '--color-clase': color } : undefined}>
      {children}
    </Link>
  );
}
