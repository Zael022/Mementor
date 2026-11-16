import { useState } from 'react';
import Campo from '../Componentes/Campo.jsx';
import EnlaceInvitacion from '../Componentes/EnlaceInvitacion.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Formulario para invitar al administrador de una institución.
function InvitarAdmin({ institucion, alInvitar }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const { enviando, error, ejecutar } = useEnvio();
  const admins = useDatos(`/institutions/${institucion.id}/admins`);

  async function enviar(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post(`/institutions/${institucion.id}/admins`, { email, displayName: nombre }));
    if (!respuesta) return;
    setEmail('');
    setNombre('');
    admins.recargar();
    alInvitar(respuesta.data);
  }

  return (
    <div className="subpanel">
      <h4>Administradores</h4>
      {admins.cargando && <Cargando />}
      {admins.datos?.length === 0 && <p className="tenue">Esta institución aún no tiene administradores.</p>}
      <ul className="lista-simple">
        {admins.datos?.map((admin) => <li key={admin.id}>{admin.displayName} · {admin.email} <Insignia estado={admin.status} /></li>)}
      </ul>
      <form className="fila-formulario" onSubmit={enviar}>
        <Campo etiqueta="Correo" tipo="email" valor={email} alCambiar={setEmail} required />
        <Campo etiqueta="Nombre" valor={nombre} alCambiar={setNombre} required minLength={2} />
        <button type="submit" className="boton" disabled={enviando}>Invitar administrador</button>
      </form>
      <MensajeError error={error} />
    </div>
  );
}

// Topes de la institución; vacío usa el valor por defecto del servidor.
function TopesInstitucion({ institucion, alGuardar }) {
  const [documentos, setDocumentos] = useState(institucion.maxDocuments ?? '');
  const [consultas, setConsultas] = useState(institucion.aiDailyQuestionLimit ?? '');
  const { enviando, error, ejecutar } = useEnvio();
  const numero = (valor) => (valor === '' ? null : Number(valor));

  async function guardar(evento) {
    evento.preventDefault();
    if (await ejecutar(() => api.patch(`/institutions/${institucion.id}/limits`, { maxDocuments: numero(documentos), aiDailyQuestionLimit: numero(consultas) }))) alGuardar();
  }

  return (
    <form className="subpanel fila-formulario" onSubmit={guardar}>
      <Campo etiqueta="Tope de documentos del tutor" tipo="number" min={0} valor={documentos} alCambiar={setDocumentos} ayuda="Vacío: valor del servidor." />
      <Campo etiqueta="Consultas diarias al tutor" tipo="number" min={0} valor={consultas} alCambiar={setConsultas} ayuda="Vacío: valor del servidor." />
      <button type="submit" className="boton secundario" disabled={enviando}>Guardar topes</button>
      <MensajeError error={error} />
    </form>
  );
}

// Permite al administrador de plataforma crear instituciones.
export default function PlataformaInstituciones() {
  const instituciones = useDatos('/institutions?limit=100');
  const [nombre, setNombre] = useState('');
  const [abierta, setAbierta] = useState(null);
  const [invitacion, setInvitacion] = useState(null);
  const { enviando, error, ejecutar } = useEnvio();

  async function crear(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post('/institutions', { name: nombre }));
    if (!respuesta) return;
    setNombre('');
    instituciones.recargar();
  }

  return (
    <>
      <h1>Instituciones</h1>
      <EnlaceInvitacion invitacion={invitacion} alCerrar={() => setInvitacion(null)} />
      <form className="tarjeta fila-formulario" onSubmit={crear}>
        <Campo etiqueta="Nombre de la institución" valor={nombre} alCambiar={setNombre} required minLength={2} />
        <button type="submit" className="boton" disabled={enviando}>Crear institución</button>
      </form>
      <MensajeError error={error || instituciones.error} />
      {instituciones.cargando && <Cargando />}
      {instituciones.datos?.length === 0 && (
        <EstadoVacio titulo="No hay instituciones todavía" detalle="Crea la primera institución con el formulario de arriba y luego invita a su administrador." />
      )}
      {instituciones.datos?.map((institucion) => (
        <article className="tarjeta" key={institucion.id}>
          <div className="tarjeta-cabecera">
            <div>
              <h3>{institucion.name}</h3>
              <p className="tenue">{institucion.slug} <Insignia estado={institucion.status} /></p>
            </div>
            <button type="button" className="boton secundario" onClick={() => setAbierta(abierta === institucion.id ? null : institucion.id)}>
              {abierta === institucion.id ? 'Ocultar' : 'Administradores'}
            </button>
          </div>
          {abierta === institucion.id && <InvitarAdmin institucion={institucion} alInvitar={setInvitacion} />}
          {abierta === institucion.id && <TopesInstitucion institucion={institucion} alGuardar={instituciones.recargar} />}
        </article>
      ))}
    </>
  );
}
