import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Anuncios from '../Componentes/Anuncios.jsx';
import Campo from '../Componentes/Campo.jsx';
import Desplegable from '../Componentes/Desplegable.jsx';
import EncabezadoCurso from '../Componentes/EncabezadoCurso.jsx';
import { Cargando, MensajeError } from '../Componentes/Estados.jsx';
import { GestorMateriales } from '../Componentes/Materiales.jsx';
import { useDatos } from '../hooks/useDatos.js';
import { useEnvio } from '../hooks/useEnvio.js';
import { api } from '../services/api.js';

// Permite publicar anuncios y materiales generales del curso.
export default function CursoAnuncios() {
  const { id } = useParams();
  const curso = useDatos(`/courses/${id}`);
  const anuncios = useDatos(`/courses/${id}/announcements`);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { enviando, error, ejecutar } = useEnvio();

  if (curso.cargando && !curso.datos) return <Cargando />;
  if (curso.error) return <MensajeError error={curso.error} />;

  async function publicar(evento) {
    evento.preventDefault();
    if (await ejecutar(() => api.post(`/courses/${id}/announcements`, { title: titulo, body: mensaje }))) {
      setTitulo('');
      setMensaje('');
      anuncios.recargar();
    }
  }

  async function borrar(anuncioId) {
    if (await ejecutar(() => api.delete(`/announcements/${anuncioId}`))) anuncios.recargar();
  }

  return (
    <>
      <EncabezadoCurso curso={curso.datos} />
      <Desplegable etiqueta="Nuevo anuncio" sugerirAbierto={anuncios.datos?.length === 0}>
        <form className="tarjeta" onSubmit={publicar}>
          <Campo etiqueta="Título" valor={titulo} alCambiar={setTitulo} required minLength={2} maxLength={180} />
          <Campo etiqueta="Mensaje" tipo="textarea" filas={3} valor={mensaje} alCambiar={setMensaje} required maxLength={5000} />
          <button type="submit" className="boton" disabled={enviando}>Publicar anuncio</button>
          <MensajeError error={error} />
        </form>
      </Desplegable>

      <section className="tarjeta">
        <h2>Anuncios publicados</h2>
        {anuncios.cargando && !anuncios.datos && <Cargando />}
        <MensajeError error={anuncios.error} />
        <Anuncios lista={anuncios.datos} alBorrar={borrar} vacio="Aún no has publicado anuncios en este curso." />
      </section>

      <section className="tarjeta">
        <h2>Materiales generales del curso</h2>
        <p className="tenue">Los materiales de una lección específica se agregan al editar esa lección, en Contenidos.</p>
        <GestorMateriales cursoId={id} />
      </section>
    </>
  );
}
