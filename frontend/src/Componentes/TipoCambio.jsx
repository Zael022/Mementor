import { Contador } from './Animaciones.jsx';
import { MensajeError } from './Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';

const colones = (valor) => `₡${Number(valor).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tipo de cambio de referencia del dólar (BCCR, publicado por Hacienda) consultado desde el backend.
export default function TipoCambio() {
  const tipo = useDatos('/indicators/exchange-rate');
  if (tipo.error) return <section className="tarjeta"><h2>Tipo de cambio</h2><MensajeError error={tipo.error} /></section>;
  if (!tipo.datos) return null;
  const { buy, sell, date, stale } = tipo.datos;
  return (
    <section className="tarjeta tipo-cambio" aria-label="Tipo de cambio del dólar">
      <h2>Tipo de cambio del dólar</h2>
      <div className="tipo-cambio-valores">
        <div><span className="tenue pequeno">Compra</span><strong>₡<Contador valor={buy} decimales={2} /></strong></div>
        <div><span className="tenue pequeno">Venta</span><strong>₡<Contador valor={sell} decimales={2} /></strong></div>
      </div>
      <p className="tenue pequeno">Referencia del BCCR publicada por el Ministerio de Hacienda · {date}{stale ? ' · no se pudo actualizar hoy, se muestra el último dato guardado' : ''}</p>
    </section>
  );
}

// Costo estimado de la IA en dólares y colones (solo si la institución configuró las tarifas).
export function CostoEstimado() {
  const costo = useDatos('/institution/ai-cost?days=30');
  if (costo.error) return <MensajeError error={costo.error} />;
  if (!costo.datos) return null;
  const datos = costo.datos;
  return (
    <section className="tarjeta" aria-label="Costo estimado de la IA">
      <h2>Costo estimado de la IA (últimos {datos.days} días)</h2>
      <p>{datos.tokens.runs} usos de IA · {datos.tokens.input.toLocaleString('es-CR')} tokens de entrada · {datos.tokens.output.toLocaleString('es-CR')} de salida</p>
      {datos.priceConfigured ? (
        <p className="costo-grande">
          US${datos.usd.toFixed(2)}{datos.crc !== null && <> ≈ <strong>{colones(datos.crc)}</strong></>}
        </p>
      ) : (
        <p className="tenue">Para estimar el costo, configura en el servidor el precio por millón de tokens de tu modelo (AI_PRICE_INPUT_USD_PER_MTOK y AI_PRICE_OUTPUT_USD_PER_MTOK).</p>
      )}
      {datos.rateError && <p className="tenue pequeno">Sin tipo de cambio: {datos.rateError}</p>}
    </section>
  );
}
