import { useState } from 'react';
import Campo from '../Componentes/Campo.jsx';
import { Aviso, MensajeError } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const ROLES = {
  platform_admin: 'Administración de plataforma',
  institution_admin: 'Administración de institución',
  teacher: 'Docente',
  student: 'Estudiante',
};

// Perfil propio: nombre visible y datos de la cuenta.
export default function Configuracion() {
  const { usuario, actualizarUsuario } = useSesion();
  const [nombre, setNombre] = useState(usuario.displayName);
  const [guardado, setGuardado] = useState(false);
  const { enviando, error, ejecutar } = useEnvio();

  async function guardar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.patch('/me/profile', { displayName: nombre }));
    if (respuesta) {
      actualizarUsuario({ displayName: respuesta.data.displayName });
      setGuardado(true);
    }
  }

  return (
    <>
      <h1>Configuración</h1>
      <form className="tarjeta perfil-formulario" onSubmit={guardar}>
        <h2>Perfil</h2>
        <div className="perfil-avatar" aria-hidden="true">{usuario.displayName.charAt(0).toUpperCase()}</div>
        <Campo etiqueta="Nombre visible" valor={nombre} alCambiar={(valor) => { setNombre(valor); setGuardado(false); }} required minLength={2} maxLength={120}
          ayuda="Es el nombre que ven tus docentes y compañeros." />
        <button type="submit" className="boton" disabled={enviando || nombre.trim() === usuario.displayName}>Guardar</button>
        {guardado && <Aviso tipo="exito">Nombre actualizado.</Aviso>}
        <MensajeError error={error} />
      </form>
      <section className="tarjeta">
        <h2>Cuenta</h2>
        <ul className="lista-simple">
          <li><span>Correo</span><span className="tenue">{usuario.email}</span></li>
          <li><span>Rol</span><span className="tenue">{ROLES[usuario.role]}</span></li>
          {usuario.institutionName && <li><span>Institución</span><span className="tenue">{usuario.institutionName}</span></li>}
        </ul>
        <p className="tenue pequeno">El correo y el rol los administra tu institución.</p>
      </section>
    </>
  );
}
