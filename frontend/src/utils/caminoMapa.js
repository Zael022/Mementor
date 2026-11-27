// Geometría del camino del mapa: curvas suaves entre paradas, largos y puntos a lo largo del camino.
// Se calcula en JavaScript (sin medir el SVG) para que funcione igual con 5 o con 300 paradas.

const PASOS = 24;

// Puntos de control de la curva vertical que une dos paradas.
function controles(a, b) {
  const medio = (b.y - a.y) / 2;
  return [a, { x: a.x, y: a.y + medio }, { x: b.x, y: b.y - medio }, b];
}

function bezier([p0, p1, p2, p3], t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

const redondo = (valor) => Math.round(valor * 10) / 10;

// Trazo SVG que pasa por todos los puntos.
export function trazoPor(puntos) {
  if (!puntos.length) return '';
  let d = `M${redondo(puntos[0].x)} ${redondo(puntos[0].y)}`;
  for (let i = 1; i < puntos.length; i += 1) {
    const [, c1, c2, fin] = controles(puntos[i - 1], puntos[i]);
    d += ` C${redondo(c1.x)} ${redondo(c1.y)} ${redondo(c2.x)} ${redondo(c2.y)} ${redondo(fin.x)} ${redondo(fin.y)}`;
  }
  return d;
}

// Muestras de cada tramo con su largo acumulado (aproximación suficiente para animar).
export function muestrear(puntos) {
  const muestras = [];
  let largo = 0;
  const largos = [0];
  for (let i = 1; i < puntos.length; i += 1) {
    const curva = controles(puntos[i - 1], puntos[i]);
    let previo = puntos[i - 1];
    for (let paso = 1; paso <= PASOS; paso += 1) {
      const punto = bezier(curva, paso / PASOS);
      largo += Math.hypot(punto.x - previo.x, punto.y - previo.y);
      muestras.push({ ...punto, largo, tramo: i - 1 });
      previo = punto;
    }
    largos.push(largo);
  }
  return { muestras, largos, total: largo };
}

// Punto del camino a cierta distancia desde el inicio.
export function puntoEn({ muestras }, distancia, inicio) {
  if (!muestras.length || distancia <= 0) return inicio;
  return muestras.find((muestra) => muestra.largo >= distancia) || muestras[muestras.length - 1];
}

// Puntos del camino entre dos distancias (para el viaje de Orbi con MotionPath).
export function puntosEntre(camino, puntos, desde, hasta) {
  const inicial = puntoEn(camino, desde, puntos[0]);
  const intermedios = camino.muestras.filter((muestra) => muestra.largo > desde && muestra.largo < hasta);
  return [inicial, ...intermedios, puntoEn(camino, hasta, puntos[0])];
}

// Trazo con segmentos rectos entre muestras cercanas (sigue la curva sin distorsión).
export function trazoRecto(puntos) {
  return puntos.map((punto, indice) => `${indice ? 'L' : 'M'}${redondo(punto.x)} ${redondo(punto.y)}`).join(' ');
}
