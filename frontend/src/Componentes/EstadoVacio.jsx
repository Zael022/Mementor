import Ilustracion from './Ilustracion.jsx';
import { useMascotasVisibles } from './Mascota.jsx';
import Pausa from './Pausa.jsx';

// Se muestra cuando todavía no hay registros; con «ilustracion» dibuja una imagen acorde al tema.
// Con «mascota» (un estado de Pausa) el estado vacío es tranquilo; si las mascotas están ocultas, vuelve a la ilustración.
export default function EstadoVacio({ titulo, detalle, ilustracion, mascota, children }) {
  const mascotas = useMascotasVisibles();
  let figura = <div className="figuras" aria-hidden="true"><i /><i /><i /></div>;
  if (ilustracion) figura = <Ilustracion tipo={ilustracion} />;
  if (mascota && mascotas) figura = <span className="ilustracion figura-mascota"><Pausa estado={mascota} ancho={96} parpadeo={false} /></span>;
  return (
    <section className="estado-vacio">
      {figura}
      <h2>{titulo}</h2>
      {detalle && <p>{detalle}</p>}
      {children}
    </section>
  );
}
