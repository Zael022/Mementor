import { Link } from 'react-router-dom';

// Muestra las lecciones como una ruta numerada que se llena con el avance del estudiante.
export default function RutaLecciones({ modulos }) {
  const todas = modulos.flatMap((modulo) => modulo.topics.flatMap((tema) => tema.lessons));
  const numeros = new Map(todas.map((leccion, indice) => [leccion.id, indice + 1]));
  const siguiente = todas.find((leccion) => !leccion.completed);
  const titulos = new Map(modulos.flatMap((modulo) => modulo.topics.map((tema) => [tema.id, tema.title])));

  return modulos.map((modulo) => {
    const delModulo = modulo.topics.flatMap((tema) => tema.lessons);
    const hechas = delModulo.filter((leccion) => leccion.completed).length;
    return (
      <section className="ruta-modulo" key={modulo.id}>
        <h2>{modulo.title} <small>{hechas} de {delModulo.length} lecciones</small></h2>
        {modulo.topics.length === 0 && <p className="tenue">Este módulo aún no tiene temas.</p>}
        {modulo.topics.map((tema) => (
          <div className="ruta-tema" key={tema.id}>
            <h3>{tema.title}</h3>
            {tema.learningObjective && <p className="tenue">{tema.learningObjective}</p>}
            {tema.prerequisiteIds.length > 0 && (
              <p className="tenue pequeno">Conviene dominar antes: {tema.prerequisiteIds.map((previo) => titulos.get(previo)).join(', ')}</p>
            )}
            {tema.lessons.length === 0 && <p className="tenue">No hay lecciones publicadas en este tema.</p>}
            <ol className="ruta">
              {tema.lessons.map((leccion) => {
                const estado = leccion.completed ? 'completada' : leccion.id === siguiente?.id ? 'siguiente' : '';
                return (
                  <li className={`ruta-paso ${estado}`} key={leccion.id}>
                    <span className="ruta-nodo" aria-hidden="true">{leccion.completed ? '✓' : numeros.get(leccion.id)}</span>
                    <Link className="ruta-enlace" to={`/estudiante/lecciones/${leccion.id}`}>
                      {leccion.title}
                      <small>{leccion.completed ? 'Completada' : estado === 'siguiente' ? 'Continúa aquí' : 'Pendiente'}</small>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    );
  });
}
