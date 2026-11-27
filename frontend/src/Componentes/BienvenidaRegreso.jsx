import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MENSAJE_REGRESO, MENSAJE_RITMO, UMBRAL_DIAS_REGRESO } from '../utils/mensajesMascota.js';
import Mascota from './Mascota.jsx';

const CLAVE = 'mentor.regreso-visto';

// Recuerda en esta pestaña que ya se cerró la bienvenida de esta ausencia.
function yaVista(marca) {
  try {
    return window.sessionStorage.getItem(CLAVE) === marca;
  } catch {
    return false;
  }
}

// Pausa da la bienvenida cuando el estudiante vuelve tras varios días sin actividad de aprendizaje.
// Los días salen del servidor (última lección, entrega, evaluación, práctica o tutor), no del inicio de sesión.
export default function BienvenidaRegreso({ actividad, curso }) {
  const marca = actividad?.lastActivityAt ? String(actividad.lastActivityAt) : '';
  const [cerrada, setCerrada] = useState(() => yaVista(marca));
  const ausente = Number.isFinite(actividad?.daysAway) && actividad.daysAway >= UMBRAL_DIAS_REGRESO;
  if (!ausente || cerrada) return null;

  function cerrar() {
    try {
      window.sessionStorage.setItem(CLAVE, marca);
    } catch {
      // Sin almacenamiento, simplemente se oculta hasta recargar.
    }
    setCerrada(true);
  }

  return (
    <section className="bienvenida-regreso" aria-labelledby="titulo-regreso">
      <Mascota personaje="pausa" estado="bienvenida" tamano="mediano" animacion={1} interactiva />
      <div>
        <h2 id="titulo-regreso">{MENSAJE_REGRESO}</h2>
        <p className="tenue">{MENSAJE_RITMO} Tu avance está guardado.</p>
        <div className="acciones">
          {curso && <Link className="boton" to={`/estudiante/cursos/${curso.id}?seccion=trabajo&ver=lecciones`}>Seguir en {curso.title}</Link>}
          <button type="button" className="boton secundario" onClick={cerrar}>Cerrar</button>
        </div>
      </div>
    </section>
  );
}
