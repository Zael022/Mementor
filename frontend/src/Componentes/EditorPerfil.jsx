import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import Campo from './Campo.jsx';
import { Aviso, Cargando, MensajeError } from './Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const TIPOS_FOTO = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FOTO = 2 * 1024 * 1024;

// Foto de perfil: se revisa tipo y tamaño antes de enviarla; el servidor valida el contenido real.
export function FotoPerfil() {
  const { usuario, actualizarUsuario } = useSesion();
  const [aviso, setAviso] = useState('');
  const [problema, setProblema] = useState('');
  const envio = useEnvio();

  async function elegir(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    setAviso('');
    setProblema('');
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) return setProblema('Elige una imagen PNG, JPG o WebP.');
    if (archivo.size > MAX_FOTO) return setProblema('La imagen supera los 2 MB.');
    const datos = new FormData();
    datos.append('avatar', archivo);
    const respuesta = await envio.ejecutar(() => api.upload('/me/avatar', datos));
    if (respuesta) {
      actualizarUsuario({ avatarUrl: respuesta.data.avatarUrl });
      setAviso('Foto actualizada.');
    }
  }

  async function quitar() {
    setAviso('');
    const respuesta = await envio.ejecutar(() => api.delete('/me/avatar'));
    if (respuesta) {
      actualizarUsuario({ avatarUrl: null });
      setAviso('Foto quitada.');
    }
  }

  return (
    <div className="foto-perfil">
      <Avatar nombre={usuario.displayName} url={usuario.avatarUrl} className="perfil-avatar" />
      <div>
        <div className="acciones-compactas">
          <label className="boton secundario">
            {usuario.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
            <input type="file" accept={TIPOS_FOTO.join(',')} onChange={elegir} disabled={envio.enviando} />
          </label>
          {usuario.avatarUrl && <button type="button" className="boton-texto enlace" onClick={quitar} disabled={envio.enviando}>Quitar foto</button>}
        </div>
        <p className="tenue pequeno">PNG, JPG o WebP de hasta 2 MB. La ven las personas de tu institución.</p>
        <p role="status" className="texto-exito">{aviso}</p>
        {problema && <p className="texto-error" role="alert">{problema}</p>}
        <MensajeError error={envio.error} />
      </div>
    </div>
  );
}

// Nombre visible, nombres, apellidos, teléfono y presentación.
export function DatosPersonales() {
  const { actualizarUsuario } = useSesion();
  const perfil = useDatos('/me/profile');
  const [datos, setDatos] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const envio = useEnvio();

  useEffect(() => {
    if (perfil.datos) {
      const { displayName, firstName, lastName, phone, bio } = perfil.datos;
      setDatos({ displayName, firstName: firstName || '', lastName: lastName || '', phone: phone || '', bio: bio || '' });
    }
  }, [perfil.datos]);

  if (perfil.cargando && !datos) return <Cargando />;
  if (perfil.error) return <MensajeError error={perfil.error} />;
  if (!datos) return null;

  const cambiar = (campo) => (valor) => { setGuardado(false); setDatos((previos) => ({ ...previos, [campo]: valor })); };

  async function guardar(evento) {
    evento.preventDefault();
    const respuesta = await envio.ejecutar(() => api.patch('/me/profile', datos));
    if (respuesta) {
      actualizarUsuario({ displayName: respuesta.data.displayName });
      setGuardado(true);
    }
  }

  return (
    <form onSubmit={guardar} className="datos-personales">
      <div className="ancho-completo">
        <Campo etiqueta="Nombre visible" valor={datos.displayName} alCambiar={cambiar('displayName')} required minLength={2} maxLength={120}
          ayuda="Es el nombre que ven tus docentes y compañeros." />
      </div>
      <Campo etiqueta="Nombres" valor={datos.firstName} alCambiar={cambiar('firstName')} maxLength={80} autoComplete="given-name" />
      <Campo etiqueta="Apellidos" valor={datos.lastName} alCambiar={cambiar('lastName')} maxLength={80} autoComplete="family-name" />
      <div className="ancho-completo">
        <Campo etiqueta="Teléfono" tipo="tel" valor={datos.phone} alCambiar={cambiar('phone')} maxLength={30} autoComplete="tel"
          ayuda="Opcional. Solo lo ven tú y la administración de tu institución." />
      </div>
      <div className="ancho-completo">
        <Campo etiqueta="Sobre mí" tipo="textarea" filas={3} valor={datos.bio} alCambiar={cambiar('bio')} maxLength={500}
          ayuda={`Opcional. Lo ven tus docentes y compañeros de curso. ${datos.bio.length}/500`} />
      </div>
      <div className="ancho-completo">
        <button type="submit" className="boton" disabled={envio.enviando}>Guardar datos</button>
        {guardado && <Aviso tipo="exito">Datos actualizados.</Aviso>}
        <MensajeError error={envio.error} />
      </div>
    </form>
  );
}

