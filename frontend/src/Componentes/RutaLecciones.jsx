import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { leerAvance, olvidarAvance } from '../utils/avanceMapa.js';
import { muestrear, puntoEn, puntosEntre, trazoPor, trazoRecto } from '../utils/caminoMapa.js';
import { fechaHora } from '../utils/fechas.js';
import { gsap } from '../utils/gsapMapa.js';
import { FRASES_MAPA, MENSAJE_MAPA_COMPLETO, mensajeOrbiMapa } from '../utils/mensajesMascota.js';
import EstadoVacio from './EstadoVacio.jsx';
import { useMascotasVisibles, useToqueMascota } from './Mascota.jsx';
import Orbi from './Orbi.jsx';
import Pausa from './Pausa.jsx';
import './Recorrido.css';

// Distancia (en px, sobre el camino) a la que Orbi espera antes de la parada siguiente.
const ESPERA_ORBI = 46;

const porVencimiento = (a, b) => {
  if (a.dueAt && b.dueAt) return new Date(a.dueAt) - new Date(b.dueAt) || a.id - b.id;
  if (a.dueAt || b.dueAt) return a.dueAt ? -1 : 1;
  return a.id - b.id;
};

// Ordena las paradas reales: módulo → tema → lecciones y tareas del tema → Parejas del módulo;
// al final, «Tareas del curso» con las tareas sin tema. Marca la primera pendiente como «siguiente».
export function armarParadas(modulos, tareas = []) {
  const tareasPorTema = new Map();
  const sinTema = [];
  for (const tarea of tareas) {
    if (tarea.topicId) tareasPorTema.set(tarea.topicId, [...(tareasPorTema.get(tarea.topicId) || []), tarea]);
    else sinTema.push(tarea);
  }
  const temas = new Map(modulos.flatMap((modulo) => modulo.topics.map((tema) => [tema.id, {
    titulo: tema.title,
    completo: tema.lessons.every((leccion) => leccion.completed),
  }])));

  let numero = 0;
  const tareaParada = (tarea, tema) => ({
    clave: `tarea-${tarea.id}`, tipo: 'tarea', id: tarea.id, titulo: tarea.title, vence: tarea.dueAt, hecha: Boolean(tarea.submitted), tema,
  });
  const secciones = modulos.map((modulo) => {
    const paradas = [];
    for (const tema of modulo.topics) {
      const pendientesAntes = (tema.prerequisiteIds || []).map((id) => temas.get(id)).filter((previo) => previo && !previo.completo);
      const etiqueta = { titulo: tema.title, recomendados: pendientesAntes.map((previo) => previo.titulo) };
      let primera = true;
      for (const leccion of tema.lessons) {
        numero += 1;
        paradas.push({ clave: `leccion-${leccion.id}`, tipo: 'leccion', id: leccion.id, titulo: leccion.title, numero, hecha: Boolean(leccion.completed), tema: primera ? etiqueta : null });
        primera = false;
      }
      for (const tarea of (tareasPorTema.get(tema.id) || []).sort(porVencimiento)) {
        paradas.push(tareaParada(tarea, primera ? etiqueta : null));
        primera = false;
      }
    }
    if (!paradas.length) paradas.push({ clave: `vacio-${modulo.id}`, tipo: 'vacio' });
    paradas.push({ clave: `parejas-${modulo.id}`, tipo: 'parejas', moduloId: modulo.id, parejas: modulo.practicePairs || 0 });
    return { clave: `modulo-${modulo.id}`, titulo: modulo.title, paradas };
  });
  if (sinTema.length) {
    secciones.push({ clave: 'tareas-curso', titulo: 'Tareas del curso', final: true, paradas: sinTema.sort(porVencimiento).map((tarea) => tareaParada(tarea, null)) });
  }

  const lista = secciones.flatMap((seccion) => seccion.paradas);
  lista.forEach((parada, indice) => { parada.indice = indice; });
  const cuentan = lista.filter((parada) => parada.tipo === 'leccion' || parada.tipo === 'tarea');
  const siguiente = cuentan.find((parada) => !parada.hecha)?.indice ?? -1;
  const ultima = cuentan.length ? cuentan[cuentan.length - 1].indice : -1;
  return { secciones, lista, siguiente, ultima, hayParadas: cuentan.length > 0 };
}

