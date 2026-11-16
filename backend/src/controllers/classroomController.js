import * as sessionService from '../services/sessionService.js';
import * as board from '../services/courseBoardService.js';
import * as assignmentService from '../services/assignmentService.js';
import { getStudentHome } from '../services/homeService.js';
import { readId } from '../utils/http.js';

const courseId = (req) => readId(req.params.courseId);

// --- Clases en vivo ---
export async function listSessions(req, res) {
  res.json({ data: await sessionService.listSessions(req.user, courseId(req)) });
}

export async function createSession(req, res) {
  res.status(201).json({ data: await sessionService.createSession(req.user, courseId(req), req.body) });
}

export async function updateSession(req, res) {
  res.json({ data: await sessionService.updateSession(req.user, readId(req.params.sessionId), req.body) });
}

export async function deleteSession(req, res) {
  await sessionService.deleteSession(req.user, readId(req.params.sessionId));
  res.status(204).end();
}

export async function joinSession(req, res) {
  res.json({ data: await sessionService.joinSession(req.user, readId(req.params.sessionId)) });
}

export async function sessionAttendance(req, res) {
  res.json({ data: await sessionService.getAttendance(req.user, readId(req.params.sessionId)) });
}

// --- Anuncios ---
export async function listAnnouncements(req, res) {
  res.json({ data: await board.listAnnouncements(req.user, courseId(req)) });
}

export async function createAnnouncement(req, res) {
  res.status(201).json({ data: await board.createAnnouncement(req.user, courseId(req), req.body) });
}

export async function deleteAnnouncement(req, res) {
  await board.deleteAnnouncement(req.user, readId(req.params.announcementId));
  res.status(204).end();
}

// --- Materiales ---
export async function listMaterials(req, res) {
  res.json({ data: await board.listMaterials(req.user, courseId(req), { lessonId: readId(req.query.lessonId) }) });
}

export async function createLinkMaterial(req, res) {
  res.status(201).json({ data: await board.createLinkMaterial(req.user, courseId(req), req.body) });
}

export async function uploadMaterial(req, res) {
  const data = await board.createFileMaterial(req.user, courseId(req), {
    title: String(req.body?.title || '').trim(),
    lessonId: readId(req.body?.lessonId),
    file: req.file,
  });
  res.status(201).json({ data });
}

// Envía el archivo siempre como descarga, nunca para abrirse dentro de la página.
export async function downloadMaterial(req, res) {
  const { filePath, fileName } = await board.getMaterialFile(req.user, readId(req.params.materialId));
  res.download(filePath, fileName);
}

export async function deleteMaterial(req, res) {
  await board.deleteMaterial(req.user, readId(req.params.materialId));
  res.status(204).end();
}

// --- Preguntas y respuestas ---
export async function listComments(req, res) {
  res.json({ data: await board.listComments(req.user, readId(req.params.lessonId)) });
}

export async function createComment(req, res) {
  res.status(201).json({ data: await board.createComment(req.user, readId(req.params.lessonId), req.body) });
}

export async function deleteComment(req, res) {
  await board.deleteComment(req.user, readId(req.params.commentId));
  res.status(204).end();
}

// --- Tareas ---
export async function listAssignments(req, res) {
  res.json({ data: await assignmentService.listAssignments(req.user, courseId(req)) });
}

export async function createAssignment(req, res) {
  res.status(201).json({ data: await assignmentService.createAssignment(req.user, courseId(req), req.body) });
}

export async function getAssignment(req, res) {
  res.json({ data: await assignmentService.getAssignment(req.user, readId(req.params.assignmentId)) });
}

export async function updateAssignment(req, res) {
  res.json({ data: await assignmentService.updateAssignment(req.user, readId(req.params.assignmentId), req.body) });
}

export async function deleteAssignment(req, res) {
  await assignmentService.deleteAssignment(req.user, readId(req.params.assignmentId));
  res.status(204).end();
}

export async function submitAssignment(req, res) {
  res.json({ data: await assignmentService.submitAssignment(req.user, readId(req.params.assignmentId), req.body) });
}

export async function gradeSubmission(req, res) {
  res.json({ data: await assignmentService.gradeSubmission(req.user, readId(req.params.submissionId), req.body) });
}

// --- Inicio del estudiante ---
export async function studentHome(req, res) {
  res.json({ data: await getStudentHome(req.user) });
}
