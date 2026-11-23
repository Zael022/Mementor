import DocumentoLegal from '../Componentes/DocumentoLegal.jsx';
import { VERSIONES_LEGALES } from '../utils/legal.js';

// Política de privacidad: qué datos se recopilan, para qué, con quién se comparten, cómo se protegen y por cuánto tiempo.
export default function Privacidad() {
  return (
    <DocumentoLegal titulo="Política de privacidad" version={VERSIONES_LEGALES.privacy}>
      <h2>1. Responsable</h2>
      <p>MENTOR AI es una plataforma educativa que usa cada institución con sus docentes y estudiantes. La institución que te invitó es la responsable de la base de datos de su comunidad; MENTOR AI actúa como encargado del tratamiento siguiendo sus instrucciones.</p>

      <h2>2. Qué datos recopilamos y cómo</h2>
      <table className="tabla">
        <thead><tr><th scope="col">Dato</th><th scope="col">Cómo se obtiene</th><th scope="col">Para qué se usa</th></tr></thead>
        <tbody>
          <tr><td>Correo, nombre visible y rol</td><td>Invitación de la administración</td><td>Identificarte, darte acceso y mostrar tu nombre a tu curso</td></tr>
          <tr><td>Contraseña</td><td>La escribes al activar la cuenta</td><td>Iniciar sesión. Se guarda solo como hash bcrypt; nadie puede leerla</td></tr>
          <tr><td>Nombre, apellidos, teléfono, presentación y foto (opcionales)</td><td>Los completas en tu perfil</td><td>Mostrar tu perfil; puedes borrarlos cuando quieras</td></tr>
          <tr><td>Avance, entregas, evaluaciones, quizzes, racha y calificaciones</td><td>Tu actividad en los cursos</td><td>Calcular tu progreso y tu nota, y que el docente pueda calificar</td></tr>
          <tr><td>Preguntas al tutor y uso de los asistentes de IA</td><td>Lo que escribes en esas pantallas</td><td>Responderte con el material del curso y llevar el control de uso y costos</td></tr>
          <tr><td>Registros técnicos (fecha, acción, dirección IP en límites de seguridad)</td><td>Automático</td><td>Seguridad, prevención de abusos y auditoría</td></tr>
        </tbody>
      </table>
      <p>La base para tratar tus datos es tu consentimiento informado, que das al activar la cuenta, y la relación educativa con tu institución. Solo usamos cada dato para la finalidad indicada.</p>

      <h2>3. Con quién se comparte</h2>
      <ul>
        <li><strong>Proveedor de inteligencia artificial:</strong> la institución elige Anthropic (Claude) u OpenAI y puede informarte cuál usa. Antes de enviar cualquier texto que escribe una persona, MENTOR AI reemplaza cédulas, teléfonos, correos y enlaces por etiquetas como «[correo oculto]». Nunca se envían el nombre ni el correo de tu cuenta. Aun así, no escribas datos personales de nadie en preguntas, entregas ni textos para los asistentes: los nombres propios no se pueden detectar de forma automática.</li>
        <li><strong>Google Cloud (si tu institución lo activa):</strong> guarda los archivos originales de los materiales y las fotos de perfil en un almacenamiento privado, guarda el material del curso para buscar las fuentes del tutor y, si se usa Google Drive, lee las carpetas que la institución autoriza.</li>
        <li><strong>Ministerio de Hacienda (tipo de cambio) y Nager.Date (feriados):</strong> solo se consultan datos públicos; no se envía ningún dato tuyo.</li>
        <li><strong>n8n (automatizaciones):</strong> recibe tu correo únicamente para enviarte avisos (recordatorios o confirmación de baja).</li>
        <li><strong>Proveedores de alojamiento</strong> del sitio, la API y la base de datos, con acceso cifrado y restringido.</li>
      </ul>
      <p>Qué recibe el proveedor de IA en cada asistente:</p>
      <table className="tabla">
        <thead><tr><th scope="col">Asistente</th><th scope="col">Qué se envía</th></tr></thead>
        <tbody>
          <tr><td>Tutor del curso</td><td>Tu pregunta y los últimos turnos de la conversación (con datos ocultos) y pasajes del material publicado del curso</td></tr>
          <tr><td>Generador de preguntas y resumen de lección</td><td>Solo material del curso o de la lección</td></tr>
          <tr><td>Retroalimentación de entregas</td><td>Instrucciones de la tarea y el texto de la entrega con datos ocultos; el enlace de la entrega no se envía</td></tr>
          <tr><td>Analista del curso</td><td>Estadísticas agregadas; cada estudiante aparece como «Estudiante 1, 2…»</td></tr>
          <tr><td>Coach de estudio</td><td>Tus temas con su nivel de dominio, tus tareas pendientes y tu racha, sin tu nombre ni tu correo</td></tr>
          <tr><td>Redactor de anuncios y asistente de cumplimiento</td><td>El texto que escribe el docente o la administración, con datos ocultos</td></tr>
        </tbody>
      </table>
      <p>No vendemos ni cedemos tus datos con fines comerciales.</p>

      <h2>4. Cómo protegemos la información</h2>
      <ul>
        <li>Contraseñas con bcrypt; sesiones con un token JWT firmado, con vencimiento, en una cookie que el navegador no deja leer a otros programas.</li>
        <li>Control de acceso por roles y por institución, validado en el servidor; cada curso solo es visible para sus docentes y estudiantes.</li>
        <li>Conexiones cifradas (HTTPS), credenciales fuera del código y bitácora de auditoría de las acciones importantes.</li>
      </ul>

      <h2>5. Por cuánto tiempo se conserva</h2>
      <ul>
        <li>Conversaciones con el tutor: hasta 365 días sin actividad.</li>
        <li>Detalle de uso de IA (tutor y asistentes: quién, curso, modelo y tokens): 90 días; después, solo un resumen mensual sin contenido para el tutor, y el registro de los asistentes se borra.</li>
        <li>Archivos de materiales y fotos de perfil: mientras existan en el curso o en tu perfil; al borrarlos se eliminan también del almacenamiento.</li>
        <li>Datos de cuenta y académicos: mientras la cuenta exista. Si pides la baja, se anonimiza tu cuenta (ver punto 6).</li>
      </ul>

      <h2>6. Tus derechos</h2>
      <ul>
        <li><strong>Acceso:</strong> en Configuración → Privacidad y datos puedes descargar una copia de tus datos.</li>
        <li><strong>Rectificación:</strong> puedes corregir tu perfil cuando quieras; para el correo o el rol, pide el cambio a tu institución.</li>
        <li><strong>Supresión:</strong> en Configuración → Privacidad y datos puedes solicitar la eliminación de tu cuenta. Confirmamos tu identidad con tu contraseña, borramos o anonimizamos tus datos personales y te avisamos por correo al terminar. Se conservan, sin tu nombre ni tu correo, las calificaciones y entregas que la institución debe mantener como historial académico, y la evidencia de tus aceptaciones como respaldo legal.</li>
        <li><strong>Reclamos:</strong> puedes dirigirte a la Agencia de Protección de Datos de los Habitantes (PRODHAB).</li>
      </ul>
    </DocumentoLegal>
  );
}
