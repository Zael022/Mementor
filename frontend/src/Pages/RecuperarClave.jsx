import { useState } from 'react';
import { Link } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { Aviso, MensajeError } from '../Componentes/Estados.jsx';
import Portada from '../Componentes/Portada.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Pide el enlace para restablecer la contraseña; el mensaje es el mismo exista o no la cuenta.
export default function RecuperarClave() {
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();

  async function enviar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post('/auth/password/forgot', { email }));
    if (respuesta) setMensaje(respuesta.data.message);
  }

  return (
    <Portada titulo="Recuperar contraseña">
      {mensaje ? (
        <>
          <Aviso tipo="exito">{mensaje}</Aviso>
          <p className="tenue pequeno">Revisa también la carpeta de correo no deseado. El enlace vence en 60 minutos.</p>
          <Link className="boton" to="/login">Volver a iniciar sesión</Link>
        </>
      ) : (
        <form onSubmit={enviar}>
          <p>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
          <Campo etiqueta="Correo" tipo="email" valor={email} alCambiar={setEmail} autoComplete="username" required />
          <MensajeError error={error} />
          <button type="submit" className="boton" disabled={enviando} aria-busy={enviando}>{enviando ? 'Enviando…' : 'Enviar enlace'}</button>
          <p className="pequeno"><Link to="/login">Volver a iniciar sesión</Link></p>
        </form>
      )}
    </Portada>
  );
}
