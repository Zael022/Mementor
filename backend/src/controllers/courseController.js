import * as courseService from '../services/courseService.js';
import * as contentService from '../services/contentService.js';
import { readId, readPagination } from '../utils/http.js';

const courseId = (req) => readId(req.params.courseId);

// --- Cursos ---
export async function list(req, res) {
  res.json(await courseService.listCourses(req.user, readPagination(req.query)));
}

export async function create(req, res) {
  res.status(201).json({ data: await courseService.createCourse(req.user, req.body) });
}

export async function detail(req, res) {
  res.json({ data: await courseService.getCourseDetail(req.user, courseId(req)) });
}

export async function update(req, res) {
  res.json({ data: await courseService.updateCourse(req.user, courseId(req), req.body) });
}

// --- Docentes y matrículas ---
export async function assignTeacher(req, res) {
  res.status(201).json({ data: await courseService.assignTeacher(req.user, courseId(req), req.body.userId) });
}

export async function removeTeacher(req, res) {
  await courseService.removeTeacher(req.user, courseId(req), readId(req.params.userId));
  res.status(204).end();
}

export async function listEnrollments(req, res) {
  res.json({ data: await courseService.listEnrollments(req.user, courseId(req)) });
}

export async function listEnrollableStudents(req, res) {
  res.json({ data: await courseService.listEnrollableStudents(req.user, courseId(req)) });
}

export async function enroll(req, res) {
  res.status(201).json({ data: await courseService.enrollStudent(req.user, courseId(req), req.body.studentId) });
}

export async function withdraw(req, res) {
  await courseService.withdrawEnrollment(req.user, courseId(req), readId(req.params.enrollmentId));
  res.status(204).end();
}

// --- Módulos, temas y lecciones ---
export async function createModule(req, res) {
  res.status(201).json({ data: await contentService.createModule(req.user, courseId(req), req.body) });
}

export async function updateModule(req, res) {
  res.json({ data: await contentService.updateModule(req.user, readId(req.params.moduleId), req.body) });
}

export async function deleteModule(req, res) {
  await contentService.deleteModule(req.user, readId(req.params.moduleId));
  res.status(204).end();
}

export async function createTopic(req, res) {
  res.status(201).json({ data: await contentService.createTopic(req.user, readId(req.params.moduleId), req.body) });
}

export async function updateTopic(req, res) {
  res.json({ data: await contentService.updateTopic(req.user, readId(req.params.topicId), req.body) });
}

export async function deleteTopic(req, res) {
  await contentService.deleteTopic(req.user, readId(req.params.topicId));
  res.status(204).end();
}

export async function setPrerequisites(req, res) {
  res.json({ data: await contentService.setPrerequisites(req.user, readId(req.params.topicId), req.body.prerequisiteTopicIds) });
}

export async function createLesson(req, res) {
  res.status(201).json({ data: await contentService.createLesson(req.user, readId(req.params.topicId), req.body) });
}

export async function listLessons(req, res) {
  res.json({ data: await contentService.listLessons(req.user, readId(req.params.topicId)) });
}

export async function getLesson(req, res) {
  res.json({ data: await contentService.getLesson(req.user, readId(req.params.lessonId)) });
}

export async function updateLesson(req, res) {
  res.json({ data: await contentService.updateLesson(req.user, readId(req.params.lessonId), req.body) });
}

export async function deleteLesson(req, res) {
  await contentService.deleteLesson(req.user, readId(req.params.lessonId));
  res.status(204).end();
}

export async function completeLesson(req, res) {
  res.json({ data: await contentService.completeLesson(req.user, readId(req.params.lessonId)) });
}
