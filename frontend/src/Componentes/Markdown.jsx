// Convierte negritas, cursivas y código en elementos de React (sin HTML crudo).
function enLinea(texto, clave) {
  const partes = texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[S\d{1,2}\])/g).filter(Boolean);
  return partes.map((parte, indice) => {
    const id = `${clave}-${indice}`;
    // Marca de cita del tutor: se ve igual mientras escribe y en la respuesta final.
    if (/^\[S\d{1,2}\]$/.test(parte)) return <sup key={id} className="marca-cita" title={`Fuente ${parte.slice(2, -1)}`}>{parte.slice(2, -1)}</sup>;
    if (parte.startsWith('**')) return <strong key={id}>{parte.slice(2, -2)}</strong>;
    if (parte.startsWith('`')) return <code key={id}>{parte.slice(1, -1)}</code>;
    if (parte.startsWith('*')) return <em key={id}>{parte.slice(1, -1)}</em>;
    return parte;
  });
}

// Muestra Markdown básico de forma segura.
export default function Markdown({ texto }) {
  const bloques = [];
  const lineas = String(texto || '').split('\n');
  let indice = 0;

  while (indice < lineas.length) {
    const linea = lineas[indice];
    const clave = `b${indice}`;

    if (linea.startsWith('```')) {
      const codigo = [];
      indice += 1;
      while (indice < lineas.length && !lineas[indice].startsWith('```')) codigo.push(lineas[indice++]);
      indice += 1;
      bloques.push(<pre key={clave}><code>{codigo.join('\n')}</code></pre>);
    } else if (/^#{1,3} /.test(linea)) {
      const nivel = linea.indexOf(' ');
      const Titulo = `h${nivel + 1}`;
      bloques.push(<Titulo key={clave}>{enLinea(linea.slice(nivel + 1), clave)}</Titulo>);
      indice += 1;
    } else if (/^(\s*[-*] |\s*\d+\. )/.test(linea)) {
      const ordenada = /^\s*\d+\. /.test(linea);
      const elementos = [];
      while (indice < lineas.length && /^(\s*[-*] |\s*\d+\. )/.test(lineas[indice])) {
        elementos.push(<li key={`i${indice}`}>{enLinea(lineas[indice].replace(/^(\s*[-*] |\s*\d+\. )/, ''), `i${indice}`)}</li>);
        indice += 1;
      }
      bloques.push(ordenada ? <ol key={clave}>{elementos}</ol> : <ul key={clave}>{elementos}</ul>);
    } else if (linea.trim() === '') {
      indice += 1;
    } else {
      const parrafo = [];
      while (indice < lineas.length && lineas[indice].trim() !== '' && !/^(#{1,3} |```|\s*[-*] |\s*\d+\. )/.test(lineas[indice])) {
        parrafo.push(lineas[indice++]);
      }
      bloques.push(<p key={clave}>{enLinea(parrafo.join(' '), clave)}</p>);
    }
  }
  return <div className="markdown">{bloques}</div>;
}
