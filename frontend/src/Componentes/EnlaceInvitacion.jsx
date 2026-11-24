import { useState } from 'react';

// Muestra una sola vez el enlace para que la persona active su cuenta.
export default function EnlaceInvitacion({ invitacion, alCerrar }) {
  const [copiado, setCopiado] = useState(null);
  if (!invitacion) return null;
  const enlace = `${window.location.origin}/activar?token=${invitacion.invitationToken}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(invitacion.invitationToken);
    } catch {
      setCopiado(null);
    }
  }

  return (
    <section className="tarjeta destacada" role="status">
      <h3>Invitación creada para {invitacion.user.email}</h3>
      <p>Enlace generado; la cuenta tiene activación pendiente. No se ha enviado un correo. Compártelo de forma privada. Solo se muestra ahora y vence el {new Date(invitacion.invitationExpiresAt).toLocaleString()}. Si vence, genera otro desde Usuarios; el anterior dejará de servir.</p>
      <input readOnly value={enlace} aria-label="Enlace de activación" onFocus={(evento) => evento.target.select()} />
      <div className="acciones">
        <button type="button" className="boton" onClick={copiar}>{copiado === invitacion.invitationToken ? 'Copiado' : 'Copiar enlace'}</button>
        <button type="button" className="boton secundario" onClick={alCerrar}>Cerrar</button>
      </div>
    </section>
  );
}
