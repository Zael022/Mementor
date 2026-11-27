import { useRef } from 'react';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { gsap, useGSAP } from '../utils/gsap.js';
import { useMascotaViva } from '../hooks/useMascotaViva.js';

// Pausa, la mascota de bienestar (docs/marca/mascotas/pausa.svg): «aprende a tu ritmo».
// Cada estado cambia partes del mismo dibujo: brazo derecho, ojos, boca y accesorios.
export const ESTADOS_PAUSA = ['bienvenida', 'leyendo', 'dormido'];
// Expresiones de Pausa paseante (Parte A): curiosidad, molestia en dos grados, cara tapada, caricia y bostezo.
export const ESTADOS_PAUSA_PASEANTE = ['curioso', 'molesto', 'enojado', 'tapado', 'feliz', 'bostezo'];
const TODOS_LOS_ESTADOS = [...ESTADOS_PAUSA, ...ESTADOS_PAUSA_PASEANTE];
export const VISTA_PAUSA = '362 30 276 215';
// Sin rama: el dibujo empieza en las garras, para colgarse de un borde de la página.
const VISTA_SIN_RAMA = '362 36 276 209';

const TINTA = '#181B3E';
const GRIS = '#6B7494';
const GRIS_CLARO = '#A9B1CF';
const LIMA = '#C5EF6A';
const NARANJA = '#F0591A';
const CIELO = '#EAEEFF';
const CAFE = '#8A5A3B';
const AZUL = '#3452E1';

// Brazo derecho: colgado de la rama, saludando o sosteniendo el libro.
function BrazoDerecho({ estado }) {
  if (estado === 'bienvenida') {
    return (
      <g data-parte="brazo-libre">
        <path d="M524 130 q28 -2 40 -28" fill="none" strokeWidth="24" />
        <path d="M524 130 q28 -2 40 -28" fill="none" stroke={GRIS} strokeWidth="16" />
        <circle cx="565" cy="100" r="9" fill={GRIS} />
        <path d="M558 92 q1 -8 7 -7 M566 90 q3 -7 9 -4 M572 96 q5 -5 9 0" fill="none" strokeWidth="3" />
      </g>
    );
  }
  if (estado === 'leyendo') {
    return (
      <g data-parte="brazo-libre">
        <path d="M524 130 q20 18 6 44" fill="none" strokeWidth="24" />
        <path d="M524 130 q20 18 6 44" fill="none" stroke={GRIS} strokeWidth="16" />
      </g>
    );
  }
  // Molestia fuerte: el brazo cruzado sobre la barriga.
  if (estado === 'enojado') {
    return (
      <g data-parte="brazo-libre">
        <path d="M526 132 q4 34 -44 40" fill="none" strokeWidth="24" />
        <path d="M526 132 q4 34 -44 40" fill="none" stroke={GRIS} strokeWidth="16" />
        <ellipse cx="478" cy="172" rx="10" ry="8" fill={GRIS} />
      </g>
    );
  }
  // Se tapa los ojos con la mano.
  if (estado === 'tapado') {
    return (
      <g data-parte="brazo-libre">
        <path d="M526 132 q22 -10 2 -16" fill="none" strokeWidth="24" />
        <path d="M526 132 q22 -10 2 -16" fill="none" stroke={GRIS} strokeWidth="16" />
        <ellipse cx="492" cy="118" rx="34" ry="13" fill={GRIS} />
        <path d="M466 112 q-2 8 4 12 M478 108 q-2 10 3 15 M492 107 q-1 10 3 15" fill="none" strokeWidth="3" />
      </g>
    );
  }
  return (
    <g data-parte="brazo-libre">
      <path d="M524 128 q20 -30 14 -66" fill="none" strokeWidth="24" />
      <path d="M524 128 q20 -30 14 -66" fill="none" stroke={GRIS} strokeWidth="16" />
    </g>
  );
}

