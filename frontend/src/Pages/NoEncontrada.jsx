import { Link } from 'react-router-dom';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';

// Página para direcciones que no existen o que el rol actual no tiene.
export default function NoEncontrada() {
  return (
    <EstadoVacio
      titulo="No encontramos esta página"
      detalle="La dirección no existe o no está disponible para tu cuenta."
      ilustracion="busqueda"
    >
      <Link className="boton" to="/">Volver al inicio</Link>
    </EstadoVacio>
  );
}
