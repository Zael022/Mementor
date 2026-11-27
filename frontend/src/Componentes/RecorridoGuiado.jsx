import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import Mascota from './Mascota.jsx';

const MARGEN = 8;
const ESPERA_MAXIMA = 2000;

// Espera a que el elemento del paso exista (por ejemplo, después de cambiar de pestaña).
function esperarElemento(selector, cancelado) {
  return new Promise((listo) => {
    const inicio = performance.now();
    const buscar = () => {
      if (cancelado()) return listo(null);
      const elemento = document.querySelector(selector);
      if (elemento && !elemento.closest('[hidden]')) return listo(elemento);
      if (performance.now() - inicio > ESPERA_MAXIMA) return listo(null);
      requestAnimationFrame(buscar);
      return undefined;
    };
    buscar();
  });
}

// Recorrido guiado: resalta una función de la página y explica cómo ayuda a estudiar.
// No bloquea la página; Escape lo cierra y las flechas avanzan o retroceden.
export default function RecorridoGuiado({ pasos, abierto, alCerrar, alPrepararPaso }) {
  const [indice, setIndice] = useState(0);
  const [caja, setCaja] = useState(null);
  const [visibles, setVisibles] = useState(pasos);
  const elemento = useRef(null);
  const titulo = useRef(null);
  const tarjeta = useRef(null);
  const idTitulo = useId();
  const idTexto = useId();
  const menos = prefiereMenosMovimiento();

  // Vuelve al primer paso cada vez que se abre.
  useEffect(() => {
    if (abierto) { setIndice(0); setVisibles(pasos); }
  }, [abierto, pasos]);

  const medir = useCallback(() => {
    if (!elemento.current) return setCaja(null);
    const rect = elemento.current.getBoundingClientRect();
    return setCaja({ top: rect.top - MARGEN, left: rect.left - MARGEN, width: rect.width + MARGEN * 2, height: rect.height + MARGEN * 2 });
  }, []);

  // Prepara el paso (pestaña), busca el elemento y lo lleva a la vista; si no existe, se salta.
  useEffect(() => {
    if (!abierto) return undefined;
    let cancelado = false;
    const paso = visibles[indice];
    (async () => {
      if (!paso) return;
      await alPrepararPaso?.(paso);
      const encontrado = await esperarElemento(paso.objetivo, () => cancelado);
      if (cancelado) return;
      if (!encontrado) {
        // Sin el elemento (por ejemplo, un curso sin quizzes) el paso no tiene qué mostrar.
        setVisibles((lista) => lista.filter((item) => item !== paso));
        return;
      }
      elemento.current = encontrado;
      encontrado.scrollIntoView?.({ block: 'center', behavior: menos ? 'auto' : 'smooth' });
      medir();
      setTimeout(() => { if (!cancelado) { medir(); titulo.current?.focus({ preventScroll: true }); } }, menos ? 0 : 380);
    })();
    return () => { cancelado = true; };
  }, [abierto, indice, visibles, alPrepararPaso, medir, menos]);

  // Si la página se mueve o cambia de tamaño, el resaltado lo sigue.
  useEffect(() => {
    if (!abierto) return undefined;
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', medir); window.removeEventListener('resize', medir); };
  }, [abierto, medir]);

  const total = visibles.length;
  const ultimo = indice >= total - 1;
  const cerrar = useCallback(() => { elemento.current = null; setCaja(null); alCerrar(); }, [alCerrar]);
  const siguiente = useCallback(() => (ultimo ? cerrar() : setIndice((valor) => valor + 1)), [ultimo, cerrar]);
  const anterior = useCallback(() => setIndice((valor) => Math.max(0, valor - 1)), []);

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclado = (evento) => {
      if (evento.key === 'Escape') cerrar();
      if (!tarjeta.current?.contains(document.activeElement)) return;
      if (evento.key === 'ArrowRight') siguiente();
      if (evento.key === 'ArrowLeft') anterior();
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [abierto, cerrar, siguiente, anterior]);

  // Coloca la tarjeta debajo del elemento si cabe; si no, encima. En pantallas angostas va abajo fija (por CSS).
  const [posicion, setPosicion] = useState({});
  useLayoutEffect(() => {
    if (!caja || !tarjeta.current || window.innerWidth < 640) return setPosicion({});
    const alto = tarjeta.current.offsetHeight;
    const ancho = tarjeta.current.offsetWidth;
    const abajo = caja.top + caja.height + 14;
    const top = abajo + alto < window.innerHeight - 12 ? abajo : Math.max(12, caja.top - alto - 14);
    const left = Math.min(Math.max(12, caja.left), window.innerWidth - ancho - 12);
    return setPosicion({ top, left });
  }, [caja, indice]);

  if (!abierto || !total) return null;
  const paso = visibles[Math.min(indice, total - 1)];
  const estadoOrbi = indice === 0 ? 'saludo' : ultimo ? 'celebrando' : 'pensando';

  // Va en un portal sobre <body>: dentro de la página, una animación con transform movería el «fixed».
  return createPortal(
    <div className={`recorrido ${menos ? 'sin-movimiento' : ''}`}>
      {caja && <div className="recorrido-foco" aria-hidden="true" style={caja} />}
      <section ref={tarjeta} className="recorrido-tarjeta" role="dialog" aria-modal="false" aria-labelledby={idTitulo} aria-describedby={idTexto} style={posicion}>
        <div className="recorrido-cabecera">
          <Mascota personaje="orbi" estado={estadoOrbi} tamano="pequeno" />
          <div>
            <p className="recorrido-progreso">Paso {indice + 1} de {total}</p>
            <h2 id={idTitulo} ref={titulo} tabIndex={-1}>{paso.titulo}</h2>
          </div>
        </div>
        <p id={idTexto}>{paso.texto}</p>
        <div className="recorrido-acciones">
          <button type="button" className="enlace-boton" onClick={cerrar}>Saltar recorrido</button>
          <span className="recorrido-flechas">
            {indice > 0 && <button type="button" className="boton secundario" onClick={anterior}>Anterior</button>}
            <button type="button" className="boton" onClick={siguiente}>{ultimo ? 'Terminar' : 'Siguiente'}</button>
          </span>
        </div>
      </section>
    </div>,
    document.body,
  );
}
