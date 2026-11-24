import { useEffect, useState } from 'react';
import Campo from '../Componentes/Campo.jsx';
import EnlaceInvitacion from '../Componentes/EnlaceInvitacion.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError, Paginacion } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

const ROLES = [
  { valor: 'student', texto: 'Estudiante' },
  { valor: 'teacher', texto: 'Docente' },
  { valor: 'institution_admin', texto: 'Administrador de institución' },
  { valor: 'auditor', texto: 'Auditoría (solo lectura)' },
];
const nombreRol = (rol) => ROLES.find((opcion) => opcion.valor === rol)?.texto || rol;

// Permite invitar y administrar los usuarios de la institución.
export default function AdminUsuarios() {
  const { usuario } = useSesion();
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [consulta, setConsulta] = useState('');
  // Espera a que se deje de escribir; el texto viaja codificado en la URL y el servidor lo trata como dato.
  useEffect(() => {
    const espera = setTimeout(() => { setConsulta(busqueda.trim()); setPagina(1); }, 300);
    return () => clearTimeout(espera);
  }, [busqueda]);
  const usuarios = useDatos(`/users?page=${pagina}&limit=20${consulta ? `&q=${encodeURIComponent(consulta)}` : ''}`);
  const [formulario, setFormulario] = useState({ email: '', displayName: '', role: 'student' });
  const [invitacion, setInvitacion] = useState(null);
  const [recienInvitado, setRecienInvitado] = useState('');
  const { enviando, error, ejecutar } = useEnvio();

  const cambiar = (campo) => (valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  async function invitar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post('/users', formulario));
    if (!respuesta) return;
    setInvitacion(respuesta.data);
    setRecienInvitado(formulario.email.trim().toLowerCase());
    setFormulario({ email: '', displayName: '', role: formulario.role });
    usuarios.recargar();
  }

  async function cambiarEstado(persona, status) {
    if (await ejecutar(() => api.patch(`/users/${persona.id}`, { status }))) usuarios.recargar();
  }

  async function renovar(persona) {
    const respuesta = await ejecutar(() => api.post(`/users/${persona.id}/invitation`));
    if (respuesta) setInvitacion(respuesta.data);
  }

  return (
    <>
      <h1>Usuarios</h1>
      <p>Invitar genera un enlace privado; la persona elige su contraseña y activa la cuenta. Invitada significa activación pendiente. Si el enlace vence, genera uno nuevo; esto invalida el anterior y no envía un correo automáticamente.</p>
      <EnlaceInvitacion invitacion={invitacion} alCerrar={() => setInvitacion(null)} />
      <form className="tarjeta fila-formulario" onSubmit={invitar}>
        <Campo etiqueta="Correo" tipo="email" valor={formulario.email} alCambiar={cambiar('email')} required />
        <Campo etiqueta="Nombre" valor={formulario.displayName} alCambiar={cambiar('displayName')} required minLength={2} />
        <Campo etiqueta="Rol" tipo="select" valor={formulario.role} alCambiar={cambiar('role')} opciones={ROLES} />
        <button type="submit" className="boton" disabled={enviando} aria-busy={enviando}>{enviando ? 'Invitando…' : 'Invitar'}</button>
      </form>
      <form className="buscador" role="search" onSubmit={(evento) => evento.preventDefault()}>
        <Campo etiqueta="Buscar por nombre o correo" tipo="search" valor={busqueda} alCambiar={setBusqueda} maxLength={100} />
      </form>
      <MensajeError error={error || usuarios.error} />
      {usuarios.cargando && <Cargando />}
      {usuarios.datos?.length === 0 && (consulta
        ? <EstadoVacio titulo="Sin resultados" detalle={`Ninguna persona coincide con «${consulta}».`} />
        : <EstadoVacio titulo="No hay usuarios todavía" detalle="Invita a docentes y estudiantes con el formulario." />)}
      {usuarios.datos?.length > 0 && (
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {usuarios.datos.map((persona) => (
                <tr key={persona.id} className={persona.email === recienInvitado ? 'fila-nueva' : undefined}>
                  <td>{persona.displayName}</td>
                  <td>{persona.email}</td>
                  <td>{nombreRol(persona.role)}</td>
                  <td><Insignia estado={persona.status} />{persona.status === 'invited' && <small> Activación pendiente · {new Date(persona.invitationExpiresAt) < new Date() ? 'Enlace vencido; genera uno nuevo' : 'Enlace vigente'}</small>}</td>
                  <td className="acciones">
                    {persona.status === 'invited' && <button type="button" disabled={enviando} className="boton secundario" onClick={() => renovar(persona)}>Nuevo enlace</button>}
                    {persona.status === 'active' && persona.id !== usuario.id && (
                      <button type="button" disabled={enviando} className="boton secundario" onClick={() => window.confirm('La cuenta perderá el acceso y se cerrarán sus sesiones. ¿Deshabilitar?') && cambiarEstado(persona, 'disabled')}>Deshabilitar</button>
                    )}
                    {persona.status === 'disabled' && <button type="button" disabled={enviando} className="boton secundario" onClick={() => cambiarEstado(persona, 'active')}>Habilitar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion meta={usuarios.meta} pagina={pagina} alCambiar={setPagina} />
    </>
  );
}
