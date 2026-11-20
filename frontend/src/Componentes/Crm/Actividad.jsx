import Campo from '../Campo.jsx';

export const actividadVacia = () => ({ tipo: 'campus', programada: '', efectiva: '', resultado: '', evidencia: '' });
export function payloadActividad(value) {
  return { tipo: value.tipo, ...(value.programada ? { programada: new Date(value.programada).toISOString() } : {}), ...(value.efectiva ? { efectiva: new Date(value.efectiva).toISOString() } : {}), ...(value.resultado ? { resultado: value.resultado, evidencia: value.evidencia } : {}) };
}
export default function Actividad({ value, set, soloEntrevista = false }) {
  const change = (key) => (v) => set({ ...value, [key]: v });
  const tipos = soloEntrevista ? ['entrevista'] : ['campus', 'tecnica', 'entrevista', 'prueba'];
  return <fieldset><legend>Datos de actividad (sin calificaciones del aula)</legend><div className="fila-formulario"><Campo etiqueta="Actividad" tipo="select" valor={value.tipo} alCambiar={change('tipo')} opciones={tipos.map((s) => ({ valor: s, texto: s }))} /><Campo etiqueta="Fecha programada" tipo="datetime-local" valor={value.programada} alCambiar={change('programada')} /><Campo etiqueta="Fecha realizada" tipo="datetime-local" valor={value.efectiva} alCambiar={change('efectiva')} /><Campo etiqueta="Resultado registrado" tipo="select" valor={value.resultado} alCambiar={change('resultado')} opciones={[{ valor: '', texto: 'Sin registrar' }, ...['asistio', 'no_asistio', 'aprobada', 'no_aprobada', 'favorable', 'desfavorable', 'completada'].map((s) => ({ valor: s, texto: s.replaceAll('_', ' ') }))]} /></div><Campo etiqueta="Referencia de evidencia autorizada" maxLength={300} valor={value.evidencia} alCambiar={change('evidencia')} ayuda="Referencia interna verificada; evita información sensible. Una cita programada no demuestra asistencia." /></fieldset>;
}
