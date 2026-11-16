import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { Aviso, MensajeError } from '../Componentes/Estados.jsx';
import Portada from '../Componentes/Portada.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Permite a la persona invitada definir su contraseña.
export default function Activar() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [activada, setActivada] = useState(null);
  const [errorLocal, setErrorLocal] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento) {
    evento.preventDefault();
    setErrorLocal(null);
    if (password !== confirmacion) {
      setErrorLocal(new Error('Las contraseñas no coinciden.'));
      return;
    }
    const respuesta = await ejecutar(() => api.post('/auth/activate', { token, password }));
    if (respuesta) setActivada(respuesta.data.email);
  }

  return (
    <Portada titulo="Activar cuenta">
      {activada ? (
        <>
          <Aviso tipo="exito">La cuenta {activada} quedó activa.</Aviso>
          <Link className="boton" to="/login">Ir a iniciar sesión</Link>
        </>
      ) : (
        <form onSubmit={enviar}>
          {!token && <Aviso tipo="error">El enlace no incluye un token de invitación.</Aviso>}
          <Campo etiqueta="Nueva contraseña" tipo="password" valor={password} alCambiar={setPassword} autoComplete="new-password"
            ayuda="Mínimo 10 caracteres, con letras y números." required />
          <Campo etiqueta="Repite la contraseña" tipo="password" valor={confirmacion} alCambiar={setConfirmacion} autoComplete="new-password" required />
          <MensajeError error={errorLocal || error} />
          <button type="submit" className="boton" disabled={enviando || !token}>{enviando ? 'Activando…' : 'Activar cuenta'}</button>
        </form>
      )}
    </Portada>
  );
}
