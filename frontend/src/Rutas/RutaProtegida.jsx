import { Navigate, Outlet } from 'react-router-dom';
import { Cargando } from '../Componentes/Estados.jsx';
import { rutaInicial, useSesion } from '../context/SesionContext.jsx';

// Permite el paso solo a personas con sesión y con el rol indicado.
export default function RutaProtegida({ roles }) {
  const { usuario, cargando } = useSesion();
  if (cargando) return <Cargando texto="Verificando sesión…" />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.role)) return <Navigate to={rutaInicial(usuario.role)} replace />;
  return <Outlet />;
}
