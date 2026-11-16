import { animated, useSpring } from '@react-spring/web';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';

const AnimatedDiv = animated.div;

const ETIQUETAS = {
  sin_evidencia: 'Sin evidencia suficiente',
  estimacion_inicial: 'Estimación inicial',
  estimado: 'Estimado',
};

// Convierte el dominio (0 a 1) en un porcentaje entero entre 0 y 100.
export function porcentajeDominio(score) {
  if (score === null || score === undefined || !Number.isFinite(Number(score))) return null;
  return Math.round(Math.min(1, Math.max(0, Number(score))) * 100);
}

// Muestra el dominio de un tema junto con la evidencia usada.
// React Spring es el único motor del relleno: el texto muestra el valor final desde el inicio.
export default function MedidorDominio({ tema }) {
  const porcentaje = porcentajeDominio(tema.masteryScore);
  const sinDatos = porcentaje === null;
  const destino = sinDatos ? 0 : porcentaje;
  // Con movimiento reducido el valor final aparece de inmediato, sin pasar por cero.
  const reducido = prefiereMenosMovimiento();
  const relleno = useSpring({
    from: { ancho: reducido ? destino : 0 },
    to: { ancho: destino },
    immediate: reducido,
    config: { tension: 170, friction: 26, clamp: true },
  });

  return (
    <div className="medidor">
      <div className="medidor-titulo">
        <strong>{tema.topicTitle}</strong>
        <span>{sinDatos ? 'n/a' : `${porcentaje} %`}</span>
      </div>
      <div className="medidor-barra" role="img" aria-label={sinDatos ? 'Dominio sin datos' : `Dominio estimado ${porcentaje} por ciento`}>
        <AnimatedDiv data-testid="relleno-dominio" style={{ width: relleno.ancho.to((valor) => `${Math.min(100, Math.max(0, valor))}%`) }} />
      </div>
      <small>{ETIQUETAS[tema.label] || ETIQUETAS.sin_evidencia} · {tema.evidenceCount} respuesta(s) consideradas</small>
    </div>
  );
}
