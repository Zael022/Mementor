import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Aviso, MensajeError } from '../Componentes/Estados.jsx';
import Portada from '../Componentes/Portada.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Confirma el nuevo correo con el enlace recibido en esa dirección.
// Se pide un clic en lugar de confirmar al cargar, porque algunos filtros de correo abren los enlaces solos.
export default function ConfirmarCorreo() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') || '';
  const { usuario, actualizarUsuario } = useSesion();
  const [correo, setCorreo] = useState('');
  const { enviando, error, ejecutar } = useEnvio();

  async function confirmar() {
    const respuesta = await ejecutar(() => api.post('/auth/email/confirm', { token }));
    if (respuesta) {
      setCorreo(respuesta.data.email);
      if (usuario) actualizarUsuario({ email: respuesta.data.email });
    }
  }

  return (
    <Portada titulo="Confirmar correo">
      {correo ? (
        <>
          <Aviso tipo="exito">Listo. Desde ahora inicias sesión con {correo}.</Aviso>
          <Link className="boton" to={usuario ? '/perfil' : '/login'}>{usuario ? 'Volver al perfil' : 'Iniciar sesión'}</Link>
        </>
      ) : (
        <>
          {token
            ? <p>Confirma que esta dirección es tuya para usarla como correo de acceso a MENTOR IA.</p>
            : <Aviso tipo="error">El enlace no incluye un token. Pide el cambio de nuevo desde tu perfil.</Aviso>}
          <MensajeError error={error} />
          <button type="button" className="boton" onClick={confirmar} disabled={enviando || !token} aria-busy={enviando}>
            {enviando ? 'Confirmando…' : 'Confirmar correo'}
          </button>
        </>
      )}
    </Portada>
  );
}
