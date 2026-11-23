import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

// Registra los complementos de GSAP una sola vez para toda la aplicación.
gsap.registerPlugin(ScrollTrigger, useGSAP);

// Las páginas cargan datos después de pintarse: al cambiar el alto del documento se recalculan los disparadores.
if (typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined') {
  let espera;
  new ResizeObserver(() => {
    clearTimeout(espera);
    espera = setTimeout(() => ScrollTrigger.refresh(), 150);
  }).observe(document.body);
}

export { gsap, ScrollTrigger, useGSAP };
