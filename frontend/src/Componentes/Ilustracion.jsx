// Ilustraciones propias y ligeras (SVG en línea) para los estados vacíos.
// Usan la paleta de la aplicación y son decorativas: el texto del estado ya explica la situación.
const DIBUJOS = {
  libro: (
    <>
      <path className="relleno-cielo" d="M10 22c10-5 20-5 30 0v38c-10-5-20-5-30 0z" />
      <path className="relleno-blanco" d="M40 22c10-5 20-5 30 0v38c-10-5-20-5-30 0z" />
      <path className="trazo" d="M10 22c10-5 20-5 30 0m0 0c10-5 20-5 30 0M40 22v38" />
      <path className="trazo-suave" d="M18 32h14M18 40h14M48 32h14M48 40h10" />
      <circle className="relleno-lima flota" cx="66" cy="14" r="6" />
    </>
  ),
  calendario: (
    <>
      <rect className="relleno-blanco trazo" x="12" y="16" width="56" height="48" rx="8" />
      <path className="relleno-azul" d="M12 24a8 8 0 0 1 8-8h40a8 8 0 0 1 8 8v6H12z" />
      <path className="trazo" d="M26 10v12M54 10v12" />
      <rect className="relleno-lima" x="22" y="38" width="10" height="9" rx="3" />
      <rect className="relleno-cielo" x="36" y="38" width="10" height="9" rx="3" />
      <rect className="relleno-naranja flota" x="50" y="38" width="10" height="9" rx="3" />
    </>
  ),
  tarea: (
    <>
      <rect className="relleno-blanco trazo" x="16" y="10" width="44" height="56" rx="8" />
      <path className="trazo-suave" d="M34 26h18M34 40h18M34 54h12" />
      <path className="trazo-lima" d="M23 26l3 3 5-6M23 40l3 3 5-6" />
      <circle className="relleno-naranja flota" cx="27" cy="54" r="3.5" />
    </>
  ),
  grafica: (
    <>
      <path className="trazo" d="M12 64h56M12 64V14" />
      <rect className="relleno-cielo" x="20" y="44" width="10" height="20" rx="3" />
      <rect className="relleno-azul" x="36" y="32" width="10" height="32" rx="3" />
      <rect className="relleno-lima flota" x="52" y="20" width="10" height="44" rx="3" />
    </>
  ),
  chat: (
    <>
      <path className="relleno-azul" d="M8 18a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v18a8 8 0 0 1-8 8H24l-10 8v-8h2a8 8 0 0 1-8-8z" />
      <path className="relleno-blanco trazo" d="M30 34a8 8 0 0 1 8-8h26a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-2v8l-10-8H38a8 8 0 0 1-8-8z" />
      <path className="trazo-suave" d="M40 38h22M40 46h14" />
      <circle className="relleno-lima flota" cx="20" cy="27" r="3" />
      <circle className="relleno-lima flota retraso" cx="32" cy="27" r="3" />
    </>
  ),
  busqueda: (
    <>
      <rect className="relleno-blanco trazo" x="10" y="12" width="42" height="52" rx="8" />
      <path className="trazo-suave" d="M20 26h22M20 36h16M20 46h20" />
      <circle className="relleno-cielo trazo flota" cx="52" cy="46" r="13" />
      <path className="trazo grueso" d="M61 55l9 9" />
    </>
  ),
};

export default function Ilustracion({ tipo }) {
  const dibujo = DIBUJOS[tipo];
  if (!dibujo) return null;
  return (
    <svg className="ilustracion" viewBox="0 0 80 76" width="80" height="76" aria-hidden="true" focusable="false">
      {dibujo}
    </svg>
  );
}
