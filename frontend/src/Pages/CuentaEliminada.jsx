import { Link } from 'react-router-dom';
import Portada from '../Componentes/Portada.jsx';

// Confirmación pública después de procesar la baja.
export default function CuentaEliminada() {
  return (
    <Portada titulo="Cuenta eliminada">
      <p>Procesamos tu solicitud de baja: tu cuenta quedó anonimizada y tu sesión se cerró.</p>
      <p className="tenue">Te enviamos una confirmación al correo que usabas. Se conservan, sin tu nombre ni tu correo, las calificaciones que la institución debe mantener como historial académico.</p>
      <Link className="boton" to="/login">Ir al inicio</Link>
    </Portada>
  );
}
