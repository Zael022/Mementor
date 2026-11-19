import { Cargando, MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { colorDeCurso } from '../utils/cursos.js';

function Persona({ persona }) {
  return (
    <li>
      <span className="avatar" style={{ background: colorDeCurso(persona.id) }} aria-hidden="true">{persona.displayName.charAt(0).toUpperCase()}</span>
      <span>{persona.displayName}{persona.isMe && <span className="tenue"> (tú)</span>}</span>
      {persona.email && <span className="tenue pequeno correo">{persona.email}</span>}
    </li>
  );
}

// Docentes y compañeros de la clase.
export default function ListaPersonas({ cursoId }) {
  const personas = useDatos(`/courses/${cursoId}/people`);
  if (personas.cargando && !personas.datos) return <Cargando />;
  if (personas.error) return <MensajeError error={personas.error} />;
  const { teachers: docentes, students: estudiantes } = personas.datos;
  return (
    <div className="personas">
      <section>
        <h2>Docentes</h2>
        <ul className="lista-personas">{docentes.map((persona) => <Persona key={persona.id} persona={persona} />)}</ul>
      </section>
      <section>
        <div className="titulo-con-dato">
          <h2>Compañeros de clase</h2>
          <span className="tenue">{estudiantes.length} {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'}</span>
        </div>
        {estudiantes.length === 0 && <p className="tenue">Todavía no hay estudiantes matriculados.</p>}
        <ul className="lista-personas">{estudiantes.map((persona) => <Persona key={persona.id} persona={persona} />)}</ul>
      </section>
    </div>
  );
}
