import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../services/api.js';

// Estado del chat del tutor para un curso: hilo elegido, mensajes y envío en streaming.
// «seleccion» vale undefined mientras no se decide, null para una conversación nueva o el id del hilo.
export function useChatTutor(courseId, hilos, alCrearHilo) {
  const [seleccion, setSeleccion] = useState(undefined);
  const [mensajes, setMensajes] = useState([]);
  const [borrador, setBorrador] = useState(null);
  // Texto breve para lectores de pantalla: se anuncia al empezar y al terminar, no con cada trozo.
  const [anuncio, setAnuncio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const turno = useRef(0);
  const cargadoLocal = useRef(null);
  const controlador = useRef(null);
  const ocupado = useRef(false);

  // Al salir de la pantalla se cancela la respuesta en curso (el servidor deja de llamar al proveedor).
  useEffect(() => () => {
    turno.current += 1;
    controlador.current?.abort();
  }, []);

  // Abre el hilo más reciente solo una vez, al cargar la lista.
  useEffect(() => {
    if (seleccion !== undefined || !hilos) return;
    setSeleccion(hilos[0]?.id ?? null);
  }, [hilos, seleccion]);

  // Carga los mensajes del hilo elegido; ignora respuestas de un hilo anterior.
  useEffect(() => {
    if (!seleccion || cargadoLocal.current === seleccion) return undefined;
    let vigente = true;
    const carga = new AbortController();
    api.get(`/tutor/threads/${seleccion}/messages`, { signal: carga.signal })
      .then(({ data }) => {
        if (!vigente) return;
        cargadoLocal.current = seleccion;
        setMensajes(data);
      })
      .catch((fallo) => {
        if (!vigente || fallo.name === 'AbortError') return;
        cargadoLocal.current = seleccion;
        setError(fallo);
      });
    return () => { vigente = false; carga.abort(); };
  }, [seleccion]);

  const elegirHilo = useCallback((id) => {
    turno.current += 1;
    controlador.current?.abort();
    ocupado.current = false;
    cargadoLocal.current = null;
    setEnviando(false);
    setError(null);
    setMensajes([]);
    setBorrador(null);
    setAnuncio('');
    setSeleccion(id);
  }, []);

  // Deja el chat vacío; el próximo envío crea otro hilo.
  const nuevaConversacion = useCallback(() => elegirHilo(null), [elegirHilo]);

  // Detiene la respuesta en curso: el borrador queda marcado como interrumpido.
  const detener = useCallback(() => controlador.current?.abort(), []);

  const preguntar = useCallback(async (texto, intent) => {
    const contenido = texto.trim();
    // Una sola consulta a la vez: evita envíos dobles por teclado o por clics repetidos.
    if (!contenido || ocupado.current || seleccion === undefined || (seleccion && cargadoLocal.current !== seleccion)) return false;
    ocupado.current = true;
    const miTurno = ++turno.current;
    const vigente = () => miTurno === turno.current;
    const borradorId = `borrador-${miTurno}`;
    const preguntaId = `pregunta-${miTurno}`;
    let actualizacion = null;
    let iniciado = false;
    controlador.current?.abort();
    const propio = new AbortController();
    controlador.current = propio;
    setEnviando(true);
    setError(null);
    try {
      let destino = seleccion;
      if (!destino) {
        const creado = await api.post(`/courses/${courseId}/tutor/threads`, { title: contenido.slice(0, 80) }, { signal: propio.signal });
        if (!vigente()) return false;
        destino = creado.data.id;
        cargadoLocal.current = destino;
        setSeleccion(destino);
        alCrearHilo?.();
      }
      iniciado = true;
      setMensajes((previos) => [...previos, { id: preguntaId, role: 'user', content: contenido }]);
      setBorrador({ id: borradorId, role: 'assistant', estado: 'escribiendo', content: '', progreso: 0, citations: [] });
      // El indicador «Buscando…» ya se anuncia por sí mismo; aquí solo se limpia el aviso anterior.
      setAnuncio('');
      let final = null;
      await api.stream(`/tutor/threads/${destino}/messages/stream`, { question: contenido, ...(intent ? { intent } : {}) }, {
        signal: propio.signal,
        onEvento: (evento, datos) => {
          if (!vigente()) return;
          // El servidor retiene el texto hasta validarlo: mientras tanto solo informa cuánto lleva escrito.
          if (evento === 'progress') {
            const caracteres = datos.characters;
            if (actualizacion === null) actualizacion = setTimeout(() => {
              actualizacion = null;
              if (vigente() && !propio.signal.aborted) setBorrador((previo) => previo && { ...previo, progreso: caracteres });
            }, 120);
          }
          if (evento === 'final') final = datos;
          if (evento === 'error') throw new ApiError(502, datos.code, datos.message);
        },
      });
      if (!vigente()) return false;
      if (!final) throw new ApiError(0, 'STREAM_INTERRUPTED', 'La respuesta se interrumpió antes de terminar.');
      // La respuesta final reemplaza al borrador con el texto y las citas validadas por el servidor.
      setMensajes((previos) => [...previos, {
        id: final.messageId, role: 'assistant', kind: final.status === 'notice' ? 'notice' : 'answer', noticeCode: final.noticeCode,
        content: final.answer, citations: final.citations, grounded: final.grounded, estado: 'final',
      }]);
      setBorrador(null);
      const fuentes = final.citations?.length || 0;
      setAnuncio(final.status === 'notice'
        ? `Aviso del tutor: ${final.answer}`
        : `Respuesta lista${fuentes ? ` con ${fuentes} ${fuentes === 1 ? 'fuente' : 'fuentes'}` : ''}. Está al final de la conversación.`);
      return true;
    } catch (fallo) {
      if (!vigente()) return false;
      const cancelado = fallo.name === 'AbortError';
      // Un flujo interrumpido no muestra texto: nada de lo escrito llegó a validarse.
      if (iniciado) setMensajes((previos) => [...previos, {
        id: borradorId, role: 'assistant', content: '', citations: [], estado: 'interrumpido',
      }]);
      setBorrador(null);
      setAnuncio(cancelado ? 'Respuesta detenida.' : 'La respuesta se interrumpió.');
      if (!cancelado) setError(fallo);
      return false;
    } finally {
      clearTimeout(actualizacion);
      if (controlador.current === propio) ocupado.current = false;
      if (vigente()) setEnviando(false);
    }
  }, [courseId, seleccion, alCrearHilo]);

  const cargandoHistorial = seleccion === undefined || (seleccion !== null && cargadoLocal.current !== seleccion);
  return { seleccion, mensajes, borrador, anuncio, cargandoHistorial, enviando, error, preguntar, nuevaConversacion, elegirHilo, detener };
}
