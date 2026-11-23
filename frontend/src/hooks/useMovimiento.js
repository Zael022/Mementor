// Indica si la persona pidió reducir las animaciones (en su cuenta o en el sistema operativo).
export function prefiereMenosMovimiento() {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-movimiento') === 'reducido') return true;
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
