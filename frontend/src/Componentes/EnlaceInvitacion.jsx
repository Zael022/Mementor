import { useState } from 'react';

// Muestra una sola vez el enlace para que la persona active su cuenta.
export default function EnlaceInvitacion({ invitacion, alCerrar }) {
  const [copiado, setCopiado] = useState(false);
  if (!invitacion) return null;
  const enlace = `${window.location.origin}/activar?token=${invitacion.invitationToken}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section className="tarjeta destacada" role="status">
      <h3>Invitación creada para {invitacion.user.email}</h3>
      <p>Comparte este enlace de forma privada. Solo se muestra ahora y vence el {new Date(invitacion.invitationExpiresAt).toLocaleString()}.</p>
      <input readOnly value={enlace} aria-label="Enlace de activación" onFocus={(evento) => evento.target.select()} />
      <div className="acciones">
        <button type="button" className="boton" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar enlace'}</button>
        <button type="button" className="boton secundario" onClick={alCerrar}>Cerrar</button>
      </div>
    </section>
  );
}
