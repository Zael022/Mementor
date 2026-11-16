import { useState } from 'react';
import Campo from './Campo.jsx';
import { Cargando, MensajeError } from './Estados.jsx';
import Markdown from './Markdown.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';
import { fechaHora } from '../utils/fechas.js';

// Formulario para poner nota y retroalimentación a una entrega.
function Calificar({ entrega, maximo, alGuardar }) {
  const [nota, setNota] = useState(entrega.gradePoints ?? '');
  const [comentario, setComentario] = useState(entrega.feedback || '');
  const { enviando, error, ejecutar } = useEnvio();

  async function guardar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.patch(`/submissions/${entrega.id}/grade`, { gradePoints: Number(nota), feedback: comentario || undefined }));
    if (respuesta) alGuardar();
  }

  return (
    <form className="fila-formulario" onSubmit={guardar}>
      <Campo etiqueta={`Nota (0 a ${maximo})`} tipo="number" min={0} max={maximo} valor={nota} alCambiar={setNota} required />
      <Campo etiqueta="Retroalimentación" valor={comentario} alCambiar={setComentario} maxLength={5000} />
      <button type="submit" className="boton secundario" disabled={enviando}>{entrega.gradePoints === null ? 'Calificar' : 'Actualizar nota'}</button>
      <MensajeError error={error} />
    </form>
  );
}

// Muestra las entregas de cada estudiante matriculado.
export default function RevisionTarea({ tareaId, alCalificar }) {
  const tarea = useDatos(`/assignments/${tareaId}`);
  if (tarea.cargando && !tarea.datos) return <Cargando />;
  if (tarea.error) return <MensajeError error={tarea.error} />;
  const datos = tarea.datos;

  function actualizar() {
    tarea.recargar();
    alCalificar();
  }

  return (
    <div className="subpanel">
      <h4>Instrucciones</h4>
      <Markdown texto={datos.instructions} />
      <h4>Entregas</h4>
      {datos.students.length === 0 && <p className="tenue">No hay estudiantes matriculados en este curso.</p>}
      {datos.students.map((estudiante) => (
        <div className="entrega" key={estudiante.id}>
          <p><strong>{estudiante.displayName}</strong> <span className="tenue pequeno">{estudiante.email}</span></p>
          {estudiante.submission ? (
            <>
              <p className="tenue pequeno">
                Enviada el {fechaHora(estudiante.submission.submittedAt)}
                {datos.dueAt && new Date(estudiante.submission.submittedAt) > new Date(datos.dueAt) ? ' · tardía' : ''}
              </p>
              <p>{estudiante.submission.body}</p>
              {estudiante.submission.linkUrl && <p><a href={estudiante.submission.linkUrl} target="_blank" rel="noopener noreferrer">Abrir enlace adjunto</a></p>}
              <Calificar entrega={estudiante.submission} maximo={datos.maxPoints} alGuardar={actualizar} />
            </>
          ) : (
            <p className="tenue">Sin entregar.</p>
          )}
        </div>
      ))}
    </div>
  );
}
