import * as institutionService from '../services/institutionService.js';
import * as userService from '../services/userService.js';
import { listAudit } from '../services/auditService.js';
import { readId, readPagination } from '../utils/http.js';

// --- Instituciones (administrador de plataforma) ---
export async function listInstitutions(req, res) {
  res.json(await institutionService.listInstitutions(readPagination(req.query)));
}

export async function createInstitution(req, res) {
  res.status(201).json({ data: await institutionService.createInstitution(req.user, req.body) });
}

export async function listInstitutionAdmins(req, res) {
  res.json({ data: await institutionService.listInstitutionAdmins(readId(req.params.institutionId)) });
}

export async function inviteInstitutionAdmin(req, res) {
  const data = await userService.inviteUser(req.user, { ...req.body, role: 'institution_admin', institutionId: readId(req.params.institutionId) });
  res.status(201).json({ data });
}

// --- Usuarios (administrador de institución) ---
export async function listUsers(req, res) {
  res.json(await userService.listUsers(req.user, { role: req.query.role, q: req.query.q, pagination: readPagination(req.query) }));
}

export async function inviteUser(req, res) {
  res.status(201).json({ data: await userService.inviteUser(req.user, req.body) });
}

export async function updateUser(req, res) {
  res.json({ data: await userService.updateUser(req.user, readId(req.params.userId), req.body) });
}

export async function renewInvitation(req, res) {
  res.json({ data: await userService.renewInvitation(req.user, readId(req.params.userId)) });
}

// --- Auditoría ---
export async function auditLogs(req, res) {
  res.json(await listAudit(req.user, readPagination(req.query)));
}
