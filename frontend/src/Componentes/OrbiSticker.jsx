import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { gsap, useGSAP } from '../utils/gsap.js';
import { DibujoOrbi, SiluetaOrbi, useIdSeguro } from './Orbi.jsx';
import './Recorrido.css';

// Orbi como calcomanía de papel (docs/marca/mascotas/orbi-sticker.svg): sombra, papel troquelado y dibujo.
// Animaciones: pegar, despegar (y soltar), doblar (y desdoblar), arrugar, alisar y volar.
export const ANIMACIONES_STICKER = ['pegar', 'despegar', 'soltar', 'doblar', 'desdoblar', 'arrugar', 'alisar', 'volar', 'saltar'];
const VISTA = '62 28 256 206';
const TINTA = '#181B3E';
const CENTRO_X = 190;

// Despegue: la esquina superior derecha (la del mapa) se levanta hacia arriba y a la derecha,
// desde el punto del papel más alejado en esa dirección.
const NORMAL = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
const EXTREMO = { x: 298.3, y: 87.9 };
const TANGENTE = { x: -NORMAL.y, y: NORMAL.x };
const PELADO_MAX = 32;
const RECTANGULO = 'M-400 -400H800V800H-400Z';

const mas = (p, v, k) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
const punto = (p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

// Medio plano del lado «adentro» o «afuera» del doblez, con una leve curva en la línea de doblez.
function medioPlano(q, curva, lado) {
  const a = mas(q, TANGENTE, -400);
  const b = mas(q, TANGENTE, -90);
  const c = mas(q, TANGENTE, 90);
  const d = mas(q, TANGENTE, 400);
  const control = mas(q, NORMAL, curva);
  const lejos = lado === 'adentro' ? -700 : 700;
  return `M${punto(a)} L${punto(b)} Q${punto(control)} ${punto(c)} L${punto(d)} L${punto(mas(d, NORMAL, lejos))} L${punto(mas(a, NORMAL, lejos))}Z`;
}

// Reflejo respecto de la línea de doblez (la solapa muestra el reverso del papel).
function reflejo(q) {
  const { x: nx, y: ny } = NORMAL;
  const k = 2 * (q.x * nx + q.y * ny);
  return `matrix(${1 - 2 * nx * nx} ${-2 * nx * ny} ${-2 * nx * ny} ${1 - 2 * ny * ny} ${(k * nx).toFixed(2)} ${(k * ny).toFixed(2)})`;
}

const PLIEGUES = [
  'M76 74 L118 96 L152 82 L196 112 L236 96 L300 118',
  'M84 162 L126 140 L170 168 L214 146 L256 170 L304 156',
  'M136 36 L158 92 L146 136 L168 184 L160 230',
  'M224 40 L208 96 L236 150 L218 228',
  'M92 112 L150 124 L200 106 L252 132',
];

// Una copia completa del sticker. «sufijo» separa los identificadores de cada copia.
// «doblable»: la copia del frente se recorta a la mitad derecha dentro del SVG mientras se dobla
// (un clip-path de CSS rompería el giro 3D y la cara oculta).
function Lamina({ idBase, sufijo, estado, doblable = false }) {
  const id = (nombre) => `${idBase}${sufijo}-${nombre}`;
  const silueta = { strokeLinejoin: 'round', strokeLinecap: 'round' };
  return (
    <svg className="sticker-capas" viewBox={VISTA} aria-hidden="true" focusable="false" overflow="visible">
      <defs>
        <filter id={id('arruga')} x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence data-sticker="turbulencia" type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="ruido" />
          <feDisplacementMap data-sticker="desplazamiento" in="SourceGraphic" in2="ruido" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <linearGradient id={id('dorso')} gradientUnits="userSpaceOnUse" data-sticker="degradado-dorso" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#CFD5EA" />
          <stop offset="0.45" stopColor="#F1F3FA" />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
        <linearGradient id={id('doblez')} gradientUnits="userSpaceOnUse" x1={CENTRO_X} y1="0" x2="318" y2="0">
          <stop offset="0" stopColor={TINTA} stopOpacity="0.85" />
          <stop offset="1" stopColor={TINTA} stopOpacity="0.15" />
        </linearGradient>
        <clipPath id={id('adentro')}><path data-sticker="recorte-adentro" d={RECTANGULO} /></clipPath>
        <clipPath id={id('afuera')}><path data-sticker="recorte-afuera" d="M0 0Z" /></clipPath>
        <mask id={id('forma')} maskUnits="userSpaceOnUse" x="40" y="10" width="300" height="240">
          <g fill="#fff" stroke="#fff" {...silueta}><SiluetaOrbi estado={estado} /></g>
        </mask>
        {doblable && <clipPath id={id('mitad')}><rect data-sticker="recorte-mitad" x="-400" y="-400" width="1200" height="1200" /></clipPath>}
      </defs>
      <g clipPath={doblable ? `url(#${id('mitad')})` : undefined}>
        {/* Sombra del sticker sobre la superficie; se separa al levantarse y se pega al asentarse. */}
        <g clipPath={`url(#${id('adentro')})`}>
          <g data-sticker="sombra">
            <g data-sticker="tono-sombra" transform="translate(6 7)" opacity="0.2" fill={TINTA} stroke={TINTA} {...silueta}><SiluetaOrbi estado={estado} /></g>
          </g>
        </g>
        <g clipPath={`url(#${id('afuera')})`}>
          <g data-sticker="sombra-esquina" opacity="0" fill={TINTA} stroke={TINTA} {...silueta}><SiluetaOrbi estado={estado} /></g>
        </g>

        {/* Papel y dibujo se mueven juntos; el filtro de arrugado solo se aplica mientras dura la animación. */}
        <g clipPath={`url(#${id('adentro')})`}>
          <g data-sticker="contenido" data-filtro={`url(#${id('arruga')})`} filter="none">
            <g data-sticker="papel" fill="#fff" stroke="#fff" {...silueta}><SiluetaOrbi estado={estado} /></g>
            <DibujoOrbi estado={estado} idBase={`${idBase}${sufijo}`} />
            <g data-sticker="pliegues" mask={`url(#${id('forma')})`} opacity="0" fill="none" strokeLinejoin="round">
              {PLIEGUES.map((d) => <path key={d} d={d} stroke="#ffffff" strokeWidth="2.6" />)}
              {PLIEGUES.map((d) => <path key={`${d}-g`} d={d} stroke="#A9B1CF" strokeWidth="1.2" transform="translate(1.4 1.4)" />)}
            </g>
          </g>
        </g>
        {/* Oscurece la mitad que se dobla (solo se ve durante el doblez). */}
        <rect data-sticker="sombra-frente" x={CENTRO_X} y="20" width="140" height="230" fill={`url(#${id('doblez')})`} mask={`url(#${id('forma')})`} opacity="0" />

        {/* Solapa: la esquina levantada muestra el reverso blanco del papel con sombreado en el doblez. */}
        <g data-sticker="solapa" opacity="0">
          <g clipPath={`url(#${id('afuera')})`}>
            <g fill={`url(#${id('dorso')})`} stroke={`url(#${id('dorso')})`} {...silueta}><SiluetaOrbi estado={estado} /></g>
          </g>
        </g>
      </g>
    </svg>
  );
}

// Reverso de la mitad derecha para el doblez: silueta reflejada sobre la línea central.
function Dorso({ idBase, estado }) {
  const espejo = `translate(${CENTRO_X * 2} 0) scale(-1 1)`;
  const silueta = { strokeLinejoin: 'round', strokeLinecap: 'round' };
  return (
    <svg className="sticker-capas" viewBox={VISTA} aria-hidden="true" focusable="false" overflow="visible">
      <defs>
        <linearGradient id={`${idBase}-doblez-dorso`} gradientUnits="userSpaceOnUse" x1={CENTRO_X} y1="0" x2="62" y2="0">
          <stop offset="0" stopColor={TINTA} stopOpacity="0.8" />
          <stop offset="1" stopColor={TINTA} stopOpacity="0.1" />
        </linearGradient>
        <mask id={`${idBase}-forma-dorso`} maskUnits="userSpaceOnUse" x="40" y="10" width="300" height="240">
          <g transform={espejo} fill="#fff" stroke="#fff" {...silueta}><SiluetaOrbi estado={estado} /></g>
        </mask>
        <clipPath id={`${idBase}-mitad-dorso`}><rect x="-400" y="-400" width={CENTRO_X + 400} height="1200" /></clipPath>
      </defs>
      <g clipPath={`url(#${idBase}-mitad-dorso)`}>
        <g transform={espejo} fill="#F4F6FB" stroke="#F4F6FB" {...silueta}><SiluetaOrbi estado={estado} /></g>
        <g transform={espejo} fill="none" stroke="#DCE1F0" strokeWidth="1.5"><path d="M150 70 L160 140 L150 200" /></g>
        <rect data-sticker="sombra-dorso" x="50" y="20" width={CENTRO_X - 50} height="230" fill={`url(#${idBase}-doblez-dorso)`}
          mask={`url(#${idBase}-forma-dorso)`} opacity="0" />
      </g>
    </svg>
  );
}

// Calcomanía de Orbi. Se anima con la prop «animacion» o con métodos del ref (ref.current.arrugar()).
// Cada animación dura menos de 1 s, no bloquea la página y avisa con onTerminar(nombre).
const OrbiSticker = forwardRef(function OrbiSticker({ ancho = 160, estado = 'saludo', animacion = null, onTerminar, className = '' }, ref) {
  const raiz = useRef(null);
  const avisar = useRef(onTerminar);
  const idBase = `stk${useIdSeguro()}`;
  const [sonrisa, setSonrisa] = useState(false);
  const pose = sonrisa ? 'animo' : estado;
  const pelado = useRef({ s: 0 });

  useEffect(() => { avisar.current = onTerminar; }, [onTerminar]);

  const { contextSafe } = useGSAP({ scope: raiz });

  const metodos = useMemo(() => {
    const todos = (nombre) => [...raiz.current.querySelectorAll(`[data-sticker="${nombre}"]`)];
    const hoja = () => raiz.current.querySelector('.sticker-hoja');
    const terminar = (nombre) => () => {
      gsap.set(hoja(), { willChange: 'auto' });
      avisar.current?.(nombre);
    };
    const reducido = () => prefiereMenosMovimiento();

    // Recalcula el doblez de la esquina para un avance «s» (0 = pegada).
    const pintarPelado = () => {
      const { s } = pelado.current;
      const q = mas(EXTREMO, NORMAL, -s);
      const curva = s * 0.16;
      const visible = s > 0.5;
      for (const camino of todos('recorte-adentro')) camino.setAttribute('d', visible ? medioPlano(q, curva, 'adentro') : RECTANGULO);
      for (const camino of todos('recorte-afuera')) camino.setAttribute('d', visible ? medioPlano(q, curva, 'afuera') : 'M0 0Z');
      for (const solapa of todos('solapa')) {
        solapa.setAttribute('transform', reflejo(q));
        solapa.setAttribute('opacity', visible ? '1' : '0');
      }
      for (const degradado of todos('degradado-dorso')) {
        degradado.setAttribute('x1', q.x.toFixed(1));
        degradado.setAttribute('y1', q.y.toFixed(1));
        degradado.setAttribute('x2', EXTREMO.x.toFixed(1));
        degradado.setAttribute('y2', EXTREMO.y.toFixed(1));
      }
      // La sombra de la esquina se estira mientras más se levanta.
      for (const sombra of todos('sombra-esquina')) {
        sombra.setAttribute('transform', `translate(${(6 + NORMAL.x * s * 0.35).toFixed(1)} ${(7 + NORMAL.y * s * 0.35).toFixed(1)})`);
        sombra.setAttribute('opacity', visible ? Math.min(0.11, s / 260).toFixed(3) : '0');
      }
    };

    const filtro = (activo) => {
      for (const grupo of todos('contenido')) grupo.setAttribute('filter', activo ? grupo.dataset.filtro : 'none');
    };

    return {
      // Cae un poco más grande e inclinada, se aplasta contra la superficie y la sombra se pega.
      pegar: contextSafe(() => {
        if (reducido()) return gsap.fromTo(hoja(), { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: terminar('pegar') });
        gsap.set(hoja(), { willChange: 'transform' });
        return gsap.timeline({ onComplete: terminar('pegar') })
          .fromTo(hoja(), { opacity: 0, scale: 1.15, rotation: -7, y: -10 }, { opacity: 1, scale: 1, rotation: 0, y: 0, duration: 0.5, ease: 'back.out(1.4)' })
          .fromTo(todos('sombra'), { x: 10, y: 13 }, { x: 0, y: 0, duration: 0.5, ease: 'power2.out' }, 0)
          .fromTo(todos('tono-sombra'), { attr: { opacity: 0.07 } }, { attr: { opacity: 0.2 }, duration: 0.5, ease: 'power2.out' }, 0);
      }),

      // Levanta la esquina del mapa: se ve el reverso blanco y la sombra se estira.
      despegar: contextSafe(() => {
        if (reducido()) return null;
        return gsap.to(pelado.current, { s: PELADO_MAX, duration: 0.45, ease: 'power2.out', onUpdate: pintarPelado, onComplete: terminar('despegar') });
      }),

      // Vuelve a pegar la esquina con un rebote corto.
      soltar: contextSafe(() => {
        if (reducido()) {
          pelado.current.s = 0;
          pintarPelado();
          return null;
        }
        return gsap.timeline({ onComplete: terminar('soltar') })
          .to(pelado.current, { s: 0, duration: 0.28, ease: 'power2.in', onUpdate: pintarPelado })
          .fromTo(hoja(), { scale: 1.025 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
      }),

      // Dobla la mitad derecha sobre la izquierda (giro en Y con perspectiva) y muestra el reverso blanco.
      doblar: contextSafe(() => {
        const contenedor = hoja();
        contenedor.classList.add('doblando');
        for (const rect of todos('recorte-mitad')) { rect.setAttribute('x', String(CENTRO_X)); rect.setAttribute('width', '600'); }
        if (reducido()) {
          gsap.set(todos('mitad-der'), { rotationY: -180 });
          avisar.current?.('doblar');
          return null;
        }
        gsap.set(contenedor, { willChange: 'transform' });
        return gsap.timeline({ onComplete: terminar('doblar') })
          .to(todos('mitad-der'), { rotationY: -180, duration: 0.7, ease: 'power2.inOut' })
          .fromTo(todos('sombra-frente'), { opacity: 0 }, { opacity: 0.38, duration: 0.35, ease: 'power1.in' }, 0)
          .fromTo(todos('sombra-dorso'), { opacity: 0.38 }, { opacity: 0, duration: 0.35, ease: 'power1.out' }, 0.35);
      }),

      // La misma animación al revés.
      desdoblar: contextSafe(() => {
        const contenedor = hoja();
        const fin = () => {
          for (const rect of todos('recorte-mitad')) { rect.setAttribute('x', '-400'); rect.setAttribute('width', '1200'); }
          contenedor.classList.remove('doblando');
          terminar('desdoblar')();
        };
        if (reducido()) {
          gsap.set(todos('mitad-der'), { rotationY: 0 });
          fin();
          return null;
        }
        return gsap.timeline({ onComplete: fin })
          .to(todos('mitad-der'), { rotationY: 0, duration: 0.7, ease: 'power2.inOut' })
          .to(todos('sombra-dorso'), { opacity: 0.38, duration: 0.35, ease: 'power1.in' }, 0)
          .to(todos('sombra-frente'), { opacity: 0, duration: 0.35, ease: 'power1.out' }, 0.35);
      }),

      // Arruga el papel: desplazamiento con ruido, pliegues visibles, se encoge y gira un poco.
      arrugar: contextSafe(() => {
        setSonrisa(false);
        if (reducido()) {
          avisar.current?.('arrugar');
          return null;
        }
        filtro(true);
        gsap.set(hoja(), { willChange: 'transform' });
        return gsap.timeline({ onComplete: terminar('arrugar') })
          .fromTo(todos('desplazamiento'), { attr: { scale: 0 } }, { attr: { scale: 18 }, duration: 0.7, ease: 'power2.out' })
          .fromTo(todos('turbulencia'), { attr: { baseFrequency: 0.035 } }, { attr: { baseFrequency: 0.052 }, duration: 0.7, ease: 'power1.out' }, 0)
          .to(todos('pliegues'), { opacity: 0.7, duration: 0.4 }, 0.1)
          .to(hoja(), { keyframes: [{ scale: 0.92, rotation: -5, duration: 0.25 }, { scale: 0.86, rotation: 4, duration: 0.25 }, { scale: 0.85, rotation: -3, duration: 0.2 }], ease: 'power2.out' }, 0)
          .to(todos('sombra'), { scale: 0.9, svgOrigin: '190 140', duration: 0.6 }, 0)
          .to(todos('tono-sombra'), { attr: { opacity: 0.32 }, duration: 0.6 }, 0);
      }),

      // Estira el papel: vuelve a su forma, quedan marcas tenues unos segundos y Orbi sonríe.
      alisar: contextSafe(() => {
        const sonreir = () => {
          setSonrisa(true);
          gsap.delayedCall(2.6, () => setSonrisa(false));
        };
        if (reducido()) {
          filtro(false);
          gsap.set(todos('desplazamiento'), { attr: { scale: 0 } });
          gsap.set(todos('pliegues'), { opacity: 0 });
          gsap.set(hoja(), { scale: 1, rotation: 0 });
          gsap.set(todos('sombra'), { clearProps: 'all' });
          gsap.set(todos('tono-sombra'), { attr: { opacity: 0.2 } });
          sonreir();
          avisar.current?.('alisar');
          return null;
        }
        return gsap.timeline({
          onComplete: () => {
            filtro(false);
            sonreir();
            terminar('alisar')();
            // Las marcas del arrugado se borran despacio, ya con la animación terminada y la página libre.
            gsap.to(todos('pliegues'), { opacity: 0, duration: 0.6, delay: 2.4 });
          },
        })
          .to(todos('desplazamiento'), { attr: { scale: 0 }, duration: 0.6, ease: 'power2.out' })
          .to(todos('turbulencia'), { attr: { baseFrequency: 0.035 }, duration: 0.6 }, 0)
          .to(hoja(), { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.2)' }, 0)
          .to(todos('sombra'), { scale: 1, svgOrigin: '190 140', duration: 0.6 }, 0)
          .to(todos('tono-sombra'), { attr: { opacity: 0.2 }, duration: 0.6 }, 0)
          .to(todos('pliegues'), { opacity: 0.22, duration: 0.3 }, 0);
      }),

      // Pequeño salto de alegría (acierto en Parejas): se levanta y vuelve a asentarse.
      saltar: contextSafe(() => {
        if (reducido()) return null;
        return gsap.timeline({ onComplete: terminar('saltar') })
          .to(hoja(), { y: -12, scale: 1.04, duration: 0.18, ease: 'power2.out' })
          .to(todos('sombra'), { x: 5, y: 7, duration: 0.18 }, 0)
          .to(hoja(), { y: 0, scale: 1, duration: 0.32, ease: 'back.out(2.2)' })
          .to(todos('sombra'), { x: 0, y: 0, duration: 0.32 }, '<');
      }),

      // Se despega y cae como hoja de papel mientras se desvanece.
      volar: contextSafe(() => {
        if (reducido()) return gsap.to(hoja(), { opacity: 0, duration: 0.2, onComplete: terminar('volar') });
        gsap.set(hoja(), { willChange: 'transform, opacity' });
        return gsap.timeline({ onComplete: terminar('volar') })
          .to(todos('sombra'), { x: 12, y: 16, duration: 0.2 })
          .to(todos('tono-sombra'), { attr: { opacity: 0.08 }, duration: 0.2 }, 0)
          .to(hoja(), { scale: 1.06, y: -8, duration: 0.2, ease: 'power2.out' }, 0)
          .to(hoja(), {
            keyframes: [
              { x: 26, rotation: 12, rotationX: 18, y: 30, duration: 0.24 },
              { x: -18, rotation: -10, rotationX: -12, y: 70, duration: 0.24 },
              { x: 20, rotation: 8, rotationX: 22, y: 110, duration: 0.22 },
            ],
            ease: 'sine.inOut',
          }, 0.2)
          .to(hoja(), { opacity: 0, duration: 0.45, ease: 'power1.in' }, 0.45);
      }),
    };
  }, [contextSafe]);

  useImperativeHandle(ref, () => metodos, [metodos]);

  // La prop «animacion» dispara la animación indicada cada vez que cambia (antes de pintar, sin parpadeo).
  useLayoutEffect(() => {
    if (animacion && metodos[animacion]) metodos[animacion]();
  }, [animacion, metodos]);

  return (
    <div ref={raiz} className={`sticker ${className}`.trim()} style={{ width: ancho }} aria-hidden="true">
      <div className="sticker-hoja">
        <div className="sticker-mitad izq" data-sticker="mitad-izq"><Lamina idBase={idBase} sufijo="a" estado={pose} /></div>
        <div className="sticker-mitad der" data-sticker="mitad-der">
          <div className="sticker-cara frente">
            <Lamina idBase={idBase} sufijo="b" estado={pose} doblable />
          </div>
          <div className="sticker-cara dorso">
            <Dorso idBase={idBase} estado={pose} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default OrbiSticker;
