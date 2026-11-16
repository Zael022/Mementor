// Muestra fecha y hora en formato corto y legible.
export function fechaHora(valor) {
  if (!valor) return 'Sin fecha';
  return new Date(valor).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Convierte el valor de un campo datetime-local a formato ISO para la API.
export function aIso(valorLocal) {
  return valorLocal ? new Date(valorLocal).toISOString() : null;
}

// Divide los milisegundos restantes en días, horas, minutos y segundos.
export function partesDeTiempo(milisegundos) {
  const total = Math.max(0, Math.floor(milisegundos / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

// Muestra el tamaño de un archivo en KB o MB.
export function tamanoArchivo(bytes) {
  if (!bytes) return '';
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
