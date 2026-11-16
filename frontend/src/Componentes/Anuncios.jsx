import { fechaHora } from '../utils/fechas.js';

// Muestra los anuncios del curso, del más reciente al más antiguo.
export default function Anuncios({ lista, alBorrar, vacio = 'No hay anuncios por ahora.' }) {
  if (!lista) return null;
  if (lista.length === 0) return <p className="tenue">{vacio}</p>;

  return (
    <ul className="anuncios">
      {lista.map((anuncio) => (
        <li key={anuncio.id}>
          <div>
            <strong>{anuncio.title}</strong>
            <span className="tenue pequeno">
              {anuncio.courseTitle ? `${anuncio.courseTitle} · ` : ''}{anuncio.author ? `${anuncio.author.displayName} · ` : ''}{fechaHora(anuncio.createdAt)}
            </span>
            <p>{anuncio.body}</p>
          </div>
          {alBorrar && <button type="button" className="boton peligro" onClick={() => alBorrar(anuncio.id)}>Borrar</button>}
        </li>
      ))}
    </ul>
  );
}
