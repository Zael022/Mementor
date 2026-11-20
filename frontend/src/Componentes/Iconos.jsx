// Íconos propios de MENTOR AI: retícula de 24 px, trazo redondeado de 1,75 px y un tono suave de relleno.
// «trazo» dibuja la línea; «tono» es la superficie que se rellena con el color actual al 16 %.
export const ICONOS = {
  inicio: {
    tono: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z',
    trazo: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z',
  },
  calendario: {
    tono: 'M6.5 5.5h11A2.5 2.5 0 0 1 20 8v2H4V8a2.5 2.5 0 0 1 2.5-2.5z',
    trazo: 'M6.5 5.5h11A2.5 2.5 0 0 1 20 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V8a2.5 2.5 0 0 1 2.5-2.5zM4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h2.5M13.5 14H16M8 17h2.5',
  },
  pendientes: {
    tono: 'M7.5 4.5h9A2.5 2.5 0 0 1 19 7v11.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5V7a2.5 2.5 0 0 1 2.5-2.5z',
    trazo: 'M9 4.5H7.5A2.5 2.5 0 0 0 5 7v11.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V7a2.5 2.5 0 0 0-2.5-2.5H15M10.2 3h3.6A1.2 1.2 0 0 1 15 4.2v.6A1.2 1.2 0 0 1 13.8 6h-3.6A1.2 1.2 0 0 1 9 4.8v-.6A1.2 1.2 0 0 1 10.2 3zM9 13l2 2 4-4',
  },
  revisar: {
    tono: 'M4 13.5h4.5L10 16h4l1.5-2.5H20V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
    trazo: 'M4 13.5 6.4 5.6A2.2 2.2 0 0 1 8.5 4h7a2.2 2.2 0 0 1 2.1 1.6L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 13.5h4.5L10 16h4l1.5-2.5H20M9.5 8.5l1.8 1.8 3.2-3.2',
  },
  plan: {
    tono: 'M9 5 4 7v13l5-2z',
    trazo: 'M9 5 4 7v13l5-2 6 2 5-2V5l-5 2-6-2zM9 5v13M15 7v13',
  },
  progreso: {
    tono: 'M8 15l3.5-4 3 2.5L19 8v12H8z',
    trazo: 'M4 4v15a1 1 0 0 0 1 1h15M8 15l3.5-4 3 2.5L19 8M15.5 8H19v3.5',
  },
  asistentes: {
    tono: 'M11 4.5c.8 4.4 2.6 6.2 7 7-4.4.8-6.2 2.6-7 7-.8-4.4-2.6-6.2-7-7 4.4-.8 6.2-2.6 7-7z',
    trazo: 'M11 4.5c.8 4.4 2.6 6.2 7 7-4.4.8-6.2 2.6-7 7-.8-4.4-2.6-6.2-7-7 4.4-.8 6.2-2.6 7-7zM18.5 2.5v4M16.5 4.5h4M18 17.5v3M16.5 19h3',
  },
  gobernanza: {
    tono: 'M12 3.5 19 6v5.5c0 4.6-3 7.9-7 9-4-1.1-7-4.4-7-9V6z',
    trazo: 'M12 3.5 19 6v5.5c0 4.6-3 7.9-7 9-4-1.1-7-4.4-7-9V6zM9 12l2 2 4-4',
  },
  bitacora: {
    tono: 'M12.5 15.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
    trazo: 'M4.5 6h11M4.5 10.5h7M4.5 15h4.5M12.5 15.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M18.6 18.1 21 20.5',
  },
  personas: {
    tono: 'M5.8 8.5a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0',
    trazo: 'M5.8 8.5a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.7c1.6.6 2.7 2.3 3 4.8',
  },
  cursos: {
    tono: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z',
    trazo: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  },
  instituciones: {
    tono: 'M5 10 12 4.5l7 5.5v10.5H5z',
    trazo: 'M3.5 20.5h17M5 20.5V10L12 4.5 19 10v10.5M10 20.5V15h4v5.5M10.8 10.5a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0',
  },
  drive: {
    tono: 'M3.5 10h17v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
    trazo: 'M3.5 7a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 10h17',
  },
  consumo: {
    tono: 'M4.5 17a8 8 0 1 1 15 0z',
    trazo: 'M4.5 17a8 8 0 1 1 15 0M12 14l3.5-3.5M10.5 14.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M7.5 9.6l-.9-.9M12 7.5V6.3M16.5 9.6l.9-.9',
  },
  ajustes: {
    tono: 'M13 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
    trazo: 'M4 7h9M17 7h3M4 17h3M11 17h9M13 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  },
  privacidad: {
    tono: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5z',
    trazo: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2',
  },
  terminos: {
    tono: 'M14 3.5V7a1.5 1.5 0 0 0 1.5 1.5H19z',
    trazo: 'M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5zM14 3.5V7a1.5 1.5 0 0 0 1.5 1.5H19M9 13h6M9 16.5h4',
  },
  salir: {
    trazo: 'M14 4.5h3.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5H14M10 8l-4 4 4 4M6 12h9',
  },
  subir: {
    trazo: 'M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M7.5 8.5 12 4l4.5 4.5M12 4v11',
  },
};

export default function Icono({ nombre, tamano = 20, className = '' }) {
  const icono = ICONOS[nombre];
  if (!icono) return null;
  return (
    <svg className={`icono ${className}`} viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" focusable="false">
      {icono.tono && <path className="icono-tono" d={icono.tono} />}
      <path d={icono.trazo} />
    </svg>
  );
}
