import { useState } from 'react';

// Foto de perfil con la inicial como respaldo; es decorativa porque el nombre siempre aparece al lado.
export default function Avatar({ nombre, url, className = 'avatar', estilo }) {
  const [fallo, setFallo] = useState(null);
  const inicial = (nombre || '?').charAt(0).toUpperCase();
  if (url && fallo !== url) {
    return <img src={url} alt="" className={`${className} con-foto`} onError={() => setFallo(url)} />;
  }
  return <span className={className} style={estilo} aria-hidden="true">{inicial}</span>;
}
