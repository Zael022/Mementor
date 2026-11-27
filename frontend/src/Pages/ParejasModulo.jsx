import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { anunciar } from '../Componentes/Anunciador.jsx';
import { Confeti } from '../Componentes/Celebracion.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useMascotasVisibles } from '../Componentes/Mascota.jsx';
import OrbiSticker from '../Componentes/OrbiSticker.jsx';
import '../Componentes/Recorrido.css';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { gsap, useGSAP } from '../utils/gsap.js';
import { MENSAJES_PAREJAS } from '../utils/mensajesMascota.js';

const TIPO = { question: 'pregunta', answer: 'respuesta' };
const reloj = (segundos) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
const duracion = (segundos) => (segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min ${String(segundos % 60).padStart(2, '0')} s`);

// Una carta es un botón: boca abajo dice su número; volteada dice si es pregunta o respuesta y su texto.
function Carta({ carta, vista, seleccionada, efecto, alVoltear, alTeclado }) {
  const boton = useRef(null);
  const volteada = Boolean(vista) && (seleccionada || vista.matched);
  const pareja = Boolean(vista?.matched);

  // Giro de la carta con GSAP; con menos movimiento cambia de cara sin girar.
  useGSAP(() => {
    const interior = boton.current.querySelector('.carta-interior');
    if (prefiereMenosMovimiento()) {
      gsap.set(interior, { rotationY: volteada ? 180 : 0 });
      return;
    }
    gsap.to(interior, { rotationY: volteada ? 180 : 0, duration: 0.42, ease: 'power2.out' });
  }, { scope: boton, dependencies: [volteada] });

  // Salto al acertar y sacudida suave al fallar.
  useGSAP(() => {
    if (!efecto || prefiereMenosMovimiento()) return;
    if (efecto.tipo === 'acierto') gsap.fromTo(boton.current, { y: 0 }, { y: -10, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' });
    if (efecto.tipo === 'fallo') gsap.fromTo(boton.current, { x: 0 }, { keyframes: { x: [0, -6, 6, -4, 4, 0] }, duration: 0.42, ease: 'power1.inOut' });
  }, { scope: boton, dependencies: [efecto?.clave] });

  // El nombre repite el texto visible en el mismo orden (WCAG 2.5.3): «Carta 3: Pregunta: …».
  // Los espacios entre las partes no se ven (son elementos flex), pero separan las palabras para las herramientas.
  const tipo = vista?.kind === 'question' ? 'Pregunta' : 'Respuesta';
  const nombre = volteada
    ? `Carta ${carta.position}: ${tipo}: ${vista.text}${pareja ? ' (pareja encontrada)' : ''}`
    : `Carta ${carta.position}, boca abajo`;
  return (
    <li>
      <button ref={boton} type="button" className={`carta ${volteada ? 'volteada' : ''} ${pareja ? 'pareja' : ''}`}
        aria-label={nombre} aria-disabled={pareja || undefined} data-posicion={carta.position}
        onClick={() => alVoltear(carta)} onKeyDown={alTeclado}>
        <span className="carta-interior" aria-hidden="true">
          <span className="carta-cara carta-oculta"><span className="carta-numero">{carta.position}</span></span>{' '}
          <span className={`carta-cara carta-visible ${vista?.kind || ''}`}>
            {vista && (
              <>
                <span className="carta-tipo">
                  {pareja && <svg viewBox="0 0 16 16" width="13" height="13" focusable="false"><path d="M3 8.5l3 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {tipo}
                </span>{' '}
                <span className="carta-texto">{vista.text}</span>
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

// Parejas: práctica del módulo sin nota, sin bono y sin límite de tiempo.
// El servidor guarda el tablero, mide el tiempo y decide si dos cartas forman pareja.
export default function ParejasModulo() {
  const { id: cursoId, moduleId } = useParams();
  const curso = useDatos(`/courses/${cursoId}`);
  const mascotas = useMascotasVisibles();
  const [partida, setPartida] = useState(null);
  const [vistas, setVistas] = useState({});
  const [seleccion, setSeleccion] = useState([]);
  const [efecto, setEfecto] = useState(null);
  const [mensaje, setMensaje] = useState(MENSAJES_PAREJAS.inicio);
  const [estadoOrbi, setEstadoOrbi] = useState('saludo');
  const [resumen, setResumen] = useState(null);
  const [sinPreguntas, setSinPreguntas] = useState(false);
  const [segundos, setSegundos] = useState(0);
  // Tamaño pedido (6 u 8): «Jugar otra vez» repite la misma elección aunque el módulo tenga menos parejas.
  const [pedido, setPedido] = useState(6);
  const { enviando, error, ejecutar } = useEnvio();
  const ocupado = useRef(false);
  const espera = useRef(null);
  const sticker = useRef(null);
  const tablero = useRef(null);
  const volver = `/estudiante/cursos/${cursoId}?seccion=trabajo&ver=lecciones`;
  const modulo = curso.datos?.modules.find((item) => String(item.id) === moduleId);

  const empezar = useCallback(async (pares) => {
    clearTimeout(espera.current);
    setSinPreguntas(false);
    setPedido(pares);
    try {
      const { data } = await api.post(`/modules/${moduleId}/memory-games`, pares ? { pairs: pares } : {});
      setPartida(data);
      setVistas({});
      setSeleccion([]);
      setResumen(null);
      setEstadoOrbi('saludo');
      setMensaje(MENSAJES_PAREJAS.inicio);
      anunciar(`Tablero nuevo con ${data.pairCount} parejas. ${MENSAJES_PAREJAS.inicio}`);
    } catch (fallo) {
      if (fallo.code === 'NOT_ENOUGH_QUESTIONS') setSinPreguntas(true);
      else throw fallo;
    }
  }, [moduleId]);

  // Reloj visible (no presiona): el tiempo oficial lo mide el servidor.
  useEffect(() => {
    if (!partida || resumen) return undefined;
    const inicio = Date.now() - partida.elapsedSeconds * 1000;
    setSegundos(partida.elapsedSeconds);
    const intervalo = setInterval(() => setSegundos(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(intervalo);
  }, [partida, resumen]);

  useEffect(() => () => clearTimeout(espera.current), []);

  // Con cada tablero nuevo el foco va a la primera carta (el botón «Empezar» desaparece al empezar).
  useEffect(() => {
    if (partida?.id) tablero.current?.querySelector('.carta')?.focus();
  }, [partida?.id]);

  async function voltear(carta) {
    const vista = vistas[carta.id];
    if (!partida || resumen || ocupado.current || vista?.matched) return;
    let actual = seleccion;
    // Tras un fallo, la siguiente carta (incluso una de las dos) vuelve a tapar las anteriores sin esperar.
    if (actual.length === 2) {
      clearTimeout(espera.current);
      actual = [];
      setSeleccion([]);
    }
    if (actual.includes(carta.id)) return;
    ocupado.current = true;
    const revelada = await ejecutar(() => api.post(`/memory-games/${partida.id}/reveal`, { cardId: carta.id }));
    if (!revelada) { ocupado.current = false; return; }
    const datos = revelada.data;
    setVistas((previas) => ({ ...previas, [carta.id]: { kind: datos.kind, text: datos.text, matched: false } }));
    anunciar(`Carta ${datos.position}: ${TIPO[datos.kind]}: ${datos.text}`);
    if (actual.length === 0) {
      setSeleccion([carta.id]);
      ocupado.current = false;
      return;
    }

    const pareja = [actual[0], carta.id];
    setSeleccion(pareja);
    const comparacion = await ejecutar(() => api.post(`/memory-games/${partida.id}/match`, { cardIds: pareja }));
    ocupado.current = false;
    if (!comparacion) return;
    const resultado = comparacion.data;
    setPartida((previa) => ({ ...previa, attempts: resultado.attempts, matchedPairs: resultado.matchedPairs }));
    setEfecto({ tipo: resultado.match ? 'acierto' : 'fallo', cartas: pareja, clave: Date.now() });

    if (resultado.match) {
      setVistas((previas) => ({
        ...previas,
        ...Object.fromEntries(resultado.cards.map((item) => [item.id, { kind: item.kind, text: item.text, matched: true }])),
      }));
      setSeleccion([]);
      setMensaje(`${MENSAJES_PAREJAS.acierto} Llevas ${resultado.matchedPairs} de ${resultado.pairCount}.`);
      setEstadoOrbi('animo');
      // La última pareja no salta: el sticker se vuelve a pegar para celebrar el tablero completo.
      if (!resultado.finished) sticker.current?.saltar();
    } else {
      setMensaje(MENSAJES_PAREJAS.fallo);
      // Fallo suave: el papel se arruga, se alisa y Orbi sonríe.
      sticker.current?.arrugar();
      espera.current = setTimeout(() => setSeleccion([]), 1300);
    }

    if (resultado.finished) {
      setResumen({ parejas: resultado.pairCount, intentos: resultado.attempts, segundos: resultado.elapsedSeconds });
      setMensaje(MENSAJES_PAREJAS.final(resultado.pairCount, resultado.attempts));
      setEstadoOrbi('celebrando');
      sticker.current?.pegar();
    }
  }

  // Flechas para moverse por el tablero (además de Tab).
  function moverConTeclado(evento) {
    const pasos = { ArrowRight: 1, ArrowLeft: -1 };
    const botones = [...tablero.current.querySelectorAll('.carta')];
    const columnas = getComputedStyle(tablero.current).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const salto = pasos[evento.key] ?? ({ ArrowDown: columnas, ArrowUp: -columnas }[evento.key]);
    if (!salto) return;
    evento.preventDefault();
    const indice = botones.indexOf(evento.currentTarget);
    botones[Math.min(botones.length - 1, Math.max(0, indice + salto))]?.focus();
  }

  function alTerminarSticker(nombre) {
    if (nombre === 'arrugar') sticker.current?.alisar();
  }

  if (curso.cargando && !curso.datos) return <Cargando texto="Preparando Parejas…" />;
  if (curso.error) return <MensajeError error={curso.error} />;

  if (!modulo) {
    return (
      <>
        <Link to={volver} className="volver">← Volver al mapa</Link>
        <EstadoVacio mascota="dormido" titulo="No encontramos ese módulo" detalle="Vuelve al mapa del curso para elegir otro." />
      </>
    );
  }

  if (sinPreguntas || (!partida && modulo.practicePairs === 0)) {
    return (
      <>
        <Link to={volver} className="volver">← Volver al mapa</Link>
        <h1>Parejas · {modulo.title}</h1>
        <EstadoVacio mascota="dormido" titulo="Este módulo aún no tiene preguntas de práctica"
          detalle="Las preguntas aparecen cuando ya puedes ver las respuestas de una evaluación de este módulo." />
      </>
    );
  }

  return (
    <section className="parejas">
      <Link to={volver} className="volver">← Volver al mapa</Link>
      <div className="parejas-cabecera">
        <div>
          <h1>Parejas · {modulo.title}</h1>
          <p className="tenue">Une cada pregunta con su respuesta. Es práctica: no cambia tu nota ni tu racha, y no hay límite de tiempo.</p>
        </div>
        <div className={`parejas-orbi ${mascotas ? '' : 'sin-mascota'}`}>
          {mascotas && <OrbiSticker ref={sticker} ancho={124} estado={estadoOrbi} animacion={partida ? null : 'pegar'} onTerminar={alTerminarSticker} />}
          <p className={mascotas ? 'burbuja-mascota' : 'mascota-texto'} aria-live="polite">{mensaje}</p>
        </div>
      </div>

      {!partida && (
        <div className="parejas-inicio tarjeta">
          <p>Este módulo tiene <strong>{modulo.practicePairs} parejas</strong> de práctica, con preguntas de evaluaciones cuyas respuestas ya puedes ver.</p>
          <div className="acciones">
            <button type="button" className="boton" disabled={enviando} onClick={() => ejecutar(() => empezar(6))}>
              Empezar {modulo.practicePairs >= 6 ? 'con 6 parejas' : ''}
            </button>
            {modulo.practicePairs >= 8 && (
              <button type="button" className="boton secundario" disabled={enviando} onClick={() => ejecutar(() => empezar(8))}>Empezar con 8 parejas</button>
            )}
          </div>
        </div>
      )}

      {partida && (
        <>
          <ul className="parejas-marcador" aria-label="Marcador">
            <li>Parejas: <strong>{partida.matchedPairs} de {partida.pairCount}</strong></li>
            <li>Intentos: <strong>{partida.attempts}</strong></li>
            <li>Tiempo: <strong aria-hidden="true">{reloj(resumen ? resumen.segundos : segundos)}</strong><span className="solo-lector">{duracion(resumen ? resumen.segundos : segundos)}</span></li>
          </ul>
          <ol className="tablero-parejas" ref={tablero} aria-label="Tablero de Parejas">
            {partida.cards.map((carta) => (
              <Carta key={carta.id} carta={carta} vista={vistas[carta.id] || (carta.matched ? { kind: carta.kind, text: carta.text, matched: true } : null)}
                seleccionada={seleccion.includes(carta.id)} efecto={efecto?.cartas.includes(carta.id) ? efecto : null}
                alVoltear={voltear} alTeclado={moverConTeclado} />
            ))}
          </ol>
        </>
      )}

      {resumen && (
        <section className="parejas-final tarjeta" aria-labelledby="titulo-final">
          <Confeti />
          <h2 id="titulo-final">¡Tablero completo!</h2>
          <ul className="meta">
            <li>{resumen.parejas} parejas</li>
            <li>{resumen.intentos} intentos</li>
            <li>Tiempo: {duracion(resumen.segundos)}</li>
          </ul>
          <div className="acciones">
            <button type="button" className="boton" disabled={enviando} onClick={() => ejecutar(() => empezar(pedido))}>Jugar otra vez</button>
            <Link className="boton secundario" to={volver}>Volver al mapa</Link>
          </div>
        </section>
      )}
      <MensajeError error={error} />
    </section>
  );
}
