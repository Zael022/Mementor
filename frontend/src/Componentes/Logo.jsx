import { useEffect, useState } from 'react';

// Indica si la página se ve en tema oscuro (elegido en la cuenta o por el sistema).
function useTemaOscuro() {
  const leer = () => {
    if (typeof window === 'undefined') return false;
    const tema = document.documentElement.getAttribute('data-tema');
    if (tema === 'oscuro') return true;
    if (tema === 'claro') return false;
    return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  };
  const [oscuro, setOscuro] = useState(leer);

  useEffect(() => {
    const actualizar = () => setOscuro(leer());
    const observador = new MutationObserver(actualizar);
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    const consulta = window.matchMedia?.('(prefers-color-scheme: dark)');
    consulta?.addEventListener?.('change', actualizar);
    return () => { observador.disconnect(); consulta?.removeEventListener?.('change', actualizar); };
  }, []);

  return oscuro;
}

const MEDIDAS = { horizontal: [912, 214], vertical: [1037, 830] };

// Logo oficial de MENTOR IA (archivos SVG en public/marca, sin redibujar); usa la versión para fondo oscuro cuando corresponde.
export default function Logo({ como = 'span', className = '', variante = 'horizontal', ...props }) {
  const Etiqueta = como;
  const oscuro = useTemaOscuro();
  const [ancho, alto] = MEDIDAS[variante];
  return (
    <Etiqueta className={`marca marca-${variante} ${className}`} {...props}>
      <img src={`/marca/logo-${variante}-${oscuro ? 'oscuro' : 'claro'}.svg`} alt="MENTOR IA" width={ancho} height={alto} decoding="async" />
    </Etiqueta>
  );
}
