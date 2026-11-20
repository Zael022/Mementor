import { useId } from 'react';

// Campo de formulario con su etiqueta asociada.
export default function Campo({ etiqueta, tipo = 'text', valor, alCambiar, ayuda, error, opciones, filas, ...resto }) {
  const id = useId();
  const comunes = { id, value: valor, onChange: (evento) => alCambiar(evento.target.value), 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined, ...resto };

  let control = <input type={tipo} {...comunes} />;
  if (tipo === 'textarea') control = <textarea rows={filas || 4} {...comunes} />;
  if (tipo === 'select') {
    control = (
      <select {...comunes}>
        {opciones.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.texto}</option>)}
      </select>
    );
  }

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {control}
      {ayuda && <small id={`${id}-ayuda`}>{ayuda}</small>}
      {error && <small id={`${id}-error`} role="alert">{error}</small>}
    </div>
  );
}
