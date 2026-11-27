import { useEffect } from 'react';
import { gsap } from '../utils/gsap.js';
import { prefiereMenosMovimiento } from './useMovimiento.js';

// Da vida a Orbi y Pausa sin cambiar su dibujo:
// - las pupilas siguen al puntero (con un tope para que no se salgan del ojo);
// - en reposo hacen un movimiento muy suave (Orbi flota, Pausa se balancea de su rama);
// - cada vez que «toque» cambia, reaccionan una vez.
// Con «Menos movimiento» no se mueve nada: la mascota queda quieta y solo cambia el texto.

const AJUSTES = {
  orbi: {
    mirada: 3.2,
    reposo: (g) => gsap.to(g, { y: -3, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
    reaccion: (raiz) => {
      const linea = gsap.timeline();
      const cuerpo = raiz.querySelector('[data-parte="orbi"]');
      const brazo = raiz.querySelector('[data-parte="brazo-saludo"]');
      const borla = raiz.querySelector('[data-parte="borla"]');
      linea.to(cuerpo, { scaleY: 0.9, scaleX: 1.06, svgOrigin: '180 204', duration: 0.12, ease: 'power2.in' })
        .to(cuerpo, { scaleY: 1, scaleX: 1, y: -22, svgOrigin: '180 204', duration: 0.24, ease: 'power2.out' })
        .to(cuerpo, { y: 0, duration: 0.42, ease: 'bounce.out' });
      if (brazo) linea.to(brazo, { rotation: -22, svgOrigin: '128 146', duration: 0.14, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.1);
      if (borla) linea.fromTo(borla, { rotation: 0 }, { rotation: 360, svgOrigin: '220 70', duration: 0.7, ease: 'power2.out' }, 0.12);
      return linea;
    },
  },
  pausa: {
    mirada: 1.3,
    // Se balancea desde donde se agarra (la rama o el borde de la página).
    reposo: (g) => gsap.fromTo(g, { rotation: -1.6 }, { rotation: 1.6, svgOrigin: '490 58', duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
    reaccion: (raiz) => {
      const linea = gsap.timeline();
      const colgado = raiz.querySelector('[data-parte="colgado-toque"]');
      const brazo = raiz.querySelector('[data-parte="brazo-libre"]');
      linea.to(colgado, { rotation: 7, svgOrigin: '490 58', duration: 0.45, ease: 'sine.out' })
        .to(colgado, { rotation: -5, svgOrigin: '490 58', duration: 0.6, ease: 'sine.inOut' })
        .to(colgado, { rotation: 0, svgOrigin: '490 58', duration: 0.7, ease: 'elastic.out(1, 0.5)' });
      if (brazo) linea.to(brazo, { rotation: 14, svgOrigin: '524 130', duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0);
      const parpados = raiz.querySelector('[data-parte="parpados"]');
      if (parpados) linea.to(parpados, { scaleY: 0.1, svgOrigin: '490 120', duration: 0.12, yoyo: true, repeat: 1 }, 0.5);
      return linea;
    },
  },
};

export function useMascotaViva(raiz, { personaje, viva, toque = 0, pose }) {
  const ajustes = AJUSTES[personaje];

  // Mirada que sigue al puntero y movimiento de reposo.
  useEffect(() => {
    const svg = raiz.current;
    if (!viva || !svg || prefiereMenosMovimiento()) return undefined;
    const pupilas = svg.querySelector('[data-parte="pupilas"]');
    const grupoReposo = svg.querySelector(`[data-parte="${personaje === 'orbi' ? 'flotar' : 'colgado'}"]`);
    const reposo = grupoReposo ? ajustes.reposo(grupoReposo) : null;
    if (!pupilas) return () => reposo?.kill();
    const moverX = gsap.quickTo(pupilas, 'x', { duration: 0.35, ease: 'power3.out' });
    const moverY = gsap.quickTo(pupilas, 'y', { duration: 0.35, ease: 'power3.out' });
    let cuadro = 0;
    const mirar = (evento) => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const caja = svg.getBoundingClientRect();
        if (!caja.width) return;
        const dx = evento.clientX - (caja.left + caja.width / 2);
        const dy = evento.clientY - (caja.top + caja.height * 0.45);
        const distancia = Math.hypot(dx, dy) || 1;
        // Mira con más intención cuando el puntero está cerca.
        const fuerza = Math.min(1, distancia / 160);
        moverX((dx / distancia) * ajustes.mirada * fuerza);
        moverY((dy / distancia) * ajustes.mirada * fuerza);
      });
    };
    window.addEventListener('pointermove', mirar, { passive: true });
    return () => {
      window.removeEventListener('pointermove', mirar);
      cancelAnimationFrame(cuadro);
      reposo?.kill();
      gsap.set([pupilas, grupoReposo].filter(Boolean), { clearProps: 'transform' });
    };
  }, [raiz, viva, personaje, pose, ajustes]);

  // Reacción al tocarla.
  useEffect(() => {
    const svg = raiz.current;
    if (!toque || !svg || prefiereMenosMovimiento()) return undefined;
    const linea = ajustes.reaccion(svg);
    return () => linea.progress(1).kill();
  }, [raiz, toque, ajustes]);
}
