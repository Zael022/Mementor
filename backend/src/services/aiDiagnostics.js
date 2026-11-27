import { buildRequest, MODEL_TIERS, readAiConfig } from './aiProvider.js';

// Diagnóstico de la IA para `npm run ia:verificar`: revisa la configuración de cada nivel de modelo y hace
// una llamada mínima real (pocos tokens) para confirmar clave, modelo y créditos. Nunca muestra la clave.

// Funciones de MENTOR que usan la IA y el nivel de modelo de cada una (ADR 0009, docs/agentes-ia.md).
export const FUNCIONES_IA = [
  { clave: 'tutor', nombre: 'Tutor del curso (estudiantes)', nivel: 'avanzado', requisito: 'Además necesita lecciones publicadas o materiales del curso.' },
  { clave: 'question_generator', nombre: 'Generador de preguntas (docentes)', nivel: 'avanzado', requisito: 'Además necesita material del curso.' },
  { clave: 'feedback_assistant', nombre: 'Asistente de retroalimentación de entregas (docentes)', nivel: 'avanzado' },
  { clave: 'compliance_checker', nombre: 'Asistente de cumplimiento (Ley 8968)', nivel: 'avanzado' },
  { clave: 'course_analyst', nombre: 'Analista del curso (docentes)', nivel: 'rapido' },
  { clave: 'announcement_writer', nombre: 'Redactor de anuncios (docentes)', nivel: 'rapido' },
  { clave: 'study_coach', nombre: 'Coach de estudio (estudiantes)', nivel: 'rapido' },
  { clave: 'lesson_summarizer', nombre: 'Resumen de lección', nivel: 'rapido' },
  { clave: 'admissions_writer', nombre: 'Redactor de admisiones (CRM)', nivel: 'rapido' },
];

// Traduce la respuesta del proveedor a una explicación en español con el paso que falta.
export function explicarFallo(status, cuerpo = {}) {
  const tipo = cuerpo?.error?.type || cuerpo?.error?.code || '';
  const mensaje = String(cuerpo?.error?.message || '').toLowerCase();
  if (status === 401) return 'La clave (AI_API_KEY) no es válida o fue revocada. Crea una nueva en la consola del proveedor y cópiala completa.';
  if (status === 403) return 'La clave no tiene permiso para usar este modelo o esta organización.';
  if (mensaje.includes('credit') || mensaje.includes('billing') || mensaje.includes('balance') || tipo === 'insufficient_quota') {
    return 'La cuenta del proveedor no tiene saldo. Agrega créditos en la sección de facturación de su consola.';
  }
  if (status === 404 || tipo === 'not_found_error' || (status === 400 && mensaje.includes('model'))) {
    return 'El modelo no existe o tu cuenta no tiene acceso. Revisa AI_MODEL (y AI_MODEL_RAPIDO o AI_MODEL_AVANZADO).';
  }
  if (status === 429) return 'El proveedor limitó las solicitudes por ahora (demasiadas llamadas). Espera un minuto e intenta otra vez.';
  if (status === 529 || status >= 500) return 'El proveedor está saturado o con fallas en este momento. Intenta más tarde.';
  if (status === 400) return 'El proveedor rechazó la solicitud. Revisa AI_PROVIDER, AI_MODEL y AI_BASE_URL.';
  return `El proveedor respondió con el estado ${status}.`;
}

// Avisos que no impiden la llamada pero suelen explicar por qué «no funciona».
function avisosDe(config) {
  const avisos = [];
  if (/127\.0\.0\.1|localhost/.test(config.url)) avisos.push('AI_BASE_URL apunta a esta computadora (un servidor de prueba). Para usar la IA real, déjalo vacío.');
  if (config.provider === 'anthropic' && !config.apiKey.startsWith('sk-ant-')) avisos.push('La clave de Anthropic suele empezar con «sk-ant-». Revisa que la copiaste completa.');
  if (/\s/.test(config.apiKey)) avisos.push('La clave tiene espacios o saltos de línea. Pégala en una sola línea.');
  return avisos;
}

// Revisa un nivel de modelo: configuración y una llamada mínima.
async function revisarNivel(nivel, fetchImpl) {
  const config = readAiConfig({ tier: nivel });
  if (!config.configured) return { nivel, configurado: false, funciona: false, motivo: config.reason, avisos: [] };
  const avisos = avisosDe(config);
  const solicitud = buildRequest(config, { system: 'Responde solo con la palabra OK.', messages: [{ role: 'user', content: 'Prueba de conexión de MENTOR IA.' }], maxTokens: 5 });
  let respuesta;
  try {
    respuesta = await fetchImpl(config.url, { method: 'POST', headers: solicitud.headers, body: JSON.stringify(solicitud.body), signal: AbortSignal.timeout(20000) });
  } catch {
    return { nivel, configurado: true, funciona: false, modelo: config.model, motivo: 'No se pudo conectar con el proveedor. Revisa tu conexión a internet o AI_BASE_URL.', avisos };
  }
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) return { nivel, configurado: true, funciona: false, modelo: config.model, estado: respuesta.status, motivo: explicarFallo(respuesta.status, cuerpo), avisos };
  const texto = solicitud.readText(cuerpo);
  return { nivel, configurado: true, funciona: Boolean(texto), modelo: config.model, motivo: texto ? null : 'El proveedor respondió vacío.', avisos };
}

export async function diagnosticarIA({ fetchImpl = fetch } = {}) {
  const niveles = {};
  // Si los dos niveles usan el mismo modelo, basta una llamada.
  const mismoModelo = readAiConfig({ tier: 'rapido' }).model === readAiConfig({ tier: 'avanzado' }).model;
  for (const nivel of MODEL_TIERS) {
    niveles[nivel] = mismoModelo && nivel === 'avanzado' && niveles.rapido
      ? { ...niveles.rapido, nivel }
      : await revisarNivel(nivel, fetchImpl);
  }
  const funciones = FUNCIONES_IA.map((funcion) => ({ ...funcion, funciona: niveles[funcion.nivel].funciona }));
  return { niveles, funciones, todo: funciones.every((funcion) => funcion.funciona) };
}
