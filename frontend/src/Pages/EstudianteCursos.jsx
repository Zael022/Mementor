import { TarjetaInteractiva } from '../Componentes/Animaciones.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';

// Muestra los cursos en los que el estudiante está matriculado.
export default function EstudianteCursos() {
  const cursos = useDatos('/courses?limit=100');

  return (
    <>
      <h1>Mis cursos</h1>
      <MensajeError error={cursos.error} />
      {cursos.cargando && <Cargando texto="Cargando tus clases…" forma="tarjetas" />}
      {cursos.datos?.length === 0 && (
        <EstadoVacio ilustracion="libro" titulo="No hay cursos todavía" detalle="Cuando tu docente o la administración te matricule en un curso publicado, aparecerá aquí." />
      )}
      <div className="rejilla">
        {cursos.datos?.map((curso) => (
          <TarjetaInteractiva key={curso.id} to={`/estudiante/cursos/${curso.id}`}>
            <span className="codigo">{curso.code}</span>
            <h3>{curso.title}</h3>
            {curso.description && <p className="tenue">{curso.description}</p>}
          </TarjetaInteractiva>
        ))}
      </div>
    </>
  );
}
