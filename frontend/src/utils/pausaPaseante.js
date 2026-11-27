import { FRASE_DESPIERTA } from './mensajesMascota.js';
import { FRASE_PAUSA_SIESTA, FRASES_PAUSA_CARICIA, FRASES_PAUSA_CURIOSIDAD, FRASES_PAUSA_MOLESTIA } from './frasesPausa.js';

// Reglas de cómo reacciona Pausa paseante. Son funciones puras: reciben el estado y la hora y devuelven
// el estado nuevo y la reacción, así se prueban sin dibujar nada. Las interacciones con Pausa nunca
// cuentan como actividad de aprendizaje: aquí no se envía nada al servidor.
export const REGLAS_PAUSA = {
  clicsParaMolestia: 4, // 4 clics…
  ventanaClicsMs: 5000, // …en 5 segundos
  bajaMolestiaMs: 20000, // la molestia baja un nivel cada 20 s sin clics
  silencioMs: 10000, // en el nivel 3 no responde durante 10 s
  esperaCariciaMs: 15000, // como máximo una caricia cada 15 s
  cariciasParaDormir: 3, // 3 caricias…
  ventanaCariciasMs: 60000, // …en un minuto lo duermen
  siestaMs: 60000, // y duerme un minuto (o hasta que lo despierten con un clic)
};

// Orden barajado de los datos curiosos: no se repite ninguno hasta agotar la lista.
export function crearBaraja(total, azar = Math.random) {
  const orden = Array.from({ length: total }, (_, indice) => indice);
  for (let i = orden.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return orden;
}

export function crearEstadoPausa(azar = Math.random) {
  return {
    clics: [], molestia: 0, ultimoClic: 0, silencioHasta: 0,
    caricias: [], ultimaCaricia: -Infinity, dormidoHasta: 0,
    baraja: crearBaraja(FRASES_PAUSA_CURIOSIDAD.length, azar), vueltas: { molestia: 0, caricia: 0 },
  };
}

// La molestia baja sola con el tiempo.
export function molestiaActual(estado, ahora) {
  if (!estado.molestia) return 0;
  const bajadas = Math.floor((ahora - estado.ultimoClic) / REGLAS_PAUSA.bajaMolestiaMs);
  return Math.max(0, estado.molestia - bajadas);
}

function siguienteDato(estado, azar) {
  const baraja = estado.baraja.length ? estado.baraja : crearBaraja(FRASES_PAUSA_CURIOSIDAD.length, azar);
  const [indice, ...resto] = baraja;
  return { baraja: resto, frase: FRASES_PAUSA_CURIOSIDAD[indice] };
}

// Un clic, un toque o Enter/Espacio.
export function alClic(estado, ahora, azar = Math.random) {
  if (ahora < estado.silencioHasta) return { estado, reaccion: null };
  if (ahora < estado.dormidoHasta) {
    return { estado: { ...estado, dormidoHasta: 0, caricias: [] }, reaccion: { tipo: 'despierta', pose: 'bostezo', frase: FRASE_DESPIERTA } };
  }
  const clics = [...estado.clics.filter((momento) => ahora - momento < REGLAS_PAUSA.ventanaClicsMs), ahora];
  const previa = molestiaActual(estado, ahora);
  let nivel = 0;
  if (clics.length >= REGLAS_PAUSA.clicsParaMolestia) {
    nivel = clics.length >= REGLAS_PAUSA.clicsParaMolestia + 4 ? 3 : clics.length >= REGLAS_PAUSA.clicsParaMolestia + 2 ? 2 : 1;
  }
  nivel = Math.max(nivel, previa);
  const base = { ...estado, clics, ultimoClic: ahora, molestia: nivel };
  if (nivel === 3) {
    // Se tapa la cara, se aleja y se toma unos segundos; al volver, la molestia ya bajó un poco.
    return {
      estado: { ...base, clics: [], molestia: 2, silencioHasta: ahora + REGLAS_PAUSA.silencioMs },
      reaccion: { tipo: 'molestia', nivel: 3, pose: 'tapado', alejarse: true, frase: FRASES_PAUSA_MOLESTIA[3][0] },
    };
  }
  if (nivel > 0) {
    const vuelta = estado.vueltas.molestia;
    const frases = FRASES_PAUSA_MOLESTIA[nivel];
    return {
      estado: { ...base, vueltas: { ...estado.vueltas, molestia: vuelta + 1 } },
      reaccion: { tipo: 'molestia', nivel, pose: nivel === 2 ? 'enojado' : 'molesto', frase: frases[vuelta % frases.length] },
    };
  }
  const { baraja, frase } = siguienteDato(estado, azar);
  return { estado: { ...base, baraja }, reaccion: { tipo: 'curiosidad', pose: 'curioso', frase } };
}

// Puntero quieto o suave sobre la cabeza, presión larga o la tecla A.
export function alAcariciar(estado, ahora) {
  if (ahora < estado.silencioHasta || ahora < estado.dormidoHasta) return { estado, reaccion: null };
  if (ahora - estado.ultimaCaricia < REGLAS_PAUSA.esperaCariciaMs) return { estado, reaccion: null };
  const caricias = [...estado.caricias.filter((momento) => ahora - momento < REGLAS_PAUSA.ventanaCariciasMs), ahora];
  // Una caricia también calma: la molestia vuelve a cero.
  const base = { ...estado, caricias, ultimaCaricia: ahora, molestia: 0, clics: [] };
  if (caricias.length >= REGLAS_PAUSA.cariciasParaDormir) {
    return {
      estado: { ...base, caricias: [], dormidoHasta: ahora + REGLAS_PAUSA.siestaMs },
      reaccion: { tipo: 'siesta', pose: 'dormido', frase: FRASE_PAUSA_SIESTA },
    };
  }
  const vuelta = estado.vueltas.caricia;
  return {
    estado: { ...base, vueltas: { ...estado.vueltas, caricia: vuelta + 1 } },
    reaccion: { tipo: 'caricia', pose: 'feliz', corazones: true, frase: FRASES_PAUSA_CARICIA[vuelta % FRASES_PAUSA_CARICIA.length] },
  };
}

// Pausa está dormido por una siesta de caricias.
export const estaDormido = (estado, ahora) => ahora < estado.dormidoHasta;

// Las rutas donde aparece viven aparte (utils/rutasPausa.js) para no cargar las frases en la carga inicial.
export { rutaConPausa } from './rutasPausa.js';

// Elige a dónde ir: un punto libre del tramo, lejos de lo que hay que esquivar y no demasiado cerca del actual.
// «zonas» son tramos horizontales ocupados [inicio, fin] en píxeles.
export function elegirDestino({ desde, minimo, maximo, ancho, zonas = [], distanciaMinima = 120, lejos = false, azar = Math.random }) {
  if (maximo <= minimo) return minimo;
  const libre = (x) => zonas.every(([inicio, fin]) => x + ancho <= inicio || x >= fin);
  const candidatos = [];
  for (let x = minimo; x <= maximo; x += 16) if (libre(x)) candidatos.push(x);
  // El extremo derecho también cuenta aunque no caiga en el paso de 16 px.
  if (libre(maximo) && candidatos.at(-1) !== maximo) candidatos.push(maximo);
  if (!candidatos.length) return desde;
  if (lejos) return candidatos.reduce((mejor, x) => (Math.abs(x - desde) > Math.abs(mejor - desde) ? x : mejor), candidatos[0]);
  const alejados = candidatos.filter((x) => Math.abs(x - desde) >= distanciaMinima);
  const lista = alejados.length ? alejados : candidatos;
  return lista[Math.floor(azar() * lista.length)];
}
