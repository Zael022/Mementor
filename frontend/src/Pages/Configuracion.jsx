import { useId, useMemo, useState } from 'react';
import PrivacidadDatos from '../Componentes/PrivacidadDatos.jsx';
import Campo from '../Componentes/Campo.jsx';
import { CambiarContrasena, CambiarCorreo, DatosPersonales, FotoPerfil } from '../Componentes/EditorPerfil.jsx';
import { MensajeError } from '../Componentes/Estados.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { useEnvio } from '../hooks/useEnvio.js';
import { zonaDelNavegador } from '../services/preferencias.js';

const ROLES = {
  platform_admin: 'Administración de plataforma',
  institution_admin: 'Administración de institución',
  teacher: 'Docente',
  student: 'Estudiante',
  auditor: 'Auditoría',
};

const TEMAS = [
  { valor: 'system', texto: 'Como el sistema' },
  { valor: 'light', texto: 'Claro' },
  { valor: 'dark', texto: 'Oscuro' },
];
const TAMANOS = [
  { valor: 100, texto: 'Normal' },
  { valor: 115, texto: 'Grande' },
  { valor: 130, texto: 'Muy grande' },
  { valor: 150, texto: 'Máximo' },
];
const AJUSTES = [
  { campo: 'highContrast', texto: 'Alto contraste', ayuda: 'Texto secundario, bordes y foco del teclado más marcados.' },
  { campo: 'reducedMotion', texto: 'Menos movimiento', ayuda: 'Quita animaciones, confeti y fondos animados aunque tu sistema no lo pida.' },
  { campo: 'readingSpacing', texto: 'Espaciado de lectura', ayuda: 'Más espacio entre letras, palabras y líneas para leer con menos esfuerzo.' },
  { campo: 'underlineLinks', texto: 'Subrayar enlaces', ayuda: 'Los enlaces se distinguen sin depender del color.' },
];

