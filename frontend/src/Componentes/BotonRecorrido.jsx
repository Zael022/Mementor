import { forwardRef } from 'react';

// Botón discreto para abrir el recorrido guiado de la página.
const BotonRecorrido = forwardRef(function BotonRecorrido({ alAbrir, claro = false }, ref) {
  return (
    <button ref={ref} type="button" className={`boton-recorrido ${claro ? 'claro' : ''}`} onClick={alAbrir}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7.6 7.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="14.6" r="1.1" fill="currentColor" />
      </svg>
      ¿Cómo me ayuda esta página?
    </button>
  );
});

export default BotonRecorrido;
