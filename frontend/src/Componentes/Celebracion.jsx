import { useEffect, useRef, useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';
import { mensajeModuloTerminado, mensajeRango, mensajeSubida } from '../utils/mensajesMascota.js';
import { anunciar } from './Anunciador.jsx';
import { useMascotasVisibles } from './Mascota.jsx';
import OrbiSticker from './OrbiSticker.jsx';
import './Recorrido.css';

// Confeti hecho con CSS; se apaga con «menos movimiento» o con celebraciones discretas.
export function Confeti() {
  return (
    <div className="confeti" aria-hidden="true">
      {Array.from({ length: 24 }, (_, indice) => <i key={indice} style={{ '--i': indice }} />)}
    </div>
  );
}

// Celebra un logro real (subir de rango o terminar un módulo). No bloquea la página:
// el sticker se pega, se dobla para mostrar qué sigue y sale volando al cerrar.
export default function Celebracion({ rango, subida = false, modulo = null, alCerrar }) {
  const sesion = useSesion();
  const grandes = sesion?.preferencias?.showBigCelebrations !== false;
  const mascotas = useMascotasVisibles();
  const sticker = useRef(null);
  const [cara, setCara] = useState('logro');
  const titulo = modulo ? mensajeModuloTerminado(modulo) : mensajeSubida(rango);
  const extra = modulo && subida ? `Además, subiste a ${rango.name}.` : null;
  const detalle = mensajeRango(rango);

  // El logro se anuncia una vez, también para lectores de pantalla.
  useEffect(() => { anunciar([titulo, extra].filter(Boolean).join(' ')); }, [titulo, extra]);

  // Doblar: a mitad del doblez cambia el mensaje y el papel se vuelve a abrir.
  function alTerminar(nombre) {
    if (nombre === 'doblar') {
      setCara((actual) => (actual === 'logro' ? 'detalle' : 'logro'));
      sticker.current?.desdoblar();
    }
    if (nombre === 'volar') alCerrar?.();
  }

  function alternar() {
    if (grandes && mascotas && sticker.current) sticker.current.doblar();
    else setCara((actual) => (actual === 'logro' ? 'detalle' : 'logro'));
  }

  function cerrar() {
    if (grandes && mascotas && sticker.current) sticker.current.volar();
    else alCerrar?.();
  }

  if (!grandes) {
    return (
      <section className="celebracion discreta" aria-label="Logro">
        <p><strong>{titulo}</strong> {extra} {detalle}</p>
        <div className="acciones"><button type="button" className="boton secundario" onClick={() => alCerrar?.()}>Cerrar</button></div>
      </section>
    );
  }

  return (
    <section className="celebracion" aria-label="Logro">
      <Confeti />
      {mascotas ? <OrbiSticker ref={sticker} ancho={132} estado="celebrando" animacion="pegar" onTerminar={alTerminar} /> : <span />}
      <div>
        <div aria-live="polite">
          <h2>{cara === 'logro' ? titulo : `Próxima meta: ${rango.next ? rango.next.name : 'recorrido completo'}`}</h2>
          <p>{cara === 'logro' ? (extra || detalle) : detalle}</p>
        </div>
        <div className="acciones">
          <button type="button" className="boton" onClick={alternar}>{cara === 'logro' ? 'Ver qué sigue' : 'Ver el logro'}</button>
          <button type="button" className="boton secundario" onClick={cerrar}>Cerrar</button>
        </div>
      </div>
    </section>
  );
}
