import { NavLink, useLocation } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { colorDeCurso, rutaDeCurso } from '../utils/cursos.js';
import Icono from './Iconos.jsx';

// Enlaces generales de cada rol; las clases se agregan debajo para docentes y estudiantes.
const GENERAL = {
  platform_admin: [
    { to: '/plataforma/instituciones', texto: 'Instituciones', icono: 'instituciones' },
    { to: '/plataforma/crm-instituciones', texto: 'Seguimiento institucional', icono: 'instituciones' },
    { to: '/admin/auditoria', texto: 'Auditoría', icono: 'bitacora' },
    { to: '/admin/gobernanza', texto: 'Gobernanza', icono: 'gobernanza' },
  ],
  institution_admin: [
    { to: '/admisiones', texto: 'Admisiones', icono: 'personas' },
    { to: '/admin/usuarios', texto: 'Usuarios', icono: 'personas' },
    { to: '/admin/cursos', texto: 'Cursos', icono: 'cursos' },
    { to: '/calendario', texto: 'Calendario', icono: 'calendario' },
    { to: '/admin/drive', texto: 'Drive', icono: 'drive' },
    { to: '/admin/consumo', texto: 'Consumo IA', icono: 'consumo' },
    { to: '/asistentes', texto: 'Asistentes IA', icono: 'asistentes' },
    { to: '/admin/auditoria', texto: 'Auditoría', icono: 'bitacora' },
    { to: '/admin/gobernanza', texto: 'Gobernanza', icono: 'gobernanza' },
  ],
  // Auditoría: solo lectura de bitácoras y gobernanza.
  auditor: [
    { to: '/admisiones', texto: 'Embudo de admisiones', icono: 'progreso' },
    { to: '/auditoria/bitacora', texto: 'Bitácora', icono: 'bitacora' },
    { to: '/auditoria/gobernanza', texto: 'Gobernanza', icono: 'gobernanza' },
    { to: '/asistentes', texto: 'Asistentes IA', icono: 'asistentes' },
  ],
  teacher: [
    { to: '/admisiones/candidatos', texto: 'Admisiones asignadas', icono: 'personas' },
    { to: '/docente/cursos', texto: 'Página principal', icono: 'inicio' },
    { to: '/calendario', texto: 'Calendario', icono: 'calendario' },
    { to: '/pendientes', texto: 'Por revisar', icono: 'revisar' },
    { to: '/asistentes', texto: 'Asistentes IA', icono: 'asistentes' },
  ],
  student: [
    { to: '/estudiante/inicio', texto: 'Página principal', icono: 'inicio' },
    { to: '/calendario', texto: 'Calendario', icono: 'calendario' },
    { to: '/pendientes', texto: 'Pendientes', icono: 'pendientes' },
    { to: '/estudiante/plan', texto: 'Mi plan', icono: 'plan' },
    { to: '/estudiante/progreso', texto: 'Mi progreso', icono: 'progreso' },
    { to: '/asistentes', texto: 'Asistentes IA', icono: 'asistentes' },
  ],
};

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

      {/* Cerrar sesión y los documentos legales están dentro de Configuración. */}
      <ul className="barra-pie">
        <li><NavLink to="/configuracion"><Icono nombre="ajustes" />Configuración</NavLink></li>
      </ul>
    </nav>
  );
}
