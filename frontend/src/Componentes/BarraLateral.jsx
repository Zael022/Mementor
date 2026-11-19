import { NavLink, useLocation } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { colorDeCurso, rutaDeCurso } from '../utils/cursos.js';

// Enlaces generales de cada rol; las clases se agregan debajo para docentes y estudiantes.
const GENERAL = {
  platform_admin: [
    { to: '/plataforma/instituciones', texto: 'Instituciones', icono: 'casa' },
    { to: '/admin/auditoria', texto: 'Auditoría', icono: 'lista' },
  ],
  institution_admin: [
    { to: '/admin/usuarios', texto: 'Usuarios', icono: 'personas' },
    { to: '/admin/cursos', texto: 'Cursos', icono: 'casa' },
    { to: '/calendario', texto: 'Calendario', icono: 'calendario' },
    { to: '/admin/drive', texto: 'Drive', icono: 'carpeta' },
    { to: '/admin/consumo', texto: 'Consumo IA', icono: 'grafica' },
    { to: '/admin/auditoria', texto: 'Auditoría', icono: 'lista' },
  ],
  teacher: [
    { to: '/docente/cursos', texto: 'Página principal', icono: 'casa' },
    { to: '/calendario', texto: 'Calendario', icono: 'calendario' },
    { to: '/pendientes', texto: 'Por revisar', icono: 'lista' },
  ],
  student: [
    { to: '/estudiante/inicio', texto: 'Página principal', icono: 'casa' },
    { to: '/calendario', texto: 'Calendario', icono: 'calendario' },
    { to: '/pendientes', texto: 'Pendientes', icono: 'lista' },
    { to: '/estudiante/progreso', texto: 'Mi progreso', icono: 'grafica' },
  ],
};

// Íconos lineales propios, decorativos.
const ICONOS = {
  casa: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  calendario: 'M5 6h14v14H5zM5 10h14M9 3v5M15 3v5',
  lista: 'M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1',
  personas: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M21 20c0-2.5-2-4.4-4.5-4.9',
  carpeta: 'M3 7h7l2 2h9v10H3z',
  grafica: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .4-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 1.9L6 8.4 4 8 3 11l2 1v0l-2 1 1 3 2-.4 1.5 1.5L7 19l3 1 1-2h2l1 2 3-1-.5-1.9 1.5-1.5 2 .4 1-3z',
};

function Icono({ nombre }) {
  return (
    <svg className="icono" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={ICONOS[nombre]} />
    </svg>
  );
}

// Barra lateral tipo aula: accesos generales, la lista de clases y la configuración.
export default function BarraLateral() {
  const { usuario } = useSesion();
  const { pathname } = useLocation();
  const conClases = usuario.role === 'teacher' || usuario.role === 'student';
  const cursos = useDatos(conClases ? '/courses?limit=100' : null);

  return (
    <nav id="barra-lateral" className="barra-lateral" aria-label="Navegación principal">
      <ul>
        {GENERAL[usuario.role].map((opcion) => (
          <li key={opcion.to}><NavLink to={opcion.to} end={opcion.to.endsWith('/cursos')}><Icono nombre={opcion.icono} />{opcion.texto}</NavLink></li>
        ))}
      </ul>

      {conClases && (
        <>
          <h2 className="barra-titulo">{usuario.role === 'teacher' ? 'Clases que impartes' : 'Clases que cursas'}</h2>
          <ul className="barra-clases">
            {cursos.datos?.length === 0 && <li className="tenue pequeno barra-vacia">Aún no tienes clases.</li>}
            {cursos.datos?.map((curso) => (
              <li key={curso.id}>
                {/* La clase queda marcada en cualquiera de sus pestañas. */}
                <NavLink to={rutaDeCurso(usuario.role, curso.id)}
                  className={pathname.match(new RegExp(`/cursos/${curso.id}(/|$)`)) ? 'active' : undefined}>
                  <span className="inicial-curso" style={{ background: colorDeCurso(curso.id) }} aria-hidden="true">{curso.title.charAt(0).toUpperCase()}</span>
                  <span className="nombre-curso">{curso.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </>
      )}

      <ul className="barra-pie">
        <li><NavLink to="/configuracion"><Icono nombre="ajustes" />Configuración</NavLink></li>
      </ul>
    </nav>
  );
}
