import { catalogFor, listRuns, runAgent } from '../services/agents/agentRunner.js';

// Asistentes disponibles para el rol de la sesión.
export function catalog(req, res) {
  res.json({ data: catalogFor(req.user) });
}

// Ejecuta un asistente con las entradas del formulario.
export async function run(req, res) {
  res.json({ data: await runAgent(req.user, req.params.key, req.body) });
}

// Bitácora propia.
export async function myRuns(req, res) {
  res.json({ data: await listRuns(req.user, { scope: 'mine' }) });
}

// Bitácora de la institución (administración y auditoría).
export async function institutionRuns(req, res) {
  res.json({ data: await listRuns(req.user, { scope: 'institution' }) });
}
