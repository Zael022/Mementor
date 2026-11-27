import { useCallback, useEffect, useRef, useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { gsap } from '../utils/gsap.js';
import { alAcariciar, alClic, crearEstadoPausa, elegirDestino, estaDormido } from '../utils/pausaPaseante.js';
import Pausa from './Pausa.jsx';
import './Recorrido.css';

// Pausa paseante (Parte A): cuelga del borde inferior de la barra superior y avanza mano tras mano,
// muy despacio, por encima del contenido. Reacciona a clics (curiosidad o molestia) y a caricias.
// La capa no recibe clics: solo Pausa. Se detiene si el puntero se acerca, con la pestaña oculta
// y con «Menos movimiento» (ahí se queda quieto en una esquina y solo cambia de expresión).

const VELOCIDAD = 22; // píxeles por segundo: lento, como un perezoso
const ESQUIVAR_CADA_MS = 2000; // lo que hay que esquivar se revisa a intervalos, no en cada fotograma
const FRASE_MS = 5000;
const POSE_MS = 4000;
const PRESION_LARGA_MS = 600;
// Zona de la cabeza en las coordenadas del dibujo sin rama (círculo de centro 490,118 y radio 44).
const CABEZA = { x: 490, y: 118, radio: 46 };
const VISTA = { x: 362, y: 36, ancho: 276, alto: 209 };
// Lo que Pausa nunca tapa al detenerse.
const ESQUIVAR = 'input, textarea, select, [contenteditable="true"], .boton:not(.secundario), .chat-formulario, [data-pausa-esquiva]';

const azarEntre = (minimo, maximo) => minimo + Math.random() * (maximo - minimo);

function medidas() {
  const cabecera = document.querySelector('.cabecera')?.getBoundingClientRect();
  const contenido = document.querySelector('.contenido')?.getBoundingClientRect();
  const movil = window.innerWidth < 720;
  const ancho = movil ? 74 : 112;
  const alto = Math.round((ancho * VISTA.alto) / VISTA.ancho);
  const borde = cabecera ? Math.max(0, cabecera.bottom) : 0;
  const izquierda = Math.max(8, contenido?.left ?? 8);
  const derecha = Math.min(window.innerWidth, contenido?.right ?? window.innerWidth) - ancho - 8;
  // En móvil va en una esquina y con poco recorrido.
  return { movil, ancho, alto, borde, minimo: movil ? Math.max(izquierda, derecha - 110) : izquierda, maximo: derecha };
}

export default function PausaPaseante() {
  const { preferencias } = useSesion();
  const pasea = preferencias?.pausaWalks !== false;
  const capa = useRef(null);
  const figura = useRef(null);
  const reglas = useRef(crearEstadoPausa());
  const posicion = useRef(null);
  const viaje = useRef(null);
  const manos = useRef(null);
  const temporizadores = useRef({});
  const pausado = useRef(false);
  const caricia = useRef({ desde: 0, x: 0, y: 0, tiempo: 0, ultimoToque: 0 });
  const presion = useRef({ temporizador: 0, disparada: false });
  const [pose, setPose] = useState('curioso');
  const [frase, setFrase] = useState('');
  const [corazones, setCorazones] = useState(0);
  const [tam, setTam] = useState(() => medidas());

  const quieto = !pasea || prefiereMenosMovimiento();

  const limpiar = useCallback((clave) => clearTimeout(temporizadores.current[clave]), []);
  const programar = useCallback((clave, ms, accion) => {
    clearTimeout(temporizadores.current[clave]);
    temporizadores.current[clave] = setTimeout(accion, ms);
  }, []);

  // Coloca a Pausa sin animar (al iniciar, al cambiar el tamaño de la ventana o en modo quieto).
  const ubicar = useCallback((x) => {
    posicion.current = x;
    if (figura.current) gsap.set(figura.current, { x });
  }, []);

  // Rectángulos que hay que esquivar en la franja donde cuelga Pausa, como tramos horizontales.
  const zonasOcupadas = useCallback((m) => {
    const franja = { arriba: m.borde, abajo: m.borde + m.alto };
    const elementos = [...document.querySelectorAll(ESQUIVAR)];
    if (document.activeElement && document.activeElement !== document.body) elementos.push(document.activeElement);
    return elementos
      .filter((elemento) => !figura.current?.contains(elemento))
      .map((elemento) => elemento.getBoundingClientRect())
      .filter((caja) => caja.width && caja.bottom > franja.arriba && caja.top < franja.abajo)
      .map((caja) => [caja.left - 12, caja.right + 12]);
  }, []);

  const mostrarFrase = (texto) => {
    setFrase(texto);
    programar('frase', FRASE_MS, () => setFrase(''));
  };

  // Mano tras mano: los brazos suben y bajan alternados mientras avanza.
  const moverManos = (activo) => {
    manos.current?.kill();
    manos.current = null;
    const svg = figura.current?.querySelector('svg');
    if (!activo || !svg) return;
    const izquierda = svg.querySelectorAll('[data-parte="brazo-rama"], [data-parte="agarre"]');
    const derecha = svg.querySelectorAll('[data-parte="brazo-libre"], [data-parte="agarre-derecho"]');
    manos.current = gsap.timeline({ repeat: -1 })
      .to(izquierda, { y: -7, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: 1 })
      .to(derecha, { y: -7, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: 1 });
  };

  // Viaja hasta «destino» y luego descansa. Durante el descanso mira, bosteza o se duerme.
  const viajar = useCallback((destino, alLlegar) => {
    viaje.current?.kill();
    const desde = posicion.current ?? destino;
    const duracion = Math.abs(destino - desde) / VELOCIDAD;
    if (duracion < 0.2) {
      alLlegar?.();
      return;
    }
    moverManos(true);
    viaje.current = gsap.to(posicion, {
      current: destino, duration: duracion, ease: 'sine.inOut',
      onUpdate: () => gsap.set(figura.current, { x: posicion.current }),
      onComplete: () => { moverManos(false); alLlegar?.(); },
    });
    if (pausado.current) viaje.current.pause();
  }, []);

  const descansar = useCallback(() => {
    if (quieto) return;
    // Pausas largas: entre 20 y 40 segundos sin moverse.
    const espera = azarEntre(20000, 40000);
    const ocio = Math.random();
    if (!estaDormido(reglas.current, Date.now())) {
      if (ocio < 0.3) {
        programar('ocio', espera * 0.4, () => {
          setPose('bostezo');
          programar('pose', 2500, () => setPose('curioso'));
        });
      } else if (ocio < 0.55) {
        programar('ocio', espera * 0.3, () => setPose('dormido'));
      }
    }
    programar('paseo', espera, () => {
      if (estaDormido(reglas.current, Date.now())) return descansar();
      const m = medidas();
      setPose('curioso');
      viajar(elegirDestino({ desde: posicion.current, minimo: m.minimo, maximo: m.maximo, ancho: m.ancho, zonas: zonasOcupadas(m) }), descansar);
      return undefined;
    });
  }, [quieto, viajar, zonasOcupadas, programar]);

  // Inicio, cambio de tamaño de ventana y modo quieto.
  useEffect(() => {
    const iniciar = () => {
      const m = medidas();
      setTam(m);
      const inicial = posicion.current == null ? m.maximo : Math.min(Math.max(posicion.current, m.minimo), m.maximo);
      viaje.current?.kill();
      moverManos(false);
      ubicar(quieto ? m.maximo : inicial);
    };
    iniciar();
    if (!quieto) descansar();
    window.addEventListener('resize', iniciar);
    const timers = temporizadores.current;
    return () => {
      window.removeEventListener('resize', iniciar);
      viaje.current?.kill();
      manos.current?.kill();
      Object.values(timers).forEach(clearTimeout);
    };
  }, [quieto, descansar, ubicar]);

  // Esquivar: si quedó encima del foco, de un campo o del botón principal, se mueve a un lugar libre.
  useEffect(() => {
    if (quieto) return undefined;
    const revisar = () => {
      if (pausado.current || viaje.current?.isActive()) return;
      const m = medidas();
      const zonas = zonasOcupadas(m);
      const x = posicion.current ?? m.maximo;
      const tapa = zonas.some(([inicio, fin]) => x + m.ancho > inicio && x < fin);
      if (tapa) viajar(elegirDestino({ desde: x, minimo: m.minimo, maximo: m.maximo, ancho: m.ancho, zonas, distanciaMinima: 0 }), descansar);
    };
    const intervalo = setInterval(revisar, ESQUIVAR_CADA_MS);
    return () => clearInterval(intervalo);
  }, [quieto, viajar, descansar, zonasOcupadas]);

  // Si el puntero se acerca mientras avanza, se detiene; con la pestaña oculta, todo se pausa.
  useEffect(() => {
    if (quieto) return undefined;
    let cuadro = 0;
    const cerca = (evento) => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const caja = figura.current?.getBoundingClientRect();
        if (!caja || !viaje.current) return;
        const distancia = Math.hypot(evento.clientX - (caja.left + caja.width / 2), evento.clientY - (caja.top + caja.height / 2));
        if (distancia < 140 && viaje.current.isActive()) { viaje.current.pause(); manos.current?.pause(); }
        else if (distancia >= 140 && !pausado.current && viaje.current.paused() && viaje.current.progress() < 1) { viaje.current.resume(); manos.current?.resume(); }
      });
    };
    const visibilidad = () => {
      pausado.current = document.hidden;
      if (document.hidden) { viaje.current?.pause(); manos.current?.pause(); } else { viaje.current?.resume(); manos.current?.resume(); }
    };
    window.addEventListener('pointermove', cerca, { passive: true });
    document.addEventListener('visibilitychange', visibilidad);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('pointermove', cerca);
      document.removeEventListener('visibilitychange', visibilidad);
    };
  }, [quieto]);

  // Aplica una reacción: expresión, frase y, si toca, corazones o alejarse.
  const reaccionar = (reaccion) => {
    if (!reaccion) return;
    setPose(reaccion.pose);
    mostrarFrase(reaccion.frase);
    if (reaccion.corazones) setCorazones((valor) => valor + 1);
    limpiar('ocio');
    if (reaccion.tipo === 'siesta') {
      viaje.current?.kill();
      moverManos(false);
      programar('pose', 60000, () => { setPose('curioso'); descansar(); });
      return;
    }
    programar('pose', reaccion.alejarse ? 10000 : POSE_MS, () => setPose('curioso'));
    if (reaccion.alejarse && !quieto) {
      // Nivel 3: se aleja despacio, sin responder unos segundos.
      const m = medidas();
      viajar(elegirDestino({ desde: posicion.current, minimo: m.minimo, maximo: m.maximo, ancho: m.ancho, zonas: zonasOcupadas(m), lejos: true }), descansar);
    } else if (!quieto && reaccion.tipo === 'curiosidad' && figura.current) {
      // Se gira para mirar a quien lo tocó.
      gsap.fromTo(figura.current.querySelector('[data-parte="colgado-toque"]'), { rotation: 0 },
        { rotation: 8, svgOrigin: '490 58', duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' });
    }
  };

  function tocar() {
    // Una presión larga ya fue caricia: no cuenta también como clic.
    if (presion.current.disparada) {
      presion.current.disparada = false;
      return;
    }
    if (viaje.current?.isActive()) { viaje.current.kill(); moverManos(false); descansar(); }
    const { estado, reaccion } = alClic(reglas.current, Date.now());
    reglas.current = estado;
    reaccionar(reaccion);
  }

  function acariciar() {
    const { estado, reaccion } = alAcariciar(reglas.current, Date.now());
    reglas.current = estado;
    reaccionar(reaccion);
  }

  // Caricia con el puntero: quedarse (o moverse suave) sobre la cabeza durante medio segundo.
  function moverSobrePausa(evento) {
    // Con el botón presionado o justo después de un clic no es caricia: son clics sobre la cabeza.
    if (evento.pointerType === 'touch' || evento.buttons) return;
    if (performance.now() - caricia.current.ultimoToque < 1200) return;
    const svg = evento.currentTarget.querySelector('svg');
    const caja = svg.getBoundingClientRect();
    const x = VISTA.x + ((evento.clientX - caja.left) / caja.width) * VISTA.ancho;
    const y = VISTA.y + ((evento.clientY - caja.top) / caja.height) * VISTA.alto;
    const enCabeza = Math.hypot(x - CABEZA.x, y - CABEZA.y) <= CABEZA.radio;
    const ahora = performance.now();
    const previo = caricia.current;
    const velocidad = previo.tiempo ? Math.hypot(evento.clientX - previo.x, evento.clientY - previo.y) / Math.max(1, ahora - previo.tiempo) : 0;
    if (!enCabeza || velocidad > 0.8) {
      caricia.current = { ...previo, desde: 0, x: evento.clientX, y: evento.clientY, tiempo: ahora };
      return;
    }
    const desde = previo.desde || ahora;
    caricia.current = { ...previo, desde, x: evento.clientX, y: evento.clientY, tiempo: ahora };
    if (ahora - desde >= 500) {
      caricia.current.desde = 0;
      acariciar();
    }
  }

  // Presión larga (táctil o mouse): caricia.
  function presionar() {
    caricia.current = { ...caricia.current, desde: 0, ultimoToque: performance.now() };
    clearTimeout(presion.current.temporizador);
    presion.current.disparada = false;
    presion.current.temporizador = setTimeout(() => {
      presion.current.disparada = true;
      acariciar();
    }, PRESION_LARGA_MS);
  }
  const soltar = () => clearTimeout(presion.current.temporizador);

  function teclas(evento) {
    // Con el foco en Pausa, la tecla A (o mantener Enter) es una caricia.
    if (evento.key === 'a' || evento.key === 'A' || (evento.key === 'Enter' && evento.repeat)) {
      evento.preventDefault();
      acariciar();
    }
  }

  // La frase se muestra junto a Pausa, del lado donde hay espacio.
  const haciaIzquierda = (posicion.current ?? tam.maximo) > window.innerWidth / 2;

  return (
    <div className="pausa-paseante-capa" ref={capa} style={{ top: `${tam.borde}px` }} data-quieto={quieto ? '' : undefined}>
      <div className="pausa-paseante" ref={figura} style={{ width: `${tam.ancho}px` }}>
        <button type="button" className="pausa-paseante-boton" aria-label="Pausa, la mascota. Presiona para interactuar"
          aria-describedby="pausa-paseante-ayuda"
          onClick={tocar} onKeyDown={teclas} onPointerMove={moverSobrePausa}
          onPointerDown={presionar} onPointerUp={soltar} onPointerLeave={soltar} onPointerCancel={soltar}
          onContextMenu={(evento) => evento.preventDefault()}>
          <Pausa estado={pose} rama={false} ancho={tam.ancho} parpadeo={false} />
        </button>
        <span id="pausa-paseante-ayuda" className="solo-lector">Mantén presionado o pulsa la tecla A para acariciarlo.</span>
        {corazones > 0 && (
          <span key={corazones} className="pausa-corazones" aria-hidden="true">
            {[0, 1, 2].map((indice) => (
              <svg key={indice} viewBox="0 0 24 22" width="16" height="15"><path d="M12 21C5 15 1 11.5 1 7a5.5 5.5 0 0 1 11-1 5.5 5.5 0 0 1 11 1c0 4.5-4 8-11 14z" /></svg>
            ))}
          </span>
        )}
        {/* La burbuja siempre está montada para que cada frase nueva se anuncie. */}
        <p className={`pausa-paseante-burbuja ${haciaIzquierda ? 'izquierda' : 'derecha'} ${frase ? 'visible' : ''}`} aria-live="polite">{frase}</p>
      </div>
    </div>
  );
}
