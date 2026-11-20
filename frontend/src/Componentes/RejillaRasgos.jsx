import { Revelar } from './Animaciones.jsx';

// Rejilla de características con entrada escalonada; se carga aparte para no sumar GSAP al ingreso.
export default function RejillaRasgos({ rasgos, tarjeta }) {
  const Tarjeta = tarjeta;
  return (
    <div className="rejilla">
      {rasgos.map((rasgo, indice) => (
        <Revelar key={rasgo.titulo} retraso={indice * 0.1}>
          <Tarjeta rasgo={rasgo} />
        </Revelar>
      ))}
    </div>
  );
}
