import { useId, useRef } from 'react';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { gsap, useGSAP } from '../utils/gsap.js';

// Orbi, la mascota principal (docs/marca/mascotas/orbi.svg). Cada estado cambia partes del mismo dibujo.
export const ESTADOS_ORBI = ['saludo', 'animo', 'pensando', 'celebrando', 'descanso'];
export const VISTA_ORBI = '70 36 236 184';

const TINTA = '#181B3E';
const AZUL = '#3452E1';
const AZUL_CLARO = '#6F86FF';
const LIMA = '#C5EF6A';
const NARANJA = '#F0591A';
const CIELO = '#EAEEFF';

// Posición del brazo libre según el estado (hombro fijo en el cuerpo).
const BRAZO_SALUDO = {
  normal: { trazo: 'M128 146 q-24 -6 -30 -28', mano: [97, 113] },
  arriba: { trazo: 'M128 140 q-22 -14 -22 -40', mano: [106, 99] },
  abajo: { trazo: 'M130 154 q-10 10 -10 22', mano: [120, 178] },
};
const brazoDe = (estado) => (estado === 'celebrando' ? BRAZO_SALUDO.arriba : estado === 'descanso' ? BRAZO_SALUDO.abajo : BRAZO_SALUDO.normal);

// Silueta del dibujo: la usan el papel y la sombra del sticker para seguir la misma pose.
export function SiluetaOrbi({ estado = 'saludo' }) {
  const brazo = brazoDe(estado);
  const doblado = estado === 'descanso';
  const birrete = estado === 'celebrando' ? 'translate(0 -14) rotate(-14 183 72)' : undefined;
  return (
    <>
      <path d={brazo.trazo} fill="none" strokeWidth="34" />
      <path d="M234 150 q22 -4 28 -22" fill="none" strokeWidth="34" />
      <circle cx={brazo.mano[0]} cy={brazo.mano[1]} r="19" />
      <circle cx="262" cy="130" r="18" />
      {doblado
        ? <rect x="250" y="96" width="22" height="32" rx="3" strokeWidth="22" transform="rotate(10 268 108)" />
        : <rect x="248" y="92" width="40" height="32" rx="3" strokeWidth="22" transform="rotate(10 268 108)" />}
      <ellipse cx="162" cy="196" rx="21" ry="16" />
      <ellipse cx="198" cy="196" rx="21" ry="16" />
      <circle cx="180" cy="132" r="64" />
      <g transform={birrete}>
        <path d="M158 82 q22 -8 46 2 q-4 8 -22 8 q-18 0 -24 -10 z" strokeWidth="22" />
        <path d="M142 72 l42 -18 l40 16 l-42 18 z" strokeWidth="22" />
        <path d="M220 70 q6 10 4 24" fill="none" strokeWidth="18" />
        <circle cx="224" cy="97" r="13" />
      </g>
    </>
  );
}

function Ojos({ estado }) {
  if (estado === 'celebrando') {
    // Ojos felices, cerrados hacia arriba.
    return (
      <g fill="none" strokeWidth="4.5">
        <path d="M152 127 q10 -13 20 0" />
        <path d="M188 127 q10 -13 20 0" />
      </g>
    );
  }
  if (estado === 'descanso') {
    // Ojos cerrados y tranquilos.
    return (
      <g fill="none" strokeWidth="4">
        <path d="M152 124 q10 8 20 0" />
        <path d="M188 124 q10 8 20 0" />
      </g>
    );
  }
  // Pensando: mira hacia arriba y a la derecha.
  const [dx, dy] = estado === 'pensando' ? [2, -6] : [0, 0];
  const pupila = estado === 'animo' ? 7.2 : 6.5;
  return (
    <g data-parte="parpados">
      <ellipse cx="162" cy="124" rx="11" ry="13" fill="#fff" />
      <ellipse cx="198" cy="124" rx="11" ry="13" fill="#fff" />
      <circle cx={165 + dx} cy={126 + dy} r={pupila} fill={TINTA} stroke="none" />
      <circle cx={201 + dx} cy={126 + dy} r={pupila} fill={TINTA} stroke="none" />
      <circle cx={167 + dx} cy={122 + dy} r="2.3" fill="#fff" stroke="none" />
      <circle cx={203 + dx} cy={122 + dy} r="2.3" fill="#fff" stroke="none" />
    </g>
  );
}