function Ojos({ estado }) {
  // Feliz (caricia): ojos cerrados como arcos hacia arriba.
  if (estado === 'feliz') {
    return (
      <g fill="none" stroke="#fff" strokeWidth="3">
        <path d="M467 123 q7 -8 14 0" />
        <path d="M499 123 q7 -8 14 0" />
      </g>
    );
  }
  if (estado === 'dormido' || estado === 'bostezo') {
    return (
      <g fill="none" stroke={CIELO} strokeWidth="2.5">
        <path d="M467 121 q6 5 12 0" />
        <path d="M501 121 q6 5 12 0" />
      </g>
    );
  }
  // Leyendo: la mirada baja hacia el libro. Curioso: ojos más abiertos.
  const dy = estado === 'leyendo' ? 1.5 : 0;
  const blanco = estado === 'curioso' ? 5 : 4;
  const molesto = estado === 'molesto' || estado === 'enojado';
  return (
    <g data-parte="parpados">
      <circle cx="474" cy={119 + dy} r={blanco} fill="#fff" stroke="none" />
      <circle cx="506" cy={119 + dy} r={blanco} fill="#fff" stroke="none" />
      <g data-parte="pupilas">
        <circle cx="475" cy={120 + dy * 1.4} r={estado === 'curioso' ? 2.6 : 2} fill={TINTA} stroke="none" />
        <circle cx="505" cy={120 + dy * 1.4} r={estado === 'curioso' ? 2.6 : 2} fill={TINTA} stroke="none" />
      </g>
      {/* Molestia: párpados a media altura y cejas inclinadas hacia el centro. */}
      {molesto && (
        <g data-parte="cejas">
          <path d="M468 116 h12 M500 116 h12" fill="none" stroke={TINTA} strokeWidth="3.5" />
          <path d={estado === 'enojado' ? 'M465 104 l15 6 M515 104 l-15 6' : 'M466 107 l13 3 M514 107 l-13 3'} fill="none" stroke={TINTA} strokeWidth="3" />
        </g>
      )}
    </g>
  );
}

function Boca({ estado }) {
  if (estado === 'bienvenida' || estado === 'curioso') return <path d="M480 139 q10 11 20 0 z" fill={TINTA} />;
  if (estado === 'dormido') return <path d="M485 141 q5 3 10 0" fill="none" strokeWidth="3" />;
  if (estado === 'bostezo') return <ellipse cx="490" cy="143" rx="6" ry="8" fill={TINTA} />;
  if (estado === 'feliz') return <path d="M479 138 q11 12 22 0" fill="none" strokeWidth="3" />;
  if (estado === 'molesto') return <path d="M482 142 h16" fill="none" strokeWidth="3" />;
  if (estado === 'enojado') return <path d="M481 145 q9 -8 18 0" fill="none" strokeWidth="3" />;
  return <path d="M481 140 q9 8 18 0" fill="none" strokeWidth="3" />;
}

// Libro abierto sobre la barriga (solo al leer).
function Libro() {
  return (
    <g data-parte="libro">
      <path d="M458 168 l32 8 l32 -8 v30 l-32 8 l-32 -8 z" fill={AZUL} />
      <path d="M462 166 l28 7 v28 l-28 -7 z" fill={CIELO} />
      <path d="M490 173 l28 -7 v28 l-28 7 z" fill={CIELO} />
      <path d="M467 175 l18 4 M467 183 l18 4 M495 179 l18 -4 M495 187 l18 -4" fill="none" stroke={GRIS_CLARO} strokeWidth="2" />
      <circle cx="530" cy="174" r="9" fill={GRIS} />
    </g>
  );
}

// «z» suaves de dormir, dibujadas con trazos para no depender de la tipografía.
function Zetas() {
  return (
    <g data-parte="zetas" fill="none" stroke={GRIS} strokeWidth="2.5">
      <path data-parte="z" d="M550 118 h9 l-9 10 h9" />
      <path data-parte="z" d="M566 100 h12 l-12 13 h12" />
      <path data-parte="z" d="M584 80 h14 l-14 15 h14" />
    </g>
  );
}

