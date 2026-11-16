import { Link, NavLink } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';
import { Insignia } from './Estados.jsx';

// Devuelve la ruta base de gestión según el rol.
export function useBaseGestion() {
  const { usuario } = useSesion();
  return usuario.role === 'teacher' ? '/docente' : '/admin';
}

// Muestra el título del curso y las pestañas de gestión.
export default function EncabezadoCurso({ curso }) {
  const base = useBaseGestion();
  const { usuario } = useSesion();
  const raiz = `${base}/cursos/${curso.id}`;

  return (
    <header className="encabezado-curso">
      <Link to={`${base}/cursos`} className="volver">← Volver a cursos</Link>
      <h1>{curso.title} <Insignia estado={curso.status} /></h1>
      <p className="tenue">Código {curso.code}</p>
      <nav className="pestanas" aria-label="Secciones del curso">
        <NavLink to={`${raiz}/contenidos`}>Contenidos</NavLink>
        <NavLink to={`${raiz}/clases`}>Clases</NavLink>
        <NavLink to={`${raiz}/tareas`}>Tareas</NavLink>
        <NavLink to={`${raiz}/evaluaciones`}>Evaluaciones</NavLink>
        <NavLink to={`${raiz}/anuncios`}>Anuncios y materiales</NavLink>
        <NavLink to={`${raiz}/fuentes`}>Fuentes del tutor</NavLink>
        <NavLink to={`${raiz}/matriculas`}>Matrículas</NavLink>
        <NavLink to={`${raiz}/analitica`}>Analítica</NavLink>
        {usuario.role === 'teacher' && <NavLink to={`/docente/tutor/${curso.id}`}>Probar tutor</NavLink>}
      </nav>
    </header>
  );
}
