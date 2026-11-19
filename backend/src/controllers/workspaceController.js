import * as workspaceService from '../services/workspaceService.js';
import { readId } from '../utils/http.js';

// Personas del curso.
export async function people(req, res) {
  res.json({ data: await workspaceService.getPeople(req.user, readId(req.params.courseId)) });
}

// Calendario semanal de entregas y clases.
export async function calendar(req, res) {
  const { from, to, courseId } = req.query;
  res.json({ data: await workspaceService.getCalendar(req.user, { from, to, courseId: courseId ? readId(courseId) : null }) });
}

// Pendientes del usuario.
export async function todo(req, res) {
  res.json({ data: await workspaceService.getTodo(req.user) });
}

// Perfil propio.
export async function updateProfile(req, res) {
  res.json({ data: await workspaceService.updateProfile(req.user, req.body) });
}
