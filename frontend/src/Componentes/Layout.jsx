import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Cargando } from './Estados.jsx';
import LimiteErrores from './LimiteErrores.jsx';
import { tituloDe } from '../utils/titulos.js';
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
  const principal = useRef(null);
  const primeraVisita = useRef(true);

  // Al cambiar de página actualiza el título y lleva el foco al contenido, para que los lectores de pantalla anuncien el cambio.
  useEffect(() => {
    document.title = tituloDe(pathname);
    if (primeraVisita.current) {
      primeraVisita.current = false;
      return;
    }
    principal.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  async function salir() {
    await cerrarSesion();
    navegar('/login');
  }

  return (
    <div className="app">
      <a className="saltar" href="#contenido">Saltar al contenido</a>
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
      <main id="contenido" className="contenido" key={pathname} ref={principal} tabIndex={-1}>
        <LimiteErrores><Suspense fallback={<Cargando />}><Outlet /></Suspense></LimiteErrores>
      </main>
    </div>
  );
}
