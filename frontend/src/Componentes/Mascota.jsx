import { useSesion } from '../context/SesionContext.jsx';
import './Recorrido.css';
import Orbi from './Orbi.jsx';
import Pausa from './Pausa.jsx';

// Tamaños de la marca: pequeño (avisos), mediano (tarjetas) y grande (bienvenidas y celebraciones).
export const TAMANOS_MASCOTA = { pequeno: 48, mediano: 120, grande: 200 };

// Indica si la persona dejó visibles las mascotas en Configuración.
export function useMascotasVisibles() {
  const sesion = useSesion();
  return sesion?.preferencias?.showMascots !== false;
}

// Envoltorio común de Orbi y Pausa: dibujo decorativo, burbuja de texto y preferencia de ocultar.
// El dibujo nunca lleva información: el mensaje es texto visible y, si es importante, se anuncia.
export default function Mascota({
  personaje = 'orbi', estado, mensaje, tamano = 'mediano', anunciar = false, animacion = 0, siOculta = null, className = '', alTerminar,
}) {
  const visible = useMascotasVisibles();
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
  return (
    <div className={`mascota mascota-${tamano} ${className}`.trim()} data-personaje={personaje}>
      <Dibujo estado={estado} ancho={ancho} animacion={animacion} alTerminar={alTerminar} />
      {/* La región viva queda montada aunque esté vacía, para que el siguiente mensaje sí se anuncie. */}
      {mensaje !== undefined && <p className="burbuja-mascota" aria-live={anunciar ? 'polite' : undefined}>{mensaje}</p>}
    </div>
  );
}
