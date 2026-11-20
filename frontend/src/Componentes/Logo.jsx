// Identidad de MENTOR AI: isotipo (burbuja azul con una «m» de dos arcos y una chispa lima) y logotipo.
// La «m» une dos arcos como un libro abierto o dos personas aprendiendo juntas; la chispa representa la IA.
export const FORMA_ISOTIPO = 'M16 2H48A14 14 0 0 1 62 16V48A14 14 0 0 1 48 62H7A5 5 0 0 1 2 57V16A14 14 0 0 1 16 2Z';
export const ARCOS_ISOTIPO = 'M16 47V32a8 8 0 0 1 16 0v15M32 32a8 8 0 0 1 16 0v15';
export const CHISPA_ISOTIPO = 'M50 5.5c.95 4.6 2.9 6.55 7.5 7.5-4.6.95-6.55 2.9-7.5 7.5-.95-4.6-2.9-6.55-7.5-7.5 4.6-.95 6.55-2.9 7.5-7.5z';

export function Isotipo({ tamano = 28, className = '' }) {
  return (
    <svg className={`isotipo ${className}`} viewBox="0 0 64 64" width={tamano} height={tamano} aria-hidden="true" focusable="false">
      <path d={FORMA_ISOTIPO} fill="#3451e1" />
      <path d={ARCOS_ISOTIPO} fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={CHISPA_ISOTIPO} fill="#c8f169" />
    </svg>
  );
}

// Logotipo completo; el texto accesible sigue siendo «MENTOR AI».
export default function Logo({ como = 'span', className = '', ...props }) {
  const Etiqueta = como;
  return (
    <Etiqueta className={`marca ${className}`} {...props}>
      <Isotipo />
      <span className="marca-texto">MENTOR <span className="marca-ai">AI</span></span>
    </Etiqueta>
  );
}
