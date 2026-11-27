import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import AvisoConsentimiento from './AvisoConsentimiento.jsx';
import Logo from './Logo.jsx';
import BarraLateral from './BarraLateral.jsx';
import { Cargando } from './Estados.jsx';
import LimiteErrores from './LimiteErrores.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { tituloDe } from '../utils/titulos.js';
import { rutaConPausa } from '../utils/rutasPausa.js';

// Pausa paseante se carga aparte: no pesa en la carga inicial ni en las páginas donde no aparece.
const PausaPaseante = lazy(() => import('./PausaPaseante.jsx'));

const ROLES = {
  platform_admin: 'Administración de plataforma',
  institution_admin: 'Administración de institución',
  teacher: 'Docente',
  student: 'Estudiante',
  auditor: 'Auditoría',
};

// Estructura tipo aula: barra superior, barra lateral con las clases y el contenido de cada página.
export default function Layout() {
  const { usuario, preferencias } = useSesion();
  const { pathname } = useLocation();
  // Solo estudiantes, en sus páginas generales, con las mascotas visibles y sin esconderla por hoy.
  const conPausa = usuario.role === 'student' && rutaConPausa(pathname)
    && preferencias?.showMascots !== false && !preferencias?.pausaHiddenToday;
  const principal = useRef(null);
  const primeraVisita = useRef(true);
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Al cambiar de página actualiza el título, cierra el menú móvil y lleva el foco al contenido.
  useEffect(() => {
    document.title = tituloDe(pathname);
    setMenuAbierto(false);
    if (primeraVisita.current) {
      primeraVisita.current = false;
      return;
    }
    principal.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className={`app aula ${menuAbierto ? 'menu-abierto' : ''}`}>
      <a className="saltar" href="#contenido">Saltar al contenido</a>
      <header className="cabecera">
        <button type="button" className="boton-menu" aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto}
          aria-controls="barra-lateral" onClick={() => setMenuAbierto((abierto) => !abierto)}>
          <span aria-hidden="true" />
        </button>
        <Logo como={Link} to="/" aria-label="MENTOR IA, ir al inicio" />
        <div className="perfil">
          <Link to="/configuracion" className="perfil-enlace" aria-label="Configuración de tu perfil">
            <Avatar nombre={usuario.displayName} url={usuario.avatarUrl} className="perfil-inicial" />
          </Link>
          <div className="perfil-nombre">
            <strong>{usuario.displayName}</strong>
            <span>{ROLES[usuario.role]}{usuario.institutionName ? `, ${usuario.institutionName}` : ''}</span>
          </div>
        </div>
      </header>
      <div className="aula-cuerpo">
        <BarraLateral />
        <AvisoConsentimiento />
        {/* Velo que cierra el menú al tocar fuera en pantallas angostas. */}
        <div className="velo" aria-hidden="true" onClick={() => setMenuAbierto(false)} />
        <main id="contenido" className="contenido" key={pathname} ref={principal} tabIndex={-1}>
          <LimiteErrores><Suspense fallback={<Cargando />}><Outlet /></Suspense></LimiteErrores>
        </main>
      </div>
      {conPausa && <Suspense fallback={null}><PausaPaseante /></Suspense>}
    </div>
  );
}
