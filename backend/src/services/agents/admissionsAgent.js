import { z } from 'zod';
import { admissionContext } from '../crmContextService.js';
import { asData } from '../tutorService.js';
import { conflict } from '../../utils/AppError.js';
import { AGENT_PROMPTS } from '../../prompts/index.js';
import { externalLinks, looksLikeInjection, numbersOutside, personalDataLeaks } from '../../utils/outputGuard.js';

const P = AGENT_PROMPTS.admissions_writer.text;

export const admissionsAgent = {
  workflowOnly: true, link: { institution_admin: '/admisiones/candidatos' },
  key: 'admissions_writer', name: 'Redactor de admisiones', purpose: 'Propone un mensaje pendiente de revisión humana para una solicitud autorizada.',
  roles: ['institution_admin'], inputs: ['Solicitud', 'Canal', 'Objetivo'], provider: 'AI_PROVIDER/AI_MODEL', privacy: 'No envía nombre, correo, teléfono, notas ni historial académico.',
  inputSchema: z.object({ solicitudId: z.number().int().positive(), canal: z.enum(['correo', 'telefono']), objetivo: z.string().trim().min(5).max(300), tono: z.enum(['cercano', 'formal']), contextoEsperado: z.string().length(64) }).strict(),
  async buildContext(actor, input) {
    const context = await admissionContext(actor, input.solicitudId, input.canal, input.objetivo, input.tono);
    if (context.hash !== input.contextoEsperado) throw conflict('STALE_CONTEXT', 'El contexto cambió. Actualiza la ficha antes de generar.');
    return { courseId: context.courseId, data: context.data };
  },
  // Borrador breve a partir de condiciones ya autorizadas: modelo rápido (ADR 0009). Lo revisa una persona.
  tier: 'rapido',
  system: P.system,
  prompt: ({ data }) => `<dato>${asData(JSON.stringify(data))}</dato>\n${P.task}`,
  // Sin datos de identidad ni enlaces externos, y sin fechas, cupos o cifras que no estén en las condiciones autorizadas.
  guard: (output, { data }) => {
    const allowed = JSON.stringify(data);
    if (personalDataLeaks(output, allowed).length) return { block: 'personal_data' };
    if (externalLinks(output, allowed).length) return { block: 'external_link' };
    if (numbersOutside({ texto: output.texto }, allowed).length) return { block: 'unsupported_number' };
    return looksLikeInjection(allowed) ? { alert: 'injection_suspected' } : {};
  },
  maxTokens: 900,
  outputSchema: z.object({ texto: z.string().trim().min(10).max(3000), faltantes: z.array(z.string().max(200)).max(8) }).strict(),
};