// Dibujo completo de Pausa. Con «rama» en falso se cuelga de lo que tenga encima (por ejemplo, la barra superior).
export function DibujoPausa({ estado = 'leyendo', rama = true }) {
  return (
    <g data-parte="pausa" stroke={TINTA} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
      {rama && <g data-parte="rama">
        <path d="M378 62 q120 -14 246 6" fill="none" strokeWidth="16" />
        <path d="M378 62 q120 -14 246 6" fill="none" stroke={CAFE} strokeWidth="9" />
        <ellipse cx="396" cy="48" rx="16" ry="8" fill={LIMA} transform="rotate(-25 396 48)" />
        <ellipse cx="604" cy="52" rx="16" ry="8" fill={LIMA} transform="rotate(25 604 52)" />
        <ellipse cx="582" cy="76" rx="12" ry="6" fill={LIMA} transform="rotate(40 582 76)" />
      </g>}
      {/* Todo lo que cuelga se mueve junto: el reposo balancea «colgado» y el toque, «colgado-toque». */}
      <g data-parte="colgado-toque"><g data-parte="colgado">
      <g data-parte="brazo-rama">
        <path d="M456 128 q-20 -30 -14 -66" fill="none" strokeWidth="24" />
        <path d="M456 128 q-20 -30 -14 -66" fill="none" stroke={GRIS} strokeWidth="16" />
      </g>
      {/* El brazo cruzado y la mano que tapa la cara van encima del cuerpo y de la cabeza. */}
      {!['leyendo', 'enojado', 'tapado'].includes(estado) && <BrazoDerecho estado={estado} />}
      <ellipse cx="468" cy="226" rx="13" ry="10" fill={GRIS} />
      <ellipse cx="512" cy="226" rx="13" ry="10" fill={GRIS} />
      <ellipse cx="490" cy="176" rx="52" ry="54" fill={GRIS} />
      <ellipse cx="490" cy="192" rx="30" ry="30" fill={GRIS_CLARO} stroke="none" />
      <g data-parte="bufanda">
        <path d="M450 150 q40 22 80 0 l-4 14 q-36 18 -72 0 z" fill={LIMA} />
        <path d="M512 160 l8 30 l-14 2 z" fill={LIMA} />
      </g>
      {estado === 'leyendo' && <><Libro /><BrazoDerecho estado={estado} /></>}
      {estado === 'enojado' && <BrazoDerecho estado={estado} />}
      <g data-parte="cabeza">
        <circle cx="490" cy="118" r="44" fill={GRIS} />
        <path d="M480 76 q4 -10 10 -2 q6 -8 10 2" fill="none" strokeWidth="3" />
        <ellipse cx="490" cy="124" rx="35" ry="28" fill={CIELO} />
        <ellipse cx="473" cy="120" rx="12" ry="7" fill={TINTA} stroke="none" transform="rotate(-25 473 120)" />
        <ellipse cx="507" cy="120" rx="12" ry="7" fill={TINTA} stroke="none" transform="rotate(25 507 120)" />
        <g data-parte="ojos"><Ojos estado={estado} /></g>
        <ellipse cx="490" cy="132" rx="6" ry="4" fill={TINTA} stroke="none" />
        <g data-parte="boca"><Boca estado={estado} /></g>
        <ellipse cx="465" cy="138" rx="7" ry="4" fill={NARANJA} opacity={estado === 'feliz' ? 0.85 : 0.4} stroke="none" />
        <ellipse cx="515" cy="138" rx="7" ry="4" fill={NARANJA} opacity={estado === 'feliz' ? 0.85 : 0.4} stroke="none" />
      </g>
      {estado === 'tapado' && <BrazoDerecho estado={estado} />}
      {/* Sin rama, la mano izquierda se apoya sobre el borde (y = 58) con las garras encima. */}
      {!rama && (
        <g data-parte="agarre">
          <ellipse cx="442" cy="58" rx="15" ry="10" fill={GRIS} />
          <path d="M429 54 q0 -11 9 -10 M438 50 q0 -11 9 -10 M447 54 q0 -11 9 -10" fill="none" strokeWidth="3.6" />
        </g>
      )}
      {/* Colgado con las dos manos (Pausa paseante): la derecha también se agarra del borde. */}
      {!rama && !['bienvenida', 'leyendo', 'enojado', 'tapado'].includes(estado) && (
        <g data-parte="agarre-derecho">
          <ellipse cx="538" cy="58" rx="15" ry="10" fill={GRIS} />
          <path d="M525 54 q0 -11 9 -10 M534 50 q0 -11 9 -10 M543 54 q0 -11 9 -10" fill="none" strokeWidth="3.6" />
        </g>
      )}
      {/* Garras sobre la rama: el brazo derecho solo se agarra cuando duerme. */}
      {rama && <path d={estado === 'dormido'
        ? 'M436 58 q4 -8 10 -4 M442 60 q4 -8 10 -4 M532 58 q4 -8 10 -2 M538 60 q4 -8 10 -2'
        : 'M436 58 q4 -8 10 -4 M442 60 q4 -8 10 -4'} fill="none" strokeWidth="3" />}
      {estado === 'dormido' && <Zetas />}
      </g></g>
    </g>
  );
}