// Grupo de opciones excluyentes con aspecto de botones.
function Segmentos({ leyenda, nombre, opciones, valor, alCambiar }) {
  return (
    <fieldset className="grupo-opciones">
      <legend>{leyenda}</legend>
      <div className="segmentos">
        {opciones.map((opcion) => (
          <label key={opcion.valor}>
            <input type="radio" name={nombre} value={opcion.valor} checked={valor === opcion.valor} onChange={() => alCambiar(opcion.valor)} />
            {opcion.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Interruptor({ texto, ayuda, activo, alCambiar }) {
  const id = useId();
  return (
    <li>
      <input id={id} type="checkbox" checked={activo} onChange={(evento) => alCambiar(evento.target.checked)} aria-describedby={`${id}-ayuda`} />
      <label htmlFor={id}>{texto}</label>
      <small id={`${id}-ayuda`}>{ayuda}</small>
    </li>
  );
}

// Zonas horarias que conoce el navegador; si no las expone, se ofrecen la actual y la sugerida.
function useZonas(actual) {
  return useMemo(() => {
    let zonas = [];
    try {
      zonas = Intl.supportedValuesOf?.('timeZone') ?? [];
    } catch {
      zonas = [];
    }
    return [...new Set([actual, zonaDelNavegador(), ...zonas].filter(Boolean))].sort();
  }, [actual]);
}

// Perfil, apariencia, accesibilidad y metas de estudio.
export default function Configuracion() {
  const { usuario, preferencias, guardarPreferencias } = useSesion();
  const [estadoPreferencias, setEstadoPreferencias] = useState('');
  const ajustes = useEnvio();
  const zonas = useZonas(preferencias.timeZone);
  const sugerida = zonaDelNavegador();

  // Cada cambio se ve al instante y se guarda en la cuenta.
  async function cambiar(cambios) {
    setEstadoPreferencias('Guardando…');
    const resultado = await ajustes.ejecutar(() => guardarPreferencias(cambios));
    setEstadoPreferencias(resultado ? 'Preferencias guardadas en tu cuenta.' : '');
  }

  return (
    <>
      <h1>Configuración</h1>
      <section className="tarjeta" aria-labelledby="titulo-perfil">
        <h2 id="titulo-perfil">Perfil</h2>
        <FotoPerfil />
        <DatosPersonales />
      </section>

      <section className="tarjeta" aria-labelledby="titulo-seguridad">
        <h2 id="titulo-seguridad">Acceso y seguridad</h2>
        <h3>Correo de acceso</h3>
        <CambiarCorreo />
        <h3>Contraseña</h3>
        <CambiarContrasena />
      </section>

      <section className="tarjeta" aria-labelledby="titulo-apariencia">
        <h2 id="titulo-apariencia">Apariencia y accesibilidad</h2>
        <p className="tenue">Se aplican al momento y te acompañan en cualquier equipo donde inicies sesión.</p>
        <Segmentos leyenda="Tema" nombre="tema" opciones={TEMAS} valor={preferencias.theme} alCambiar={(theme) => cambiar({ theme })} />
        <Segmentos leyenda="Tamaño del texto" nombre="texto" opciones={TAMANOS} valor={preferencias.textScale} alCambiar={(textScale) => cambiar({ textScale })} />
        <ul className="interruptores">
          {AJUSTES.map((ajuste) => (
            <Interruptor key={ajuste.campo} texto={ajuste.texto} ayuda={ajuste.ayuda} activo={Boolean(preferencias[ajuste.campo])}
              alCambiar={(valor) => cambiar({ [ajuste.campo]: valor })} />
          ))}
        </ul>
        <p className="tenue pequeno estado-guardado" role="status">{estadoPreferencias}</p>
        <MensajeError error={ajustes.error} />
      </section>

      {usuario.role === 'student' && (
        <section className="tarjeta" aria-labelledby="titulo-metas">
          <h2 id="titulo-metas">Metas de estudio</h2>
          <p className="tenue">Las usa tu plan de estudio y la práctica diaria. Puedes cambiarlas cuando quieras.</p>
          <Campo etiqueta="Minutos de estudio por día" tipo="select" valor={preferencias.dailyGoalMinutes ?? ''}
            alCambiar={(valor) => cambiar({ dailyGoalMinutes: valor ? Number(valor) : null })}
            opciones={[{ valor: '', texto: 'Sin meta' }, ...[15, 30, 45, 60, 90, 120].map((minutos) => ({ valor: minutos, texto: `${minutos} minutos` }))]}
            ayuda="Es la duración que te propondrá el plan de estudio para cada día." />
          <Campo etiqueta="Preguntas en la práctica diaria" tipo="select" valor={preferencias.practiceSize}
            alCambiar={(valor) => cambiar({ practiceSize: Number(valor) })}
            opciones={[5, 10, 15].map((cantidad) => ({ valor: cantidad, texto: `${cantidad} preguntas` }))}
            ayuda="La racha se mantiene al completar la cantidad elegida. El cambio cuenta desde la práctica de mañana." />
          <ul className="interruptores">
            <Interruptor texto="Recordatorios por correo" ayuda="Un correo diario con tareas por vencer y la práctica pendiente. Apágalo si no quieres recibirlo."
              activo={preferencias.emailReminders !== false} alCambiar={(valor) => cambiar({ emailReminders: valor })} />
          </ul>
          <Campo etiqueta="Zona horaria" tipo="select" valor={preferencias.timeZone ?? ''}
            alCambiar={(valor) => cambiar({ timeZone: valor || null })}
            opciones={[{ valor: '', texto: 'Sin elegir' }, ...zonas.map((zona) => ({ valor: zona, texto: zona.replaceAll('_', ' ') }))]}
            ayuda="Define qué día es «hoy» en tu plan de estudio." />
          {!preferencias.timeZone && sugerida && (
            <button type="button" className="boton secundario" onClick={() => cambiar({ timeZone: sugerida })}>
              Usar la de este equipo ({sugerida.replaceAll('_', ' ')})
            </button>
          )}
        </section>
      )}

      <PrivacidadDatos />

      <section className="tarjeta">
        <h2>Cuenta</h2>
        <ul className="lista-simple">
          <li><span>Correo</span><span className="tenue">{usuario.email}</span></li>
          <li><span>Rol</span><span className="tenue">{ROLES[usuario.role]}</span></li>
          {usuario.institutionName && <li><span>Institución</span><span className="tenue">{usuario.institutionName}</span></li>}
        </ul>
        <p className="tenue pequeno">El rol y la institución los administra tu institución.</p>
      </section>
    </>
  );
}
