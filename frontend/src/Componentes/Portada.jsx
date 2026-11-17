import { lazy, Suspense, useEffect } from 'react';
import { Revelar } from './Animaciones.jsx';
import Ilustracion from './Ilustracion.jsx';

// La cuadrícula decorativa se descarga aparte: el formulario funciona mientras llega.
const ShapeGrid = lazy(() => import('./ShapeGrid.jsx'));

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

// Portada pública para ingresar y activar la cuenta, con una cuadrícula discreta detrás del título.
export default function Portada({ titulo, children }) {
  useEffect(() => { document.title = `${titulo} · MENTOR AI`; }, [titulo]);

  return (
    <div className="portada">
      <header className="cabecera"><p className="marca">MENTOR <span>AI</span></p></header>

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

      <section className="portada-detalles" id="detalles">
        <h2>Lo que encuentras al entrar</h2>
        <div className="rejilla">
          {RASGOS.map((rasgo, indice) => (
            <Revelar key={rasgo.titulo} retraso={indice * 0.1}>
              <article className="tarjeta rasgo">
                <Ilustracion tipo={rasgo.dibujo} />
                <h3>{rasgo.titulo}</h3>
                <p className="tenue">{rasgo.texto}</p>
              </article>
            </Revelar>
          ))}
        </div>
      </section>
    </div>
  );
}
