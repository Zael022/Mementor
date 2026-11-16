import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Cargando } from './Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';

// Opciones del menú según el rol.
const MENU = {
  platform_admin: [{ to: '/plataforma/instituciones', texto: 'Instituciones' }, { to: '/admin/auditoria', texto: 'Auditoría' }],
  institution_admin: [
    { to: '/admin/usuarios', texto: 'Usuarios' },
    { to: '/admin/cursos', texto: 'Cursos' },
    { to: '/admin/drive', texto: 'Drive' },
    { to: '/admin/consumo', texto: 'Consumo IA' },
    { to: '/admin/auditoria', texto: 'Auditoría' },
  ],
  teacher: [{ to: '/docente/cursos', texto: 'Mis cursos' }],
  student: [{ to: '/estudiante/inicio', texto: 'Inicio' }, { to: '/estudiante/cursos', texto: 'Mis cursos' }, { to: '/estudiante/progreso', texto: 'Mi progreso' }],
};

const ROLES = {
  platform_admin: 'Administración de plataforma',
  institution_admin: 'Administración de institución',
  teacher: 'Docente',
  student: 'Estudiante',
};

// Muestra la navegación general.
export default function Layout() {
  const { usuario, cerrarSesion } = useSesion();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  async function salir() {
    await cerrarSesion();
    navegar('/login');
  }

  return (
    <div className="app">
      <header className="cabecera">
        <Link to="/" className="marca">MENTOR <span>AI</span></Link>
        <nav aria-label="Navegación principal">
          {MENU[usuario.role].map((opcion) => (
            <NavLink key={opcion.to} to={opcion.to}>{opcion.texto}</NavLink>
          ))}
        </nav>
        <div className="perfil">
          <span className="perfil-inicial" aria-hidden="true">{usuario.displayName.charAt(0).toUpperCase()}</span>
          <div className="perfil-nombre">
            <strong>{usuario.displayName}</strong>
            <span>{ROLES[usuario.role]}{usuario.institutionName ? `, ${usuario.institutionName}` : ''}</span>
          </div>
          <button type="button" className="boton secundario" onClick={salir}>Cerrar sesión</button>
        </div>
      </header>
      {/* La clave reinicia la animación de entrada al cambiar de página. */}
      <main className="contenido" key={pathname}><Suspense fallback={<Cargando />}><Outlet /></Suspense></main>
    </div>
  );
}
