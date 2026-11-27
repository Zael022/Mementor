import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import { leerAvance, olvidarAvance } from '../utils/avanceMapa.js';
import { muestrear, puntoEn, puntosEntre, trazoPor, trazoRecto } from '../utils/caminoMapa.js';
import { fechaHora } from '../utils/fechas.js';
import { gsap } from '../utils/gsapMapa.js';
import { MENSAJE_MAPA_COMPLETO } from '../utils/mensajesMascota.js';
import EstadoVacio from './EstadoVacio.jsx';
import { useMascotasVisibles } from './Mascota.jsx';
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

function CuerpoParada({ parada, estado, cursoId, mascotas }) {
  if (parada.tipo === 'vacio') {
    return (
      <div className="parada-tarjeta parada-vacia">
        {mascotas && <Pausa estado="dormido" ancho={56} parpadeo={false} />}
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
  const completo = hayParadas && siguiente === -1;
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

  if (!hayParadas) {
    return (
      <EstadoVacio mascota="leyendo" titulo="Este curso aún no tiene lecciones publicadas"
        detalle="Cuando tu docente publique la primera lección, aquí aparecerá el mapa del recorrido." />
    );
  }

  let lado = 0;
  return (
    <div className="mapa">
      {completo && <p className="mapa-completo" role="status">{MENSAJE_MAPA_COMPLETO}</p>}
      <div className="mapa-ventana" ref={ventana}>
        <div className="mapa-lienzo" ref={lienzo}>
          {geometria && (
            <svg className="mapa-camino" width={medidas.ancho} height={medidas.alto} viewBox={`0 0 ${medidas.ancho} ${medidas.alto}`} aria-hidden="true" focusable="false">
              <path className="camino-base" d={geometria.base} />
              {geometria.avance && <path className="camino-borde" d={geometria.avance} />}
              {geometria.avance && <path className="camino-avance" d={geometria.avance} />}
            </svg>
          )}
          <ol className="mapa-modulos">
            {secciones.map((seccion) => {
              const cuentan = seccion.paradas.filter((parada) => parada.tipo === 'leccion' || parada.tipo === 'tarea');
              const hechas = cuentan.filter((parada) => parada.hecha).length;
              return (
                <li key={seccion.clave} className={`mapa-modulo ${seccion.final ? 'final' : ''}`}>
                  <div className="mapa-cartel">
                    <h3>{seccion.titulo}</h3>
                    {cuentan.length > 0 && (
                      <span>{hechas === cuentan.length ? `Completo: ${hechas} de ${cuentan.length}` : `${hechas} de ${cuentan.length} ${cuentan.length === 1 ? 'parada' : 'paradas'}`}</span>
                    )}
                  </div>
                  <ol className="mapa-paradas">
                    {seccion.paradas.map((parada) => {
                      const estado = estadoDe(parada, siguiente);
                      lado += 1;
                      return (
                        <li key={parada.clave} className={`parada parada-${parada.tipo} ${estado} lado-${lado % 2 ? 'izq' : 'der'}`}>
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
          {mascotas && geometria?.descanso && (
            <div className="mapa-orbi" ref={orbi} aria-hidden="true">
              <div><Orbi estado={completo ? 'celebrando' : 'saludo'} ancho={64} animacion={saludo} parpadeo={false} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