// Correo de acceso: se confirma con la contraseña actual.
export function CambiarCorreo() {
  const { usuario, actualizarUsuario } = useSesion();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [aviso, setAviso] = useState('');
  const envio = useEnvio();

  async function guardar(evento) {
    evento.preventDefault();
    setAviso('');
    const respuesta = await envio.ejecutar(() => api.post('/me/email', { newEmail: correo, currentPassword: clave }));
    if (respuesta) {
      actualizarUsuario({ email: respuesta.data.email });
      setCorreo('');
      setClave('');
      setAviso(`Listo. Desde ahora inicias sesión con ${respuesta.data.email}.`);
    }
  }

  return (
    <form onSubmit={guardar} className="perfil-formulario">
      <p>Correo actual: <strong>{usuario.email}</strong></p>
      <Campo etiqueta="Nuevo correo" tipo="email" valor={correo} alCambiar={setCorreo} required maxLength={190} autoComplete="email" />
      <Campo etiqueta="Contraseña actual" tipo="password" valor={clave} alCambiar={setClave} required autoComplete="current-password" />
      <button type="submit" className="boton secundario" disabled={envio.enviando}>Cambiar correo</button>
      <p role="status" className="texto-exito">{aviso}</p>
      <MensajeError error={envio.error} />
    </form>
  );
}

// Contraseña: pide la actual, valida la nueva y cierra las demás sesiones.
export function CambiarContrasena() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [aviso, setAviso] = useState('');
  const envio = useEnvio();
  const coincide = repetida === '' || nueva === repetida;

  async function guardar(evento) {
    evento.preventDefault();
    setAviso('');
    if (nueva !== repetida) return;
    const respuesta = await envio.ejecutar(() => api.post('/me/password', { currentPassword: actual, newPassword: nueva }));
    if (respuesta) {
      setActual('');
      setNueva('');
      setRepetida('');
      const cerradas = respuesta.data.otherSessionsClosed;
      setAviso(`Contraseña cambiada.${cerradas ? ` Se cerraron ${cerradas} ${cerradas === 1 ? 'sesión abierta' : 'sesiones abiertas'} en otros equipos.` : ''}`);
    }
  }

  return (
    <form onSubmit={guardar} className="perfil-formulario">
      <Campo etiqueta="Contraseña actual" tipo="password" valor={actual} alCambiar={setActual} required autoComplete="current-password" />
      <Campo etiqueta="Nueva contraseña" tipo="password" valor={nueva} alCambiar={setNueva} required minLength={10} maxLength={200} autoComplete="new-password"
        ayuda="Al menos 10 caracteres, con letras y números." />
      <Campo etiqueta="Repite la nueva contraseña" tipo="password" valor={repetida} alCambiar={setRepetida} required autoComplete="new-password"
        aria-invalid={!coincide} />
      {!coincide && <p className="texto-error" role="alert">Las contraseñas no coinciden.</p>}
      <button type="submit" className="boton secundario" disabled={envio.enviando || !coincide}>Cambiar contraseña</button>
      <p role="status" className="texto-exito">{aviso}</p>
      <MensajeError error={envio.error} />
    </form>
  );
}
