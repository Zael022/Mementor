import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';
import { colorDeCurso } from '../utils/cursos.js';
import { Insignia } from './Estados.jsx';

// Devuelve la ruta base de gestión según el rol.
export function useBaseGestion() {
  const { usuario } = useSesion();
  return usuario.role === 'teacher' ? '/docente' : '/admin';
}

// Pestañas de la clase para quien la gestiona; las de estudiante viven en su propia vista.
const PESTANAS = [
  ['anuncios', 'Novedades'],
  ['contenidos', 'Trabajo en clase'],
  ['tareas', 'Tareas'],
  ['evaluaciones', 'Evaluaciones'],
  ['quizzes', 'Quizzes'],
  ['clases', 'Clases en vivo'],
  ['matriculas', 'Personas'],
  ['calificaciones', 'Calificaciones'],
  ['fuentes', 'Fuentes del tutor'],
  ['analitica', 'Analítica'],
];

// Banner con el color de la clase y las pestañas de gestión.
export default function EncabezadoCurso({ curso }) {
  const base = useBaseGestion();
  const { usuario } = useSesion();
  const raiz = `${base}/cursos/${curso.id}`;
  const pestanas = useRef(null);

  // Si las pestañas no caben, desplaza la barra para que se vea la activa.
  useEffect(() => {
    pestanas.current?.querySelector('a.active')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, []);

  return (
    <header className="encabezado-curso">
      <Link to={`${base}/cursos`} className="volver">← Volver a las clases</Link>
      <div className="banner banner-clase" style={{ '--color-clase': colorDeCurso(curso.id) }}>
        <div>
          <span className="pildora clara">{curso.code}</span>
          <h1>{curso.title} <Insignia estado={curso.status} /></h1>
          {curso.description && <p>{curso.description}</p>}
        </div>
        {usuario.role === 'teacher' && <Link className="boton secundario" to={`/docente/tutor/${curso.id}`}>Probar tutor</Link>}
      </div>
      <nav className="pestanas" aria-label="Secciones de la clase" ref={pestanas}>
        {PESTANAS.map(([ruta, texto]) => <NavLink key={ruta} to={`${raiz}/${ruta}`}>{texto}</NavLink>)}
      </nav>
    </header>
  );
}
