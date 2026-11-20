import { useEffect, useRef, useState } from 'react';

// Indica si la persona pidió reducir las animaciones (en su cuenta o en el sistema operativo).
export function prefiereMenosMovimiento() {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-movimiento') === 'reducido') return true;
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Avisa cuando un elemento entra en la pantalla.
export function useEnPantalla() {
  const referencia = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const elemento = referencia.current;
    if (!elemento || prefiereMenosMovimiento() || !('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) {
        setVisible(true);
        observador.disconnect();
      }
    }, { threshold: 0.12 });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return [referencia, visible];
}

// Anima un número desde cero hasta su valor final.
export function useConteo(valor, activo = true, duracion = 900) {
  const [actual, setActual] = useState(0);

  useEffect(() => {
    if (!activo) return undefined;
    if (prefiereMenosMovimiento() || !Number.isFinite(valor)) {
      setActual(valor);
      return undefined;
    }
    let cuadro;
    const inicio = performance.now();
    const paso = (ahora) => {
      const avance = Math.min(1, (ahora - inicio) / duracion);
      setActual(valor * (1 - (1 - avance) ** 3));
      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, activo, duracion]);

  return actual;
}
