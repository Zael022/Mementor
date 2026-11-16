import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Permite matricular y retirar estudiantes del curso.
export default function CursoMatriculas() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const matriculas = useDatos(`/courses/${id}/enrollments`);
  const disponibles = useDatos(`/courses/${id}/enrollable-students`);
  const [elegido, setElegido] = useState('');
  const { error, ejecutar } = useEnvio();

  function recargar() {
    matriculas.recargar();
    disponibles.recargar();
  }

  async function matricular(evento) {
    evento.preventDefault();
    if (!elegido) return;
    if (await ejecutar(() => api.post(`/courses/${id}/enrollments`, { studentId: Number(elegido) }))) {
      setElegido('');
      recargar();
    }
  }

  async function retirar(matriculaId) {
    if (await ejecutar(() => api.delete(`/courses/${id}/enrollments/${matriculaId}`))) recargar();
  }

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <section className="tarjeta">
        <h2>Matricular estudiante</h2>
        {disponibles.datos?.length > 0 ? (
          <form className="fila-formulario" onSubmit={matricular}>
            <Campo etiqueta="Estudiante" tipo="select" valor={elegido} alCambiar={setElegido}
              opciones={[{ valor: '', texto: 'Selecciona un estudiante' }, ...disponibles.datos.map((persona) => ({ valor: persona.id, texto: `${persona.displayName} (${persona.email})` }))]} />
            <button type="submit" className="boton">Matricular</button>
          </form>
        ) : (
          <p className="tenue">No hay estudiantes disponibles. La administración de la institución debe invitarlos primero.</p>
        )}
        <MensajeError error={error || disponibles.error} />
      </section>

      <MensajeError error={matriculas.error} />
      {matriculas.cargando && <Cargando />}
      {matriculas.datos?.length === 0 && <EstadoVacio titulo="No hay estudiantes matriculados" detalle="Las matrículas aparecerán aquí cuando agregues estudiantes." />}
      {matriculas.datos?.length > 0 && (
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Estudiante</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {matriculas.datos.map((matricula) => (
                <tr key={matricula.id}>
                  <td>{matricula.student.displayName}</td>
                  <td>{matricula.student.email}</td>
                  <td><Insignia estado={matricula.status} /></td>
                  <td>{matricula.status === 'active' && <button type="button" className="boton secundario" onClick={() => retirar(matricula.id)}>Retirar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
