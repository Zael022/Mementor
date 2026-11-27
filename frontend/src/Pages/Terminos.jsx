import DocumentoLegal from '../Componentes/DocumentoLegal.jsx';
import { VERSIONES_LEGALES } from '../utils/legal.js';

// Términos y condiciones de uso de la plataforma y de sus asistentes de IA.
export default function Terminos() {
  return (
    <DocumentoLegal titulo="Términos y condiciones" version={VERSIONES_LEGALES.terms}>
      <h2>1. Uso de la plataforma</h2>
      <p>MENTOR IA es una herramienta educativa. Al activar tu cuenta aceptas usarla solo para fines de aprendizaje y enseñanza dentro de tu institución.</p>

      <h2>2. Responsabilidades de la persona usuaria</h2>
      <ul>
        <li>Mantener tu contraseña en secreto y cerrar sesión en equipos compartidos.</li>
        <li>Entregar trabajos propios y respetar las reglas de integridad académica de tu institución.</li>
        <li>No subir contenido ilegal, ofensivo, con datos personales de terceros sin permiso ni material protegido sin autorización.</li>
        <li>No intentar acceder a cursos, cuentas o datos que no te corresponden, ni saturar el servicio.</li>
      </ul>

      <h2>3. Responsabilidades de la organización</h2>
      <ul>
        <li>Proteger tus datos según la Política de privacidad y la Ley N.º 8968.</li>
        <li>Mantener los permisos por rol: cada persona ve solo lo que su rol y su institución permiten.</li>
        <li>Avisar los cambios de estos términos; si cambian, te pediremos aceptarlos de nuevo.</li>
      </ul>

      <h2>4. Uso aceptable de los asistentes de inteligencia artificial</h2>
      <ul>
        <li>Los asistentes responden con base en el material autorizado del curso y muestran sus fuentes. Si no hay material suficiente, lo dicen en vez de inventar.</li>
        <li>Los borradores que generan para docentes (preguntas, retroalimentación, anuncios) deben ser revisados por una persona antes de usarse.</li>
        <li>No escribas datos sensibles (salud, datos bancarios, contraseñas) en las conversaciones con la IA.</li>
        <li>Existe un límite diario de uso por persona e institución para controlar costos.</li>
      </ul>

      <h2>5. Limitación de responsabilidad sobre la IA</h2>
      <p>Las respuestas de la inteligencia artificial pueden contener errores u omisiones. No sustituyen al docente ni constituyen una calificación oficial. La corrección de las evaluaciones es automática y determinista, y la nota final la valida el docente. MENTOR IA no se hace responsable de decisiones tomadas solo con base en respuestas generadas por IA.</p>

      <h2>6. Suspensión y baja</h2>
      <p>La institución puede deshabilitar una cuenta que incumpla estos términos. Puedes darte de baja en cualquier momento desde Configuración → Privacidad y datos.</p>
    </DocumentoLegal>
  );
}
