import { Navigate } from 'react-router-dom';
import { rutaInicial, useSesion } from '../context/SesionContext.jsx';

// Lleva a cada persona a la página inicial de su rol.
export default function Inicio() {
  const { usuario } = useSesion();
  return <Navigate to={usuario ? rutaInicial(usuario.role) : '/login'} replace />;
}
