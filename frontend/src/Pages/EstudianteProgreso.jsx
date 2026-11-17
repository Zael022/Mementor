import { useState } from 'react';
import { Link } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import MedidorDominio from '../Componentes/MedidorDominio.jsx';
import Recomendaciones from '../Componentes/Recomendaciones.jsx';
import { useDatos } from '../hooks/useDatos.js';

// Muestra el dominio por tema y el historial de intentos del estudiante.
export default function EstudianteProgreso() {
  const cursos = useDatos('/courses?limit=100');
  const [elegido, setElegido] = useState('');
  const cursoId = elegido || cursos.datos?.[0]?.id || null;
  const dominio = useDatos(cursoId ? `/me/mastery?courseId=${cursoId}` : null);
  const recomendaciones = useDatos(cursoId ? `/me/recommendations?courseId=${cursoId}` : null);
  const intentos = useDatos(cursoId ? `/me/attempts?courseId=${cursoId}` : null);

  if (cursos.cargando) return <Cargando />;
  if (cursos.error) return <MensajeError error={cursos.error} />;
  if (cursos.datos.length === 0) {
    return (
      <>
        <h1>Mi progreso</h1>
        <EstadoVacio ilustracion="grafica" titulo="Aún no hay progreso que mostrar" detalle="Tu progreso aparecerá cuando estés matriculado en un curso y resuelvas evaluaciones." />
      </>
    );
  }

  return (
    <>
      <h1>Mi progreso</h1>
      <Campo etiqueta="Curso" tipo="select" valor={cursoId} alCambiar={setElegido}
        opciones={cursos.datos.map((curso) => ({ valor: curso.id, texto: curso.title }))} />
      <MensajeError error={dominio.error || intentos.error} />

      <Recomendaciones lista={recomendaciones.datos} />

      <section className="tarjeta">
        <h2>Dominio por tema</h2>
        <p className="tenue">Estimación calculada con tus respuestas recientes. No es una calificación oficial.</p>
        {dominio.cargando && <Cargando />}
        {dominio.datos?.length === 0 && <p className="tenue">Este curso aún no tiene temas.</p>}
        {dominio.datos?.map((tema) => <MedidorDominio key={tema.topicId} tema={tema} />)}
      </section>

      <section className="tarjeta">
        <h2>Intentos enviados</h2>
        {intentos.cargando && <Cargando />}
        {intentos.datos?.length === 0 && <p className="tenue">Todavía no has enviado evaluaciones en este curso.</p>}
        {intentos.datos?.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Evaluación</th><th>Puntaje</th><th>Resultado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {intentos.datos.map((intento) => (
                  <tr key={intento.attemptId}>
                    <td>{intento.assessmentTitle}</td>
                    <td>{intento.scorePct} %</td>
                    <td>{intento.passed ? 'Aprobado' : 'No aprobado'}</td>
                    <td>{new Date(intento.submittedAt).toLocaleString()}</td>
                    <td><Link to={`/estudiante/resultados/${intento.attemptId}`}>Ver revisión</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
