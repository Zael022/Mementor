import { useState } from 'react';
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
];
const nombreRol = (rol) => ROLES.find((opcion) => opcion.valor === rol)?.texto || rol;

// Permite invitar y administrar los usuarios de la institución.
export default function AdminUsuarios() {
  const { usuario } = useSesion();
  const [pagina, setPagina] = useState(1);
  const usuarios = useDatos(`/users?page=${pagina}&limit=20`);
  const [formulario, setFormulario] = useState({ email: '', displayName: '', role: 'student' });
  const [invitacion, setInvitacion] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();

  const cambiar = (campo) => (valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  async function invitar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post('/users', formulario));
    if (!respuesta) return;
    setInvitacion(respuesta.data);
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
      <EnlaceInvitacion invitacion={invitacion} alCerrar={() => setInvitacion(null)} />
      <form className="tarjeta fila-formulario" onSubmit={invitar}>
        <Campo etiqueta="Correo" tipo="email" valor={formulario.email} alCambiar={cambiar('email')} required />
        <Campo etiqueta="Nombre" valor={formulario.displayName} alCambiar={cambiar('displayName')} required minLength={2} />
        <Campo etiqueta="Rol" tipo="select" valor={formulario.role} alCambiar={cambiar('role')} opciones={ROLES} />
        <button type="submit" className="boton" disabled={enviando}>Invitar</button>
      </form>
      <MensajeError error={error || usuarios.error} />
      {usuarios.cargando && <Cargando />}
      {usuarios.datos?.length === 0 && <EstadoVacio titulo="No hay usuarios todavía" detalle="Invita a docentes y estudiantes con el formulario." />}
      {usuarios.datos?.length > 0 && (
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {usuarios.datos.map((persona) => (
                <tr key={persona.id}>
                  <td>{persona.displayName}</td>
                  <td>{persona.email}</td>
                  <td>{nombreRol(persona.role)}</td>
                  <td><Insignia estado={persona.status} /></td>
                  <td className="acciones">
                    {persona.status === 'invited' && <button type="button" className="boton secundario" onClick={() => renovar(persona)}>Nuevo enlace</button>}
                    {persona.status === 'active' && persona.id !== usuario.id && (
                      <button type="button" className="boton secundario" onClick={() => cambiarEstado(persona, 'disabled')}>Deshabilitar</button>
                    )}
                    {persona.status === 'disabled' && <button type="button" className="boton secundario" onClick={() => cambiarEstado(persona, 'active')}>Habilitar</button>}
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
