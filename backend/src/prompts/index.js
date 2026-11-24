import { createHash } from 'node:crypto';
import { AGENT_PROMPTS } from './agentes.js';
import { AGENT_COMMON_PROMPT } from './comun.js';
import { TUTOR_PROMPT } from './tutor.js';

// Punto único de los prompts de MENTOR AI. Cada uno tiene `id`, `version` y `text`.
// prompts.lock.json guarda la huella de cada versión: si cambia el texto sin subir la versión, una prueba falla.

export { AGENT_COMMON_PROMPT, AGENT_PROMPTS, TUTOR_PROMPT };

export const ALL_PROMPTS = [TUTOR_PROMPT, AGENT_COMMON_PROMPT, ...Object.values(AGENT_PROMPTS)];

// JSON con las llaves ordenadas: la huella no depende del orden en que se escribieron.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export const fingerprint = (prompt) => createHash('sha256').update(canonical(prompt.text)).digest('hex');

// Etiqueta que se guarda en agent_runs y ai_usage_events, por ejemplo «lesson_summarizer@1.0.0+agentes-comun@1.0.0».
export const tutorPromptVersion = () => `${TUTOR_PROMPT.id}@${TUTOR_PROMPT.version}`;
export const agentPromptVersion = (key) => `${key}@${AGENT_PROMPTS[key].version}+${AGENT_COMMON_PROMPT.id}@${AGENT_COMMON_PROMPT.version}`;

// Completa las partes {nombre} de una plantilla con valores ya validados por el servidor.
export const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
