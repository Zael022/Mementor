import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import { Aviso, MensajeError } from '../Componentes/Estados.jsx';
import Portada from '../Componentes/Portada.jsx';
import { rutaInicial, useSesion } from '../context/SesionContext.jsx';
import { useEnvio } from '../hooks/useEnvio.js';

// Permite iniciar sesión con correo y contraseña.
export default function Login() {
  const { usuario, iniciarSesion, vencida } = useSesion();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { enviando, error, ejecutar } = useEnvio();

  if (usuario) return <Navigate to={rutaInicial(usuario.role)} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    const sesion = await ejecutar(() => iniciarSesion(email, password));
    if (sesion) navegar(rutaInicial(sesion.role));
  }

  return (
    <Portada titulo="Iniciar sesión">
      <form onSubmit={enviar}>
        {vencida && <Aviso tipo="error">Tu sesión venció. Vuelve a ingresar para continuar.</Aviso>}
        <Campo etiqueta="Correo" tipo="email" valor={email} alCambiar={setEmail} autoComplete="username" required />
        <Campo etiqueta="Contraseña" tipo="password" valor={password} alCambiar={setPassword} autoComplete="current-password" required />
        <MensajeError error={error} />
        <button type="submit" className="boton" disabled={enviando} aria-busy={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="pequeno"><Link to="/recuperar">¿Olvidaste tu contraseña?</Link></p>
        <p className="tenue pequeno">Las cuentas se crean por invitación de la administración de tu institución.</p>
      </form>
    </Portada>
  );
}
