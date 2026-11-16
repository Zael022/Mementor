const TIPOS = { reinforce: 'Reforzar', practice: 'Practicar', advance: 'Avanzar' };

// Muestra cada recomendación junto con la evidencia que la explica.
export default function Recomendaciones({ lista }) {
  if (!lista || lista.length === 0) return null;
  return (
    <section className="tarjeta destacada">
      <h2>Recomendaciones para ti</h2>
      <ul className="recomendaciones">
        {lista.map((item) => (
          <li key={item.id}>
            <span className={`insignia ${item.type}`}>{TIPOS[item.type]}</span>
            <div>
              <strong>{item.topic.title}</strong>
              <p><span className="tenue">¿Por qué?</span> {item.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
