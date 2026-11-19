// Figuras y colores de cada opción, para distinguirlas también sin depender del color.
const FIGURAS = [
  { nombre: 'triángulo', clase: 'rojo', d: 'M12 3l10 18H2z' },
  { nombre: 'rombo', clase: 'azul', d: 'M12 2l10 10-10 10L2 12z' },
  { nombre: 'círculo', clase: 'amarillo', d: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z' },
  { nombre: 'cuadrado', clase: 'verde', d: 'M3 3h18v18H3z' },
];

// Botones grandes de respuesta; tras responder marcan la correcta y la elegida.
export default function OpcionesQuiz({ opciones, alElegir, elegida = null, correcta = null, bloqueada = false }) {
  const revelada = correcta !== null;
  return (
    <div className="opciones-quiz" role="group" aria-label="Opciones de respuesta">
      {opciones.map((opcion, indice) => {
        const figura = FIGURAS[indice % FIGURAS.length];
        let estado = '';
        if (revelada && opcion.id === correcta) estado = 'correcta';
        else if (revelada && opcion.id === elegida) estado = 'incorrecta';
        else if (revelada) estado = 'atenuada';
        return (
          <button key={opcion.id} type="button" className={`opcion-quiz ${figura.clase} ${estado}`} disabled={bloqueada || revelada}
            onClick={() => alElegir(opcion.id)} aria-pressed={elegida === opcion.id}>
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path d={figura.d} /></svg>
            <span>{opcion.body}</span>
            {estado === 'correcta' && <span className="solo-lector"> (respuesta correcta)</span>}
            {estado === 'incorrecta' && <span className="solo-lector"> (tu respuesta, incorrecta)</span>}
          </button>
        );
      })}
    </div>
  );
}
