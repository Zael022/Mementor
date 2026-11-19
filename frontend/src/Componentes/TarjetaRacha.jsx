import { Link } from 'react-router-dom';

// Llama animada; se apaga (gris) cuando la racha está en cero.
export function Llama({ encendida = true, tamano = 56 }) {
  return (
    <svg className={`llama ${encendida ? 'encendida' : 'apagada'}`} viewBox="0 0 48 60" width={tamano} height={tamano * 1.25} aria-hidden="true" focusable="false">
      <path className="llama-exterior" d="M24 2c4 10 16 16 16 32a16 16 0 0 1-32 0c0-8 4-13 8-17 0 6 3 9 6 9-2-9 0-17 2-24z" />
      <path className="llama-interior" d="M24 30c3 4 8 7 8 14a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 2 4 3 4-1-4 0-7 1-10z" />
    </svg>
  );
}

// Resumen de la racha: días seguidos, mejor marca y lo que falta hoy.
export default function TarjetaRacha({ racha, enlace, valorDia }) {
  const viva = racha.current > 0;
  let estado = 'Completa la práctica de hoy para empezar tu racha.';
  if (racha.completedToday) estado = '¡Listo por hoy! Vuelve mañana para seguir sumando.';
  else if (racha.atRisk) estado = 'Tu racha está en riesgo: completa la práctica de hoy para no perderla.';

  return (
    <section className={`tarjeta tarjeta-racha ${racha.atRisk ? 'en-riesgo' : ''} ${racha.completedToday ? 'cumplida' : ''}`} aria-label="Racha diaria">
      <Llama encendida={viva} />
      <div className="racha-texto">
        <p className="racha-dias"><strong>{racha.current}</strong> {racha.current === 1 ? 'día' : 'días'} seguidos</p>
        <p className="tenue pequeno">Mejor racha: {racha.best} · {valorDia !== undefined ? `cada día cumplido suma ${String(valorDia).replace('.', ',')} a tu nota` : 'cada día cumplido suma a tu nota'}</p>
        <p>{estado}</p>
      </div>
      {enlace && !racha.completedToday && <Link className="boton" to={enlace}>{racha.atRisk ? 'Salvar mi racha' : 'Practicar hoy'}</Link>}
    </section>
  );
}