function Boca({ estado }) {
  if (estado === 'animo') return <path d="M164 138 q16 19 32 0 z" fill={TINTA} />;
  if (estado === 'celebrando') {
    return (
      <g>
        <path d="M163 137 q17 22 34 0 z" fill={TINTA} />
        <path d="M172 146 q8 6 16 0 q-8 -4 -16 0 z" fill={NARANJA} stroke="none" />
      </g>
    );
  }
  if (estado === 'pensando') return <ellipse cx="183" cy="144" rx="4.5" ry="5" fill={TINTA} />;
  if (estado === 'descanso') return <path d="M172 142 q8 6 16 0" fill="none" strokeWidth="3.5" />;
  return <path d="M170 140 q10 10 20 0 z" fill={TINTA} />;
}

// Mapa con el camino punteado; en descanso queda doblado por la mitad.
function Mapa({ estado, recorte }) {
  if (estado === 'descanso') {
    return (
      <g transform="rotate(10 268 108)">
        <rect x="250" y="96" width="22" height="30" rx="3" fill={CIELO} />
        <path d="M261 97 v28" fill="none" strokeWidth="2" opacity="0.5" />
        <path d="M254 116 q4 -6 8 -3" fill="none" stroke={NARANJA} strokeWidth="2.5" strokeDasharray="4 4" />
      </g>
    );
  }
  return (
    <g transform="rotate(10 268 108)">
      <rect x="248" y="92" width="40" height="32" rx="3" fill={CIELO} />
      {recorte && <clipPath id={recorte}><rect data-parte="trazo-camino" x="250" y="94" width="36" height="28" /></clipPath>}
      <path d="M254 114 q8 -12 16 -4 q8 8 14 -6" fill="none" stroke={NARANJA} strokeWidth="2.5" strokeDasharray="4 4"
        clipPath={recorte ? `url(#${recorte})` : undefined} />
    </g>
  );
}

// Dibujo completo de Orbi; «idBase» viene de useId para que los recortes no choquen entre varias copias.
export function DibujoOrbi({ estado = 'saludo', idBase }) {
  const brazo = brazoDe(estado);
  const recorte = idBase ? `${idBase}-camino` : null;
  return (
    <g data-parte="orbi" stroke={TINTA} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
      <g data-parte="brazo-saludo">
        <path d={brazo.trazo} fill="none" strokeWidth="16" />
        <path d={brazo.trazo} fill="none" stroke={AZUL_CLARO} strokeWidth="9" />
        <circle cx={brazo.mano[0]} cy={brazo.mano[1]} r="10" fill={AZUL_CLARO} />
      </g>
      <g data-parte="brazo-mapa">
        <path d="M234 150 q22 -4 28 -22" fill="none" strokeWidth="16" />
        <path d="M234 150 q22 -4 28 -22" fill="none" stroke={AZUL_CLARO} strokeWidth="9" />
        <g data-parte="mapa"><Mapa estado={estado} recorte={recorte} /></g>
        <circle cx="262" cy="130" r="9" fill={AZUL_CLARO} />
      </g>
      <g data-parte="pies">
        <ellipse cx="162" cy="196" rx="12" ry="7" fill={AZUL} />
        <ellipse cx="198" cy="196" rx="12" ry="7" fill={AZUL} />
      </g>
      <g data-parte="cuerpo">
        <circle cx="180" cy="132" r="55" fill={AZUL_CLARO} />
        <circle cx="146" cy="108" r="6" fill={AZUL} stroke="none" />
        <circle cx="214" cy="104" r="4" fill={AZUL} stroke="none" />
      </g>
      <g data-parte="cinturon">
        <path d="M126 146 q54 24 108 0" fill="none" strokeWidth="10" />
        <path d="M126 146 q54 24 108 0" fill="none" stroke={AZUL} strokeWidth="4" />
        {estado === 'animo' && (
          <g data-parte="brillo-hebilla" stroke={LIMA} strokeWidth="3">
            <circle cx="180" cy="158" r="15" fill={LIMA} opacity="0.45" stroke="none" />
            <path d="M158 158 h-7 M202 158 h7 M165 171 l-5 5 M195 171 l5 5" fill="none" />
          </g>
        )}
        <circle data-parte="hebilla" cx="180" cy="158" r="8" fill={LIMA} />
      </g>
      <g data-parte="ojos"><Ojos estado={estado} /></g>
      <g data-parte="mejillas">
        <ellipse cx="146" cy="140" rx="7" ry="4" fill={NARANJA} opacity={estado === 'animo' || estado === 'celebrando' ? 0.6 : 0.4} stroke="none" />
        <ellipse cx="214" cy="140" rx="7" ry="4" fill={NARANJA} opacity={estado === 'animo' || estado === 'celebrando' ? 0.6 : 0.4} stroke="none" />
      </g>
      <g data-parte="boca"><Boca estado={estado} /></g>
      <g data-parte="birrete">
        <g transform={estado === 'celebrando' ? 'translate(0 -14) rotate(-14 183 72)' : undefined}>
          <path d="M158 82 q22 -8 46 2 q-4 8 -22 8 q-18 0 -24 -10 z" fill={TINTA} />
          <path d="M142 72 l42 -18 l40 16 l-42 18 z" fill={TINTA} />
          <g data-parte="borla">
            <path d="M220 70 q6 10 4 24" fill="none" stroke={NARANJA} strokeWidth="3" />
            <circle cx="224" cy="97" r="4" fill={NARANJA} stroke={NARANJA} />
          </g>
        </g>
      </g>
    </g>
  );
}

