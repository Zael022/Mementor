import Ilustracion from './Ilustracion.jsx';

// Se muestra cuando todavía no hay registros; con «ilustracion» dibuja una imagen acorde al tema.
export default function EstadoVacio({ titulo, detalle, ilustracion, children }) {
  return (
    <section className="estado-vacio">
      {ilustracion
        ? <Ilustracion tipo={ilustracion} />
        : <div className="figuras" aria-hidden="true"><i /><i /><i /></div>}
      <h2>{titulo}</h2>
      {detalle && <p>{detalle}</p>}
      {children}
    </section>
  );
}