function estadoDe(parada, siguiente) {
  if (parada.tipo === 'parejas') return parada.parejas > 0 ? 'practica' : 'sin-preguntas';
  if (parada.tipo === 'vacio') return 'vacio';
  if (parada.hecha) return 'completada';
  return parada.indice === siguiente ? 'siguiente' : 'pendiente';
}

const TEXTO_ESTADO = { completada: 'Completada', siguiente: 'Continúa aquí', pendiente: 'Pendiente' };

// Íconos del nodo: el estado se distingue por forma y texto, no solo por color.
function IconoNodo({ parada, estado }) {
  const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (estado === 'completada') return <svg viewBox="0 0 24 24" width="24" height="24"><path {...trazo} strokeWidth="3.2" d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (parada.tipo === 'parejas') {
    return (
      <svg viewBox="0 0 24 24" width="26" height="26">
        <rect {...trazo} x="3" y="6" width="10" height="13" rx="2" transform="rotate(-8 8 12.5)" />
        <rect {...trazo} x="11" y="5" width="10" height="13" rx="2" transform="rotate(8 16 11.5)" />
      </svg>
    );
  }
  if (parada.tipo === 'vacio') return <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="5" fill="currentColor" /></svg>;
  if (parada.tipo === 'tarea') {
    return <svg viewBox="0 0 24 24" width="24" height="24"><path {...trazo} d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5zM14 3.5V8h4M9.5 12.5h5M9.5 16h5" /></svg>;
  }
  if (estado === 'siguiente') return <svg viewBox="0 0 24 24" width="24" height="24"><path {...trazo} d="M7 21V4M7 4.5h10l-2.5 3.5L17 11.5H7" /></svg>;
  return <span>{parada.numero}</span>;
}

