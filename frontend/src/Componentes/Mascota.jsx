import { useEffect, useRef, useState } from 'react';
import { useSesion } from '../context/SesionContext.jsx';
import { FRASE_DESPIERTA, FRASES_TOQUE } from '../utils/mensajesMascota.js';
import './Recorrido.css';
import Orbi from './Orbi.jsx';
import Pausa from './Pausa.jsx';

// Tamaños de la marca: pequeño (avisos), mediano (tarjetas) y grande (bienvenidas y celebraciones).
export const TAMANOS_MASCOTA = { pequeno: 48, mediano: 120, grande: 200 };
const NOMBRES = { orbi: 'Orbi', pausa: 'Pausa' };
// Tiempo que se ve la frase del toque antes de volver al mensaje normal.
const FRASE_MS = 4200;

// Indica si la persona dejó visibles las mascotas en Configuración.
export function useMascotasVisibles() {
  const sesion = useSesion();
  return sesion?.preferencias?.showMascots !== false;
}

// Al tocar a la mascota: reacciona y dice una frase corta (se anuncia a los lectores de pantalla).
export function useToqueMascota(personaje, estado) {
  const [toque, setToque] = useState(0);
  const [frase, setFrase] = useState(null);
  const temporizador = useRef(0);
  useEffect(() => () => clearTimeout(temporizador.current), []);
  function tocar() {
    const frases = FRASES_TOQUE[personaje];
    const siguiente = toque + 1;
    setToque(siguiente);
    setFrase(personaje === 'pausa' && estado === 'dormido' && siguiente === 1 ? FRASE_DESPIERTA : frases[(siguiente - 1) % frases.length]);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setFrase(null), FRASE_MS);
  }
  return { toque, frase, tocar };
}

// Envoltorio común de Orbi y Pausa: dibujo decorativo, burbuja de texto y preferencia de ocultar.
// El dibujo nunca lleva información: el mensaje es texto visible y, si es importante, se anuncia.
// Con «interactiva», la mascota es un botón: mira al puntero, se mueve en reposo y responde al tocarla.
export default function Mascota({
  personaje = 'orbi', estado, mensaje, tamano = 'mediano', anunciar = false, animacion = 0, siOculta = null, className = '', alTerminar, rama = true,
  interactiva = false,
}) {
  const visible = useMascotasVisibles();
  const { toque, frase, tocar } = useToqueMascota(personaje, estado);
  // Pausa cuelga de una rama ancha: se dibuja un poco más grande para que el personaje mida lo mismo que Orbi.
  const ancho = Math.round((TAMANOS_MASCOTA[tamano] || TAMANOS_MASCOTA.mediano) * (personaje === 'pausa' ? 1.35 : 1));

  if (!visible) {
    // Al ocultarlas, un mensaje útil puede quedar como texto normal.
    if (siOculta === 'mensaje' && mensaje) {
      return <p className={`mascota-texto ${className}`.trim()} aria-live={anunciar ? 'polite' : undefined}>{mensaje}</p>;
    }
    return null;
  }

  const Dibujo = personaje === 'pausa' ? Pausa : Orbi;
  const dibujo = (
    <Dibujo estado={estado} ancho={ancho} animacion={animacion} alTerminar={alTerminar} viva={interactiva} toque={toque}
      {...(personaje === 'pausa' ? { rama } : {})} />
  );
  const texto = frase ?? mensaje;
  return (
    <div className={`mascota mascota-${tamano} ${interactiva ? 'mascota-interactiva' : ''} ${className}`.replace(/\s+/g, ' ').trim()} data-personaje={personaje}>
      {interactiva
        ? <button type="button" className="mascota-toque" onClick={tocar} aria-label={`Saludar a ${NOMBRES[personaje]}`}>{dibujo}</button>
        : dibujo}
      {/* La región viva queda montada aunque esté vacía, para que el siguiente mensaje sí se anuncie. */}
      {(mensaje !== undefined || interactiva) && (
        <p className={`burbuja-mascota ${frase ? 'burbuja-toque' : ''}`.trim()} aria-live={anunciar || interactiva ? 'polite' : undefined}>{texto ?? ''}</p>
      )}
    </div>
  );
}