const parte = (raiz, nombre) => raiz.querySelector(`[data-parte="${nombre}"]`);

// Movimiento de cada estado. Siempre termina en la pose que dibuja React (sin estilos sueltos).
export function animarEstadoOrbi(raiz, estado) {
  const linea = gsap.timeline({ defaults: { ease: 'power2.out' } });
  const orbi = parte(raiz, 'orbi');
  if (estado === 'saludo') {
    linea.to(parte(raiz, 'brazo-saludo'), { rotation: -16, svgOrigin: '128 146', duration: 0.18, yoyo: true, repeat: 5, ease: 'sine.inOut' });
  } else if (estado === 'animo') {
    linea.from(orbi, { y: 6, scaleY: 0.94, svgOrigin: '180 200', duration: 0.35, ease: 'back.out(2)' });
    const brillo = parte(raiz, 'brillo-hebilla');
    if (brillo) linea.from(brillo, { opacity: 0, scale: 0.4, svgOrigin: '180 158', duration: 0.5 }, 0);
  } else if (estado === 'pensando') {
    linea.from(parte(raiz, 'ojos'), { y: 5, duration: 0.3 });
    const trazo = parte(raiz, 'trazo-camino');
    // El camino del mapa aparece punto por punto.
    if (trazo) linea.fromTo(trazo, { attr: { width: 0 } }, { attr: { width: 36 }, duration: 1.2, ease: 'steps(8)' }, 0);
  } else if (estado === 'celebrando') {
    linea.to(orbi, { y: -18, duration: 0.22, ease: 'power2.out' })
      .to(orbi, { y: 0, duration: 0.3, ease: 'bounce.out' })
      .from(parte(raiz, 'birrete'), { y: 16, rotation: 14, svgOrigin: '183 72', duration: 0.6, ease: 'back.out(1.6)' }, 0);
  } else if (estado === 'descanso') {
    linea.from(orbi, { y: -3, duration: 0.8, ease: 'sine.out' });
  }
  return linea;
}

// Parpadeo sutil cada varios segundos (solo con los ojos abiertos y sin «menos movimiento»).
export function useParpadeo(raiz, estado, activo = true) {
  useGSAP(() => {
    if (!activo || prefiereMenosMovimiento() || !['saludo', 'animo', 'pensando'].includes(estado)) return;
    const parpados = raiz.current?.querySelector('[data-parte="parpados"]');
    if (!parpados) return;
    gsap.timeline({ repeat: -1, repeatDelay: 6.5, delay: 4 })
      .to(parpados, { scaleY: 0.1, svgOrigin: '180 124', duration: 0.08, ease: 'power1.in' })
      .to(parpados, { scaleY: 1, svgOrigin: '180 124', duration: 0.12, ease: 'power1.out' });
  }, { scope: raiz, dependencies: [estado, activo] });
}

// Orbi como SVG en línea. «animacion» es un contador: cada vez que cambia se reproduce el estado una vez.
export default function Orbi({ estado = 'saludo', animacion = 0, ancho = 120, parpadeo = true, className = '', alTerminar }) {
  const raiz = useRef(null);
  const idBase = `orbi${useIdSeguro()}`;
  const pose = ESTADOS_ORBI.includes(estado) ? estado : 'saludo';

  useGSAP(() => {
    if (!animacion || prefiereMenosMovimiento()) {
      if (animacion) alTerminar?.();
      return;
    }
    animarEstadoOrbi(raiz.current, pose).eventCallback('onComplete', () => alTerminar?.());
  }, { scope: raiz, dependencies: [animacion, pose] });
  useParpadeo(raiz, pose, parpadeo && ancho >= 80);

  return (
    <svg ref={raiz} className={`orbi ${className}`.trim()} viewBox={VISTA_ORBI} width={ancho} height={Math.round((ancho * 184) / 236)}
      aria-hidden="true" focusable="false" overflow="visible" data-estado={pose}>
      <DibujoOrbi estado={pose} idBase={idBase} />
    </svg>
  );
}

// useId devuelve «:r1:»; se limpia para usarlo dentro de url(#…).
export function useIdSeguro() {
  return useId().replace(/[^a-zA-Z0-9_-]/g, '');
}
