// Se muestra cuando todavía no hay registros.
export default function EstadoVacio({ titulo, detalle, children }) {
  return (
    <section className="estado-vacio">
      <div className="figuras" aria-hidden="true"><i /><i /><i /></div>
      <h2>{titulo}</h2>
      {detalle && <p>{detalle}</p>}
      {children}
    </section>
  );
}
