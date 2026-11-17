import { useState } from 'react';
import Campo from '../Componentes/Campo.jsx';
import { useBaseGestion } from '../Componentes/EncabezadoCurso.jsx';
import { TarjetaInteractiva } from '../Componentes/Animaciones.jsx';
import Desplegable from '../Componentes/Desplegable.jsx';
import EstadoVacio from '../Componentes/EstadoVacio.jsx';
import { Cargando, Insignia, MensajeError } from '../Componentes/Estados.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Lista los cursos que la persona gestiona y permite crear uno nuevo.
export default function CursosGestion() {
  const base = useBaseGestion();
  const cursos = useDatos('/courses?limit=100');
  const [formulario, setFormulario] = useState({ code: '', title: '', description: '' });
  const { enviando, error, ejecutar } = useEnvio();
  const cambiar = (campo) => (valor) => setFormulario((previo) => ({ ...previo, [campo]: valor }));

  async function crear(evento) {
    evento.preventDefault();
    const respuesta = await ejecutar(() => api.post('/courses', formulario));
    if (!respuesta) return;
    setFormulario({ code: '', title: '', description: '' });
    cursos.recargar();
  }

  return (
    <>
      <h1>Cursos</h1>
      <Desplegable etiqueta="Nuevo curso" sugerirAbierto={cursos.datos?.length === 0}>
        <form className="tarjeta" onSubmit={crear}>
          <div className="fila-formulario">
            <Campo etiqueta="Código" valor={formulario.code} alCambiar={cambiar('code')} required maxLength={40} />
            <Campo etiqueta="Título" valor={formulario.title} alCambiar={cambiar('title')} required minLength={2} maxLength={180} />
          </div>
          <Campo etiqueta="Descripción (opcional)" tipo="textarea" filas={2} valor={formulario.description} alCambiar={cambiar('description')} />
          <button type="submit" className="boton" disabled={enviando}>Crear curso</button>
          <MensajeError error={error} />
        </form>
      </Desplegable>
      <MensajeError error={cursos.error} />
      {cursos.cargando && <Cargando />}
      {cursos.datos?.length === 0 && <EstadoVacio ilustracion="libro" titulo="No hay cursos todavía" detalle="Crea el primer curso con el formulario de arriba." />}
      <div className="rejilla">
        {cursos.datos?.map((curso) => (
          <TarjetaInteractiva key={curso.id} to={`${base}/cursos/${curso.id}/contenidos`}>
            <span className="codigo">{curso.code}</span>
            <h3>{curso.title}</h3>
            {curso.description && <p className="tenue">{curso.description}</p>}
            <div className="pie"><Insignia estado={curso.status} /></div>
          </TarjetaInteractiva>
        ))}
      </div>
    </>
  );
}
