// Íconos de los asistentes de IA, con la misma retícula y trazo que Iconos.jsx.
// Viven aparte para no sumar peso a la carga inicial: solo los usan las páginas de asistentes.
const ICONOS_ASISTENTE = {
  tutor: {
    tono: 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z',
    trazo: 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5zM8.5 11h.01M12 11h.01M15.5 11h.01',
  },
  preguntas: {
    tono: 'M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0',
    trazo: 'M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  },
  retro: {
    tono: 'M15.5 4.5l4 4L9 19H5v-4z',
    trazo: 'M15.5 4.5l4 4L9 19H5v-4zM13 7l4 4M13 19.5h6.5',
  },
  analisis: {
    tono: 'M5 13h3v7H5zM10.5 9h3v11h-3zM16 5h3v15h-3z',
    trazo: 'M5 13h3v7H5zM10.5 9h3v11h-3zM16 5h3v15h-3zM3.5 20.5h17',
  },
  escudo: {
    tono: 'M12 3.5 19 6v5.5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z',
    trazo: 'M12 3.5 19 6v5.5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6zM9 12l2 2 4-4',
  },
  megafono: {
    tono: 'M4 10v4h3l8 4.5V5.5L7 10z',
    trazo: 'M4 10v4h3l8 4.5V5.5L7 10zM7 14l1.5 5H11l-1-3.5M18.5 9.5a3 3 0 0 1 0 5',
  },
  meta: {
    tono: 'M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0',
    trazo: 'M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 12h.01',
  },
  resumen: {
    tono: 'M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z',
    trazo: 'M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5zM8.5 8h7M8.5 12h7M8.5 16h4',
  },
  admision: {
    tono: 'M6 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
    trazo: 'M6 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6',
  },
  chispa: {
    tono: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z',
    trazo: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16.5v4M16.5 18.5h4',
  },
  externo: {
    trazo: 'M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H11',
  },
  volver: {
    trazo: 'M19 12H5M11 6l-6 6 6 6',
  },
};

export default function IconoAsistente({ nombre, tamano = 22, className = '' }) {
  const icono = ICONOS_ASISTENTE[nombre] || ICONOS_ASISTENTE.chispa;
  return (
    <svg className={`icono ${className}`} viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" focusable="false">
      {icono.tono && <path className="icono-tono" d={icono.tono} />}
      <path d={icono.trazo} />
    </svg>
  );
}
