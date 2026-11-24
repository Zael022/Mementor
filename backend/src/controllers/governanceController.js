import { SESSION_COOKIE } from '../middlewares/auth.js';
import { POLICY_VERSIONS, acceptPolicies } from '../services/consentService.js';
import * as governance from '../services/governanceService.js';

// Versiones vigentes de los documentos legales (público).
export function versions(req, res) {
  res.json({ data: POLICY_VERSIONS });
}

export async function myConsents(req, res) {
  res.json({ data: await governance.myConsents(req.user) });
}

// Acepta las versiones vigentes de los documentos indicados.
export async function accept(req, res) {
  await acceptPolicies(req.user.id, req.body.documents);
  res.json({ data: await governance.myConsents(req.user) });
}

// Descarga de los datos personales propios.
export async function exportData(req, res) {
  res.set('content-disposition', 'attachment; filename="mis-datos-mentor-ai.json"');
  res.json({ data: await governance.exportMyData(req.user) });
}

// Solicitud de baja: se completa antes de responder y la cookie se borra solo cuando terminó.
export async function requestDeletion(req, res) {
  const result = await governance.requestDeletion(req.user, req.body);
  if (result.status === 'completed') res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(202).json({ data: result });
}

export async function deletionRequests(req, res) {
  res.json({ data: await governance.listDeletionRequests(req.user) });
}

export async function consentSummary(req, res) {
  res.json({ data: await governance.consentSummary(req.user) });
}
