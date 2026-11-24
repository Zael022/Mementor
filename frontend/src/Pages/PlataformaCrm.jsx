import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Campo from '../Componentes/Campo.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

function Lista() {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const instituciones = useDatos(`/platform-crm/institutions?page=${pagina}&limit=20&search=${encodeURIComponent(busqueda)}`);
  return <><h1>Seguimiento de instituciones</h1>
    <Campo etiqueta="Buscar institución" valor={busqueda} alCambiar={(valor) => { setBusqueda(valor); setPagina(1); }} />
    {instituciones.cargando && <Cargando />}<MensajeError error={instituciones.error} />
    {instituciones.datos?.length === 0 && <EstadoVacio titulo="No hay instituciones" detalle="No se encontraron instituciones para este filtro." />}
    {instituciones.datos?.map((item) => <article className="tarjeta" key={item.id}><h2>{item.name}</h2><p>{item.status === 'active' ? 'Activa' : 'Inactiva'} · {item.account ? 'Seguimiento configurado' : 'Sin seguimiento configurado'}</p><Link className="boton secundario" to={`/plataforma/crm-instituciones/${item.id}`}>Abrir ficha</Link></article>)}
    {instituciones.meta && <div className="fila-formulario"><button className="boton secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina} de {instituciones.meta.totalPages}</span><button className="boton secundario" disabled={pagina >= instituciones.meta.totalPages} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div>}
  </>;
}

function FormularioContacto({ id, recargar }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [cargo, setCargo] = useState('');
  const clave = useRef(null);
  const envio = useEnvio();
  async function guardar(evento) {
    evento.preventDefault();
    clave.current ||= crypto.randomUUID();
    const respuesta = await envio.ejecutar(() => api.post(`/platform-crm/institutions/${id}/contacts`, { requestKey: clave.current, name: nombre, ...(correo ? { email: correo } : {}), ...(cargo ? { position: cargo } : {}) }));
    if (respuesta) { clave.current = null; setNombre(''); setCorreo(''); setCargo(''); recargar(); }
  }
  return <form className="tarjeta" onSubmit={guardar}><h2>Registrar contacto profesional</h2><div className="fila-formulario"><Campo etiqueta="Nombre" valor={nombre} alCambiar={setNombre} required minLength={2} maxLength={120} /><Campo etiqueta="Cargo" valor={cargo} alCambiar={setCargo} maxLength={120} /><Campo etiqueta="Correo profesional" tipo="email" valor={correo} alCambiar={setCorreo} maxLength={190} /><button className="boton" disabled={envio.enviando}>Guardar contacto</button></div><MensajeError error={envio.error} /></form>;
}

function EditarSeguimiento({ id, cuenta, recargar }) {
  const [estado, setEstado] = useState(cuenta.onboardingStatus);
  const [necesidades, setNecesidades] = useState(cuenta.needs || '');
  const envio = useEnvio();
  async function guardar(evento) {
    evento.preventDefault();
    if (await envio.ejecutar(() => api.patch(`/platform-crm/institutions/${id}/account`, { version: cuenta.version, onboardingStatus: estado, needs: necesidades || null }))) recargar();
  }
  return <form className="tarjeta" onSubmit={guardar}><h2>Seguimiento</h2><Campo etiqueta="Estado de incorporación" tipo="select" valor={estado} alCambiar={setEstado} opciones={[{ valor: 'pending', texto: 'Pendiente de revisión' }, { valor: 'configuring', texto: 'En configuración' }, { valor: 'pilot', texto: 'En piloto' }]} /><Campo etiqueta="Necesidades" tipo="textarea" valor={necesidades} alCambiar={setNecesidades} maxLength={2000} /><button className="boton" disabled={envio.enviando}>Guardar seguimiento</button><MensajeError error={envio.error} />{envio.error?.status === 409 && <button type="button" className="boton secundario" onClick={recargar}>Actualizar ficha</button>}</form>;
}

function Ficha() {
  const { id } = useParams();
  const recurso = useDatos(`/platform-crm/institutions/${id}`);
  const contactos = useDatos(recurso.datos?.account ? `/platform-crm/institutions/${id}/contacts?limit=100` : null);
  const envio = useEnvio();
  async function iniciar() {
    if (await envio.ejecutar(() => api.post(`/platform-crm/institutions/${id}/account`))) recurso.recargar();
  }
  return <><Link to="/plataforma/crm-instituciones">Volver a instituciones</Link>{recurso.cargando && <Cargando />}<MensajeError error={recurso.error || envio.error} />
    {recurso.datos && <><h1>{recurso.datos.name}</h1><p>Estado del servicio: {recurso.datos.status === 'active' ? 'activo' : 'inactivo'}.</p>
      {!recurso.datos.account ? <section className="tarjeta"><p>Sin seguimiento configurado.</p><button className="boton" disabled={envio.enviando} onClick={iniciar}>Configurar seguimiento</button></section> : <>
        <EditarSeguimiento key={recurso.datos.account.version} id={id} cuenta={recurso.datos.account} recargar={recurso.recargar} /><section className="tarjeta"><h2>Límites actuales</h2><p>Documentos: {recurso.datos.maxDocuments ?? 'valor predeterminado'} · Consultas diarias: {recurso.datos.aiDailyQuestionLimit ?? 'valor predeterminado'}</p></section>
        <FormularioContacto id={id} recargar={contactos.recargar} /><section className="tarjeta"><h2>Contactos profesionales</h2>{contactos.cargando && <Cargando />}<MensajeError error={contactos.error} />{contactos.datos?.length === 0 && <p>No hay contactos registrados.</p>}<ul>{contactos.datos?.map((contacto) => <li key={contacto.id}>{contacto.name}{contacto.position && ` · ${contacto.position}`}{contacto.email && ` · ${contacto.email}`}</li>)}</ul></section>
      </>}</>}
  </>;
}

export default function PlataformaCrm() {
  const { id } = useParams();
  return id ? <Ficha /> : <Lista />;
}
