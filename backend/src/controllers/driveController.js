import * as driveSync from '../services/driveSyncService.js';
import { readId } from '../utils/http.js';

// --- Carpetas habilitadas por la institución ---
export async function listFolders(req, res) {
  res.json({ data: await driveSync.listFolders(req.user) });
}

export async function addFolder(req, res) {
  res.status(201).json({ data: await driveSync.addFolder(req.user, req.body) });
}

export async function disableFolder(req, res) {
  res.json({ data: await driveSync.disableFolder(req.user, readId(req.params.folderId)) });
}

// --- Vínculo y sincronización de un curso ---
export async function courseDrive(req, res) {
  res.json({ data: await driveSync.getCourseDrive(req.user, readId(req.params.courseId)) });
}

export async function linkFolder(req, res) {
  res.status(201).json({ data: await driveSync.linkFolder(req.user, readId(req.params.courseId), req.body) });
}

export async function unlinkFolder(req, res) {
  res.json({ data: await driveSync.unlinkFolder(req.user, readId(req.params.courseId)) });
}

export async function syncNow(req, res) {
  res.status(202).json({ data: await driveSync.startCourseSync(req.user, readId(req.params.courseId)) });
}