const parte = (raiz, nombre) => raiz.querySelector(`[data-parte="${nombre}"]`);

// Movimientos lentos y tranquilos, una sola vez por evento.
export function animarEstadoPausa(raiz, estado) {
  const linea = gsap.timeline({ defaults: { ease: 'sine.inOut' } });
  if (estado === 'bienvenida') {
    linea.to(parte(raiz, 'brazo-libre'), { rotation: 12, svgOrigin: '524 130', duration: 0.9, yoyo: true, repeat: 3 });
  } else if (estado === 'leyendo') {
    const parpados = parte(raiz, 'parpados');
    if (parpados) linea.to(parpados, { scaleY: 0.1, svgOrigin: '490 120', duration: 0.35, yoyo: true, repeat: 1 });
    linea.from(parte(raiz, 'libro'), { y: 6, duration: 0.8 }, 0);
  } else if (estado === 'dormido') {
    linea.from(raiz.querySelectorAll('[data-parte="z"]'), { opacity: 0, y: 8, duration: 0.8, stagger: 0.35, ease: 'power1.out' });
  }
  return linea;
}

// Pausa como SVG en línea. «animacion» es un contador: cada cambio reproduce el estado una vez.
// Con «viva», mira al puntero y se balancea en reposo; «toque» es un contador para reaccionar al tocarla.
export default function Pausa({
  estado = 'leyendo', animacion = 0, ancho = 120, parpadeo = true, rama = true, viva = false, toque = 0, className = '', alTerminar,
}) {
  const raiz = useRef(null);
  const pose = TODOS_LOS_ESTADOS.includes(estado) ? estado : 'leyendo';

  useGSAP(() => {
    if (!animacion || prefiereMenosMovimiento()) {
      if (animacion) alTerminar?.();
      return;
    }
    animarEstadoPausa(raiz.current, pose).eventCallback('onComplete', () => alTerminar?.());
  }, { scope: raiz, dependencies: [animacion, pose] });

  useMascotaViva(raiz, { personaje: 'pausa', viva, toque, pose });

  // Parpadeo lento de lectura cada varios segundos; nunca dormida ni con «menos movimiento».
  useGSAP(() => {
    if (!parpadeo || ancho < 80 || pose !== 'leyendo' || prefiereMenosMovimiento()) return;
    const parpados = raiz.current.querySelector('[data-parte="parpados"]');
    gsap.timeline({ repeat: -1, repeatDelay: 8, delay: 5 })
      .to(parpados, { scaleY: 0.1, svgOrigin: '490 120', duration: 0.3, ease: 'sine.in' })
      .to(parpados, { scaleY: 1, svgOrigin: '490 120', duration: 0.4, ease: 'sine.out' });
  }, { scope: raiz, dependencies: [pose, parpadeo, ancho] });

  return (
    <svg ref={raiz} className={`pausa ${className}`.trim()} viewBox={rama ? VISTA_PAUSA : VISTA_SIN_RAMA} width={ancho}
      height={Math.round((ancho * (rama ? 215 : 209)) / 276)} aria-hidden="true" focusable="false" overflow="visible" data-estado={pose}>
      <DibujoPausa estado={pose} rama={rama} />
    </svg>
  );
}
