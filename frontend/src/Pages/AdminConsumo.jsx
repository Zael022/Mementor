import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import TipoCambio, { CostoEstimado } from '../Componentes/TipoCambio.jsx';
import { useDatos } from '../hooks/useDatos.js';

const RESULTADOS = {
  completed: 'Respondidas con fuentes', no_evidence: 'Sin material que lo respalde', no_citations: 'Sin citas válidas',
  invalid_format: 'Formato inválido', provider_error: 'Falla del proveedor', retrieval_error: 'Falla de búsqueda', cancelled: 'Canceladas', reserved: 'En curso',
};

// Consumo del tutor en la institución: modelo, latencia y tokens informados por el proveedor.
export default function AdminConsumo() {
  const consumo = useDatos('/institution/ai-usage?days=30');
  if (consumo.cargando && !consumo.datos) return <Cargando />;
  if (consumo.error) return <MensajeError error={consumo.error} />;
  const datos = consumo.datos;
  const total = Object.values(datos.byOutcome).reduce((suma, valor) => suma + valor, 0);

  return (
    <>
      <h1>Consumo del tutor</h1>
      <p className="tenue">Últimos {datos.days} días. El registro no guarda preguntas, respuestas ni contenido de documentos.</p>
      <div className="dos-columnas-auto">
        <TipoCambio />
        <CostoEstimado />
      </div>
      <section className="tarjeta">
        <p>Consultas en las últimas 24 h: <strong>{datos.usedLast24h}</strong> de un tope institucional de <strong>{datos.dailyLimit}</strong> (máximo {datos.perUserDailyLimit} por persona).</p>
      </section>
      <section className="tarjeta">
        <h2>Por modelo</h2>
        {datos.byModel.length === 0 && <p className="tenue">Aún no hay respuestas registradas.</p>}
        {datos.byModel.length > 0 && (
          <table className="tabla">
            <thead><tr><th scope="col">Proveedor</th><th scope="col">Modelo</th><th scope="col">Respuestas</th><th scope="col">Tokens de entrada</th><th scope="col">Tokens de salida</th><th scope="col">Latencia media</th></tr></thead>
            <tbody>
              {datos.byModel.map((fila) => (
                <tr key={`${fila.provider}-${fila.model}`}>
                  <td>{fila.provider}</td><td>{fila.model}</td><td>{fila.answers}</td><td>{fila.inputTokens}</td><td>{fila.outputTokens}</td><td>{fila.avgLatencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="tenue pequeno">No se muestran costos: MENTOR no tiene tarifas verificadas del proveedor. Calcúlalos con la tarifa vigente de tu contrato.</p>
      </section>
      <section className="tarjeta">
        <h2>Resultado de las consultas</h2>
        {total === 0 && <p className="tenue">Sin consultas en este periodo.</p>}
        <ul className="lista-simple">
          {Object.entries(datos.byOutcome).map(([clave, valor]) => <li key={clave}><span>{RESULTADOS[clave] || clave}</span><strong>{valor}</strong></li>)}
        </ul>
      </section>
    </>
  );
}