// Adornos de cada zona del mapa (decorativos): destellos como el de la marca, planetas, nubes, colinas y una constelación.
function Destello({ className }) {
  return <svg className={`adorno destello ${className}`} viewBox="0 0 24 24" width="22" height="22"><path d="M12 1.5c.9 5.6 4.9 9.6 10.5 10.5-5.6.9-9.6 4.9-10.5 10.5C11.1 16.9 7.1 12.9 1.5 12 7.1 11.1 11.1 7.1 12 1.5z" /></svg>;
}
function Planeta({ className }) {
  return (
    <svg className={`adorno planeta ${className}`} viewBox="0 0 60 40" width="60" height="40">
      <circle cx="30" cy="20" r="11" />
      <ellipse cx="30" cy="21" rx="26" ry="7" fill="none" strokeWidth="3" transform="rotate(-14 30 21)" />
    </svg>
  );
}
function Nube({ className }) {
  return <svg className={`adorno nube ${className}`} viewBox="0 0 64 30" width="64" height="30"><path d="M14 28h38a10 10 0 0 0 0-20 14 14 0 0 0-26-2 11 11 0 0 0-12 22z" /></svg>;
}
// Colinas con la silueta variando por zona, para que cada módulo se vea como un terreno distinto.
const COLINAS = [
  ['M0 90V52Q60 18 130 44T260 40T400 34V90Z', 'M0 90V66Q80 40 170 62T330 56T400 60V90Z'],
  ['M0 90V40Q90 10 180 38T400 46V90Z', 'M0 90V62Q70 44 150 66T300 58T400 64V90Z'],
  ['M0 90V48Q50 30 110 46T230 30T400 50V90Z', 'M0 90V68Q100 48 200 70T400 58V90Z'],
  ['M0 90V44Q120 20 220 46T400 36V90Z', 'M0 90V64Q60 50 140 64T280 54T400 66V90Z'],
];
function AdornosZona({ indice }) {
  const [atras, frente] = COLINAS[indice % COLINAS.length];
  return (
    <div className="mapa-adornos" aria-hidden="true">
      <svg className="zona-colinas" viewBox="0 0 400 90" preserveAspectRatio="none">
        <path className="colina-atras" d={atras} />
        <path className="colina-frente" d={frente} />
      </svg>
      <svg className="zona-constelacion" viewBox="0 0 120 70">
        <path d={indice % 2 ? 'M8 50L36 24L70 34L108 10' : 'M10 14L42 40L78 22L110 52'} />
        {(indice % 2 ? [[8, 50], [36, 24], [70, 34], [108, 10]] : [[10, 14], [42, 40], [78, 22], [110, 52]])
          .map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" stroke="none" />)}
      </svg>
      <Destello className="a-1" />
      {indice % 2 ? <Nube className="a-2" /> : <Planeta className="a-2" />}
      <Destello className="a-3" />
      {indice % 2 ? <Planeta className="a-4" /> : <Nube className="a-4" />}
      <Destello className="a-5" />
    </div>
  );
}

// Inicio y meta del recorrido (decorativos; el avance real lo dice el resumen de arriba).
function Bandera() {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 21V3.5M6 4h11l-2.5 3.8L17 11.6H6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Estrella() {
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" /></svg>;
}

function CuerpoParada({ parada, estado, cursoId, mascotas }) {
  if (parada.tipo === 'vacio') {
    return (
      <div className="parada-tarjeta parada-vacia">
        {mascotas && <Pausa estado="dormido" ancho={56} parpadeo={false} viva />}
        <span>Este módulo todavía no tiene lecciones.</span>
      </div>
    );
  }
  if (parada.tipo === 'parejas') {
    if (estado === 'sin-preguntas') {
      return (
        <div className="parada-tarjeta parada-inactiva">
          <span className="parada-tipo">Práctica del módulo</span>
          <strong>Parejas del módulo</strong>
          <small>Este módulo aún no tiene preguntas de práctica. Aparecen cuando ya puedes ver las respuestas de una de sus evaluaciones.</small>
        </div>
      );
    }
    return (
      <Link className="parada-tarjeta parada-enlace" to={`/estudiante/cursos/${cursoId}/parejas/${parada.moduloId}`}
        aria-label={`Práctica del módulo. Parejas del módulo. ${parada.parejas} parejas, no cuenta para la nota`}>
        <span className="parada-tipo">Práctica del módulo</span>{' '}
        <strong>Parejas del módulo</strong>{' '}
        <small className="parada-estado">{parada.parejas} parejas · no cuenta para la nota</small>
      </Link>
    );
  }
  const ruta = parada.tipo === 'leccion' ? `/estudiante/lecciones/${parada.id}` : `/estudiante/tareas/${parada.id}`;
  const tipo = parada.tipo === 'leccion'
    ? `Lección ${parada.numero}`
    : `Tarea${parada.vence ? ` · vence ${fechaHora(parada.vence)}` : ''}`;
  const textoEstado = parada.tipo === 'tarea' && estado === 'completada' ? 'Entregada' : TEXTO_ESTADO[estado];
  return (
    <>
      {parada.tema && (
        <p className="parada-tema">
          Tema: {parada.tema.titulo}
          {parada.tema.recomendados.length > 0 && <small> · Te recomendamos repasar antes: {parada.tema.recomendados.join(', ')}</small>}
        </p>
      )}
      {/* El nombre repite el texto visible con pausas: «Lección 2. Fracciones equivalentes. Continúa aquí».
          Los espacios entre las partes no se ven (es un flex), pero separan las palabras del texto visible. */}
      <Link className="parada-tarjeta parada-enlace" to={ruta} aria-current={estado === 'siguiente' ? 'step' : undefined}
        aria-label={`${tipo}. ${parada.titulo}. ${textoEstado}`}>
        <span className="parada-tipo">{tipo}</span>{' '}
        <strong>{parada.titulo}</strong>{' '}
        <small className="parada-estado">{textoEstado}</small>
      </Link>
    </>
  );
}

// Mapa del curso: una lista ordenada de enlaces reales con un camino SVG decorativo encima.
// Se recorre completo con el teclado y cada parada dice su estado como texto.
export default function RutaLecciones({ modulos, tareas = [], cursoId }) {
  const { secciones, lista, siguiente, ultima, hayParadas } = useMemo(() => armarParadas(modulos, tareas), [modulos, tareas]);
  const mascotas = useMascotasVisibles();
  const ventana = useRef(null);
  const lienzo = useRef(null);
  const orbi = useRef(null);
  const yaCentrado = useRef(false);
  const viajando = useRef(false);
  const [medidas, setMedidas] = useState(null);
  const [saludo, setSaludo] = useState(0);
  const { toque, tocar } = useToqueMascota('orbi');
  const [fraseOrbi, setFraseOrbi] = useState('');
  const esperaFrase = useRef(0);
  useEffect(() => () => clearTimeout(esperaFrase.current), []);
  // Lo que Orbi está mirando en el mapa: hacia qué lado se inclina y qué comenta.
  const [mirada, setMirada] = useState(null);
  const ultimoSaludo = useRef(0);
  const completo = hayParadas && siguiente === -1;
  const cuentanTodas = lista.filter((parada) => parada.tipo === 'leccion' || parada.tipo === 'tarea');
  const hechasTodas = cuentanTodas.filter((parada) => parada.hecha).length;
  const porcentaje = cuentanTodas.length ? Math.round((hechasTodas / cuentanTodas.length) * 100) : 0;
  // Hasta dónde llega el camino lleno: la parada siguiente, o la última si ya se recorrió todo.
  const metaIndice = completo ? ultima : siguiente;

  // Mide dónde quedaron los nodos; se repite solo cuando cambia el tamaño del mapa.
  useLayoutEffect(() => {
    const contenedor = lienzo.current;
    if (!contenedor) return undefined;
    let cuadro = 0;
    const medir = () => {
      const caja = contenedor.getBoundingClientRect();
      const puntos = [...contenedor.querySelectorAll('[data-nodo]')].map((nodo) => {
        const r = nodo.getBoundingClientRect();
        return { x: r.left - caja.left + r.width / 2, y: r.top - caja.top + r.height / 2 };
      });
      const nuevas = { ancho: Math.round(caja.width), alto: Math.round(contenedor.scrollHeight), puntos };
      setMedidas((previas) => (JSON.stringify(previas) === JSON.stringify(nuevas) ? previas : nuevas));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(medir);
    });
    observador.observe(contenedor);
    return () => { observador.disconnect(); cancelAnimationFrame(cuadro); };
  }, [lista]);

  const geometria = useMemo(() => {
    if (!medidas || medidas.puntos.length !== lista.length) return null;
    const { puntos } = medidas;
    const camino = muestrear(puntos);
    const largoMeta = metaIndice > 0 ? camino.largos[metaIndice] : 0;
    // Orbi espera sobre el camino, justo antes de la parada siguiente (o sobre la última si terminó).
    const descanso = metaIndice > 0 && !completo
      ? puntoEn(camino, Math.max(0, largoMeta - ESPERA_ORBI), puntos[0])
      : metaIndice >= 0 ? { x: puntos[metaIndice].x, y: puntos[metaIndice].y - 30 } : null;
    return {
      camino, puntos, largoMeta, descanso,
      base: trazoPor(puntos),
      avance: metaIndice > 0 ? trazoPor(puntos.slice(0, metaIndice + 1)) : '',
    };
  }, [medidas, lista.length, metaIndice, completo]);

  // Ubica a Orbi, centra la ventana en la parada siguiente y, si se acaba de completar algo, recorre el tramo.
  useLayoutEffect(() => {
    if (!geometria || viajando.current) return undefined;
    const { camino, puntos, descanso, largoMeta } = geometria;
    if (!yaCentrado.current && ventana.current && metaIndice >= 0) {
      yaCentrado.current = true;
      ventana.current.scrollTop = Math.max(0, puntos[metaIndice].y - ventana.current.clientHeight / 2);
    }
    const figura = orbi.current;
    if (!figura || !descanso) {
      // Sin Orbi (mascotas ocultas) no hay viaje que mostrar.
      if (!figura) olvidarAvance();
      return undefined;
    }
    gsap.set(figura, { x: descanso.x, y: descanso.y, xPercent: -50, yPercent: -92 });

    const recordada = leerAvance(cursoId);
    if (!recordada) return undefined;
    const desde = lista.findIndex((parada) => parada.clave === recordada);
    if (desde < 0 || desde >= metaIndice || prefiereMenosMovimiento()) {
      olvidarAvance();
      return undefined;
    }
    // Orbi recorre el camino desde la parada recién completada hasta la siguiente, y el camino se llena.
    viajando.current = true;
    // Si el mapa quedó fuera de la vista (se llega desde la lección), primero se acerca para ver el viaje.
    const caja = ventana.current?.getBoundingClientRect();
    const fuera = Boolean(caja) && (caja.top > window.innerHeight * 0.55 || caja.bottom < 120);
    if (fuera) ventana.current.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    const inicio = camino.largos[desde];
    const fin = completo ? largoMeta : Math.max(inicio, largoMeta - ESPERA_ORBI);
    const ruta = trazoRecto(puntosEntre(camino, puntos, inicio, fin));
    const duracion = Math.min(1.6, Math.max(0.7, (fin - inicio) / 260));
    const relleno = lienzo.current.querySelector('.camino-avance');
    const linea = gsap.timeline({
      delay: fuera ? 0.5 : 0,
      onComplete: () => {
        viajando.current = false;
        olvidarAvance();
        gsap.set(relleno, { clearProps: 'strokeDasharray,strokeDashoffset' });
        setSaludo((valor) => valor + 1);
      },
    });
    if (relleno) {
      linea.fromTo(relleno, { strokeDasharray: largoMeta, strokeDashoffset: largoMeta - inicio }, { strokeDashoffset: 0, duration: duracion, ease: 'power1.inOut' }, 0);
    }
    linea.to(figura, { motionPath: { path: ruta }, duration: duracion, ease: 'power1.inOut' }, 0)
      .fromTo(figura.firstChild, { y: 0 }, { y: -7, duration: 0.16, yoyo: true, repeat: Math.max(1, Math.round(duracion / 0.16) - 1), ease: 'sine.out' }, 0);
    return () => { linea.kill(); viajando.current = false; };
  }, [geometria, lista, metaIndice, completo, cursoId]);

  // Al tocar a Orbi en el mapa: reacciona, dice a dónde sigue y lleva el foco a esa parada.
  function tocarOrbi() {
    // El foco que se mueve a la parada no debe disparar otra reacción.
    ultimoSaludo.current = Date.now();
    tocar();
    const meta = siguiente >= 0 ? lista[siguiente] : null;
    setFraseOrbi(mensajeOrbiMapa(meta?.titulo));
    clearTimeout(esperaFrase.current);
    esperaFrase.current = setTimeout(() => setFraseOrbi(''), 4000);
    if (!meta) return;
    const enlace = lienzo.current?.querySelectorAll('.parada')[siguiente]?.querySelector('a');
    enlace?.scrollIntoView?.({ block: 'center', behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth' });
    enlace?.focus({ preventScroll: true });
  }

  // Orbi sigue con la mirada la parada que se señala (puntero o foco del teclado): se inclina hacia ella,
  // la comenta y, de vez en cuando, saluda. Si la parada es la siguiente, da un saltito de ánimo.
  function mirarParada(evento) {
    const fila = evento.target.closest?.('.parada');
    if (!fila || !geometria?.descanso) return;
    const indice = Number(fila.dataset.indice);
    const parada = lista[indice];
    const estado = estadoDe(parada, siguiente);
    const texto = FRASES_MAPA[estado];
    if (!texto || mirada?.clave === parada.clave) return;
    const punto = geometria.puntos[indice];
    const dx = punto.x - geometria.descanso.x;
    setMirada({ clave: parada.clave, texto, lado: dx < -24 ? 'izq' : dx > 24 ? 'der' : 'centro', arriba: punto.y < geometria.descanso.y - 40 });
    if (Date.now() - ultimoSaludo.current > 1400) {
      ultimoSaludo.current = Date.now();
      if (estado === 'siguiente') tocar();
      else setSaludo((valor) => valor + 1);
    }
  }
  function mirarOrbi() {
    setMirada({ clave: 'orbi', texto: completo ? FRASES_MAPA.orbiCompleto : FRASES_MAPA.orbi, lado: 'centro', arriba: false });
  }
  function dejarDeMirar(evento) {
    if (evento.type === 'blur' && lienzo.current?.contains(evento.relatedTarget)) return;
    setMirada(null);
  }

  if (!hayParadas) {
    return (
      <EstadoVacio mascota="leyendo" titulo="Este curso aún no tiene lecciones publicadas"
        detalle="Cuando tu docente publique la primera lección, aquí aparecerá el mapa del recorrido." />
    );
  }

  let lado = 0;
  return (
    <div className="mapa">
      {/* Resumen del recorrido: el mismo avance que dicen las paradas, en una línea. */}
      <div className="mapa-resumen">
        <div className="mapa-resumen-texto">
          <strong>{completo ? `Recorrido completo: ${hechasTodas} de ${cuentanTodas.length}` : `${hechasTodas} de ${cuentanTodas.length} paradas completadas`}</strong>
          <span className="tenue">{completo ? 'Puedes repasar cualquier parada cuando quieras.' : 'Las lecciones y tareas cuentan; Parejas es práctica libre.'}</span>
        </div>
        <div className="mapa-barra" aria-hidden="true"><span style={{ width: `${porcentaje}%` }} /></div>
        <span className="mapa-porcentaje" aria-hidden="true">{porcentaje} %</span>
        <ul className="mapa-leyenda" aria-label="Cómo leer el mapa">
          <li><span className="muestra completada" aria-hidden="true" />Completada</li>
          <li><span className="muestra siguiente" aria-hidden="true" />Siguiente</li>
          <li><span className="muestra pendiente" aria-hidden="true" />Pendiente</li>
          <li><span className="muestra practica" aria-hidden="true" />Práctica</li>
        </ul>
      </div>
      {completo && <p className="mapa-completo" role="status">{MENSAJE_MAPA_COMPLETO}</p>}
      <div className="mapa-ventana" ref={ventana}>
        <div className="mapa-lienzo" ref={lienzo} onPointerOver={mirarParada} onFocus={mirarParada}
          onPointerLeave={dejarDeMirar} onBlur={dejarDeMirar}>
          {geometria && (
            <svg className="mapa-camino" width={medidas.ancho} height={medidas.alto} viewBox={`0 0 ${medidas.ancho} ${medidas.alto}`} aria-hidden="true" focusable="false">
              <path className="camino-base" d={geometria.base} />
              {geometria.avance && <path className="camino-borde" d={geometria.avance} />}
              {geometria.avance && <path className="camino-avance" d={geometria.avance} />}
            </svg>
          )}
          <div className="mapa-hito mapa-inicio" aria-hidden="true"><Bandera />Inicio</div>
          <ol className="mapa-modulos">
            {secciones.map((seccion, indiceSeccion) => {
              const cuentan = seccion.paradas.filter((parada) => parada.tipo === 'leccion' || parada.tipo === 'tarea');
              const hechas = cuentan.filter((parada) => parada.hecha).length;
              const terminado = cuentan.length > 0 && hechas === cuentan.length;
              return (
                <li key={seccion.clave} className={`mapa-modulo zona-${indiceSeccion % 4} ${seccion.final ? 'final' : ''} ${terminado ? 'terminado' : ''}`}>
                  <AdornosZona indice={indiceSeccion} />
                  <div className="mapa-cartel">
                    {!seccion.final && <span className="cartel-numero">Módulo {indiceSeccion + 1}</span>}
                    <h3>{terminado && <span className="cartel-estrella" aria-hidden="true"><Estrella /></span>}{seccion.titulo}</h3>
                    {cuentan.length > 0 && (
                      <span className="cartel-avance">
                        {terminado ? `Completo: ${hechas} de ${cuentan.length}` : `${hechas} de ${cuentan.length} ${cuentan.length === 1 ? 'parada' : 'paradas'}`}
                        <span className="cartel-barra" aria-hidden="true"><span style={{ width: `${Math.round((hechas / cuentan.length) * 100)}%` }} /></span>
                      </span>
                    )}
                  </div>
                  <ol className="mapa-paradas">
                    {seccion.paradas.map((parada) => {
                      const estado = estadoDe(parada, siguiente);
                      lado += 1;
                      return (
                        <li key={parada.clave} className={`parada parada-${parada.tipo} ${estado} lado-${lado % 2 ? 'izq' : 'der'} ${mirada?.clave === parada.clave ? 'mirada' : ''}`}
                          data-indice={parada.indice}>
                          <span className="parada-nodo" data-nodo aria-hidden="true"><IconoNodo parada={parada} estado={estado} /></span>
                          <div className="parada-cuerpo">
                            <CuerpoParada parada={parada} estado={estado} cursoId={cursoId} mascotas={mascotas} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
          <div className={`mapa-hito mapa-meta ${completo ? 'lograda' : ''}`} aria-hidden="true"><Estrella />Meta: Constelación</div>
          {mascotas && geometria?.descanso && (
            <div className="mapa-orbi" ref={orbi} data-mira={mirada?.lado} data-arriba={mirada?.arriba ? '' : undefined}>
              <div>
                <button type="button" className="mascota-toque" onClick={tocarOrbi} onPointerEnter={mirarOrbi} onFocus={mirarOrbi}
                  aria-label={completo ? 'Orbi: celebrar el recorrido' : 'Orbi: ir a la siguiente parada'}>
                  <Orbi estado={completo ? 'celebrando' : 'saludo'} ancho={64} animacion={saludo} parpadeo={false} viva toque={toque} />
                </button>
              </div>
              {/* La frase del toque se anuncia y desaparece sola. El comentario al mirar una parada es solo visual:
                  el nombre de cada tarjeta ya dice su estado. */}
              <p className={`burbuja-mapa ${fraseOrbi ? 'visible' : ''}`} aria-live="polite">{fraseOrbi}</p>
              <p className={`burbuja-mapa comentario ${!fraseOrbi && mirada ? 'visible' : ''}`} aria-hidden="true">{mirada?.texto}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
