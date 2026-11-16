import { memo, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import Markdown from './Markdown.jsx';

// Transición breve y compartida; MotionConfig la desactiva si la persona pidió menos movimiento.
const TRANSICION = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };
const MotionDiv = m.div;
const MotionUl = m.ul;

// Una cita: enlace al recurso protegido de MENTOR o aviso de fuente retirada.
function Cita({ cita, mensajeId, base }) {
  const detalle = [cita.page ? `p. ${cita.page}` : null, cita.heading].filter(Boolean).join(' · ');
  return (
    <>
      {cita.available === false
        ? <span className="tenue">{cita.title} (fuente retirada)</span>
        : <Link to={`${base}/citas/${mensajeId}/${cita.position}`}>{cita.title}</Link>}
      {detalle && <span className="tenue"> · {detalle}</span>}
    </>
  );
}

// Fuentes de una respuesta: la primera a la vista y el resto bajo un botón.
function Fuentes({ citas, mensajeId, base }) {
  const [abiertas, setAbiertas] = useState(false);
  const idLista = useId();
  const [primera, ...resto] = citas;

  return (
    <MotionDiv className="citas" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={TRANSICION}>
      <span>{citas.length === 1 ? 'Fuente:' : 'Fuentes:'}</span>
      <ul>
        <li><Cita cita={primera} mensajeId={mensajeId} base={base} /></li>
      </ul>
      {resto.length > 0 && (
        <>
          <button type="button" className="boton-texto" aria-expanded={abiertas} aria-controls={idLista} onClick={() => setAbiertas((valor) => !valor)}>
            {abiertas ? 'Ocultar fuentes' : `Ver ${resto.length} ${resto.length === 1 ? 'fuente más' : 'fuentes más'}`}
          </button>
          {/* El contenedor siempre existe para que aria-controls apunte a algo aunque la lista esté cerrada. */}
          <div id={idLista}>
            <AnimatePresence initial={false}>
              {abiertas && (
                <MotionUl
                  key="resto"
                className="citas-resto"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={TRANSICION}
              >
                  {resto.map((cita) => <li key={cita.position}><Cita cita={cita} mensajeId={mensajeId} base={base} /></li>)}
                </MotionUl>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </MotionDiv>
  );
}

// Muestra un mensaje del chat; el texto en curso y la respuesta final usan el mismo formato para no saltar.
function MensajeTutor({ mensaje, esEstudiante }) {
  const esTutor = mensaje.role === 'assistant';
  const citas = mensaje.citations || [];
  const base = esEstudiante ? '/estudiante' : '/docente';
  const enCurso = mensaje.estado === 'escribiendo';
  const interrumpido = mensaje.estado === 'interrumpido';

  return (
    // LazyMotion carga solo las funciones de animación del DOM que se usan aquí.
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
      <div className={`burbuja ${esTutor ? 'tutor' : 'persona'}${enCurso ? ' en-curso' : ''}${interrumpido ? ' interrumpida' : ''}`}>
        <p className="burbuja-autor">
          {esTutor ? 'Tutor IA' : 'Tú'}
          {enCurso && <span className="estado-borrador"> · escribiendo, citas por validar</span>}
        </p>
        {esTutor && mensaje.kind === 'notice'
          ? <p className="aviso info">{mensaje.content}</p>
          : esTutor ? <Markdown texto={mensaje.content} /> : <p>{mensaje.content}</p>}
        {interrumpido && (
          <p className="aviso error pequeno">Respuesta interrumpida: no es una respuesta completa ni tiene citas validadas.</p>
        )}
        {esTutor && !enCurso && !interrumpido && citas.length > 0 && <Fuentes citas={citas} mensajeId={mensaje.id} base={base} />}
        {esTutor && !enCurso && !interrumpido && mensaje.kind !== 'notice' && citas.length === 0 && (
          <p className="tenue pequeno">Respuesta sin fuentes del curso. Consulta a tu docente.</p>
        )}
      </div>
    </MotionConfig>
    </LazyMotion>
  );
}

export default memo(MensajeTutor);
