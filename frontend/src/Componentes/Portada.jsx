import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { prefiereMenosMovimiento } from '../hooks/useMovimiento.js';
import Ilustracion from './Ilustracion.jsx';
import Logo from './Logo.jsx';
import { MENSAJE_PORTADA } from '../utils/mensajesMascota.js';

// La cuadrícula decorativa y la rejilla animada se descargan aparte: el formulario funciona mientras llegan.
const ShapeGrid = lazy(() => import('./ShapeGrid.jsx'));
const RejillaRasgos = lazy(() => import('./RejillaRasgos.jsx'));
// Pausa (con GSAP) también llega aparte, para no sumar peso a la primera pantalla.
const Mascota = lazy(() => import('./Mascota.jsx'));

// Parámetros de Shape Grid ajustados a la paleta de MENTOR (azul de estructura, cielo para el brillo de entrada).
// Sin velocidad ni dirección: la cuadrícula aparece con una onda breve y queda quieta.
const CUADRICULA = {
  shape: 'square',
  cellSize: 44,
  lineWidth: 1,
  direction: 'none',
  speed: 0,
  lineColor: '#4a64e6',
  hoverColor: '#eaeeff',
  fillOpacity: 0.1,
  glow: 0.15,
  twinkle: 0,
  fade: 0.7,
  intro: true,
  clickCascade: false,
  interactive: false,
  opacity: 0.85,
};

const RASGOS = [
  { titulo: 'Cursos y lecciones', dibujo: 'libro', texto: 'Cada docente organiza su curso en módulos, temas y lecciones.' },
  { titulo: 'Evaluaciones', dibujo: 'tarea', texto: 'Cuestionarios con corrección inmediata y revisión de cada respuesta.' },
  { titulo: 'Dominio por tema', dibujo: 'grafica', texto: 'Una estimación calculada con tus respuestas, con su evidencia a la vista.' },
  { titulo: 'Tutor IA con fuentes', dibujo: 'chat', texto: 'Responde con el material publicado del curso y cita de dónde lo tomó.' },
];

// Tarjeta de una característica de la plataforma.
function TarjetaRasgo({ rasgo }) {
  return (
    <article className="tarjeta rasgo">
      <Ilustracion tipo={rasgo.dibujo} />
      <h3>{rasgo.titulo}</h3>
      <p className="tenue">{rasgo.texto}</p>
    </article>
  );
}

// Portada pública para ingresar y activar la cuenta, con una cuadrícula discreta detrás del título.
export default function Portada({ titulo, children }) {
  useEffect(() => { document.title = `${titulo} · MENTOR IA`; }, [titulo]);
  const detalles = useRef(null);
  const [animar, setAnimar] = useState(false);

  // La versión animada (y GSAP) solo se descarga cuando la sección se acerca a la pantalla.
  useEffect(() => {
    const seccion = detalles.current;
    if (!seccion || prefiereMenosMovimiento() || !('IntersectionObserver' in window)) return undefined;
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { setAnimar(true); observador.disconnect(); }
    });
    observador.observe(seccion);
    return () => observador.disconnect();
  }, []);

  const rejillaFija = <div className="rejilla">{RASGOS.map((rasgo) => <TarjetaRasgo key={rasgo.titulo} rasgo={rasgo} />)}</div>;

  return (
    <div className="portada">
      <header className="cabecera">
        <Logo como="p" />
        {/* Pausa se agarra del borde inferior de esta barra y saluda una vez; es decorativa y respeta
            «Mostrar mascotas» y «Menos movimiento». */}
        <Suspense fallback={null}>
          <Mascota personaje="pausa" estado="bienvenida" rama={false} animacion={1} mensaje={MENSAJE_PORTADA} className="pausa-colgada" interactiva />
        </Suspense>
      </header>

      <section className="portada-hero">
        {/* Capa decorativa: oculta al lector de pantalla y sin eventos del puntero. */}
        <div className="portada-cuadricula" aria-hidden="true">
          <Suspense fallback={null}><ShapeGrid {...CUADRICULA} /></Suspense>
        </div>
        <div className="portada-texto">
          <h1>Tus clases, tus tareas y tu avance en un solo lugar</h1>
          <ul className="lista-check">
            <li>Entra a tus clases en vivo desde aquí</li>
            <li>Sigue las lecciones en orden y a tu ritmo</li>
            <li>Pregunta al tutor IA, que cita el material del curso</li>
          </ul>
        </div>
        <div className="tarjeta formulario-portada">
          <h2>{titulo}</h2>
          <div className="formulario-cuerpo">{children}</div>
        </div>
        <a className="flecha-abajo" href="#detalles" aria-label="Ver más sobre la plataforma">↓</a>
      </section>

      <section className="portada-detalles" id="detalles" ref={detalles}>
        <h2>Lo que encuentras al entrar</h2>
        {/* Mientras llega la versión animada (o con menos movimiento) se muestra la misma rejilla sin movimiento. */}
        {animar
          ? <Suspense fallback={rejillaFija}><RejillaRasgos rasgos={RASGOS} tarjeta={TarjetaRasgo} /></Suspense>
          : rejillaFija}
      </section>
    </div>
  );
}
