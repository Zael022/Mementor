import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { Aviso, MensajeError } from '../Componentes/Estados.jsx';
import Portada from '../Componentes/Portada.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Define la contraseña nueva con el enlace recibido por correo.
export default function RestablecerClave() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [listo, setListo] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento) {
    evento.preventDefault();
    setErrorLocal(null);
    if (password !== confirmacion) {
      setErrorLocal(new Error('Las contraseñas no coinciden.'));
      return;
    }
    if (await ejecutar(() => api.post('/auth/password/reset', { token, password }))) setListo(true);
  }

  return (
    <Portada titulo="Nueva contraseña">
      {listo ? (
        <>
          <Aviso tipo="exito">Tu contraseña cambió. Por seguridad cerramos las sesiones abiertas en otros equipos.</Aviso>
          <Link className="boton" to="/login">Iniciar sesión</Link>
        </>
      ) : (
        <form onSubmit={enviar}>
          {!token && <Aviso tipo="error">El enlace no incluye un token. Solicita uno nuevo.</Aviso>}
          <Campo etiqueta="Nueva contraseña" tipo="password" valor={password} alCambiar={setPassword} autoComplete="new-password"
            ayuda="Mínimo 10 caracteres, con letras y números." required />
          <Campo etiqueta="Repite la contraseña" tipo="password" valor={confirmacion} alCambiar={setConfirmacion} autoComplete="new-password" required />
          <MensajeError error={errorLocal || error} />
          <button type="submit" className="boton" disabled={enviando || !token} aria-busy={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
          <p className="pequeno"><Link to="/recuperar">Solicitar otro enlace</Link></p>
        </form>
      )}
    </Portada>
  );
}
