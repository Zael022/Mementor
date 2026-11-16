import { useState } from 'react';
import Campo from './Campo.jsx';
import { MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Permite a la administración asignar docentes al curso.
export default function DocentesCurso({ curso, alCambiar }) {
  const docentes = useDatos('/users?role=teacher&limit=100');
  const [elegido, setElegido] = useState('');
  const { error, ejecutar } = useEnvio();
  const asignados = new Set(curso.teachers.map((docente) => docente.id));
  const disponibles = (docentes.datos || []).filter((docente) => !asignados.has(docente.id) && docente.status !== 'disabled');

  async function asignar(evento) {
    evento.preventDefault();
    if (!elegido) return;
    if (await ejecutar(() => api.post(`/courses/${curso.id}/teachers`, { userId: Number(elegido) }))) {
      setElegido('');
      alCambiar();
    }
  }

  async function quitar(docenteId) {
    if (await ejecutar(() => api.delete(`/courses/${curso.id}/teachers/${docenteId}`))) alCambiar();
  }

  return (
    <div className="subpanel">
      <h3>Docentes asignados</h3>
      {curso.teachers.length === 0 && <p className="tenue">Este curso aún no tiene docentes asignados.</p>}
      <ul className="lista-simple">
        {curso.teachers.map((docente) => (
          <li key={docente.id}>
            <span>{docente.displayName} · {docente.email}</span>
            <button type="button" className="boton secundario" onClick={() => quitar(docente.id)}>Quitar</button>
          </li>
        ))}
      </ul>
      {disponibles.length > 0 ? (
        <form className="fila-formulario" onSubmit={asignar}>
          <Campo etiqueta="Docente" tipo="select" valor={elegido} alCambiar={setElegido}
            opciones={[{ valor: '', texto: 'Selecciona un docente' }, ...disponibles.map((docente) => ({ valor: docente.id, texto: `${docente.displayName} (${docente.email})` }))]} />
          <button type="submit" className="boton secundario">Asignar</button>
        </form>
      ) : (
        <p className="tenue">No hay más docentes disponibles. Invítalos desde Usuarios.</p>
      )}
      <MensajeError error={error || docentes.error} />
    </div>
  );
}
