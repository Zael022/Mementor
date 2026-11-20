import { Op } from 'sequelize';
import {
  Course, CourseTeacher, Enrollment, User, Module, Topic, TopicPrerequisite, Lesson, LessonProgress, sequelize,
} from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { pageMeta } from '../utils/http.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';

const toDto = (course) => ({
  id: course.id,
  code: course.code,
  title: course.title,
  description: course.description,
  status: course.status,
  createdAt: course.createdAt,
});

// Lista solo los cursos que el usuario puede ver.
export async function listCourses(user, pagination) {
  if (!user.institutionId) return { data: [], meta: pageMeta(pagination, 0) };
  const where = { institutionId: user.institutionId };

  if (user.role === 'teacher') {
    const links = await CourseTeacher.findAll({ where: { userId: user.id }, attributes: ['courseId'] });
    where.id = { [Op.in]: links.map((link) => link.courseId) };
  }
  if (user.role === 'student') {
    const links = await Enrollment.findAll({ where: { studentId: user.id, status: 'active' }, attributes: ['courseId'] });
    where.id = { [Op.in]: links.map((link) => link.courseId) };
    where.status = 'published';
  }

  const { rows, count } = await Course.findAndCountAll({ where, order: [['title', 'ASC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows.map(toDto), meta: pageMeta(pagination, count) };
}

// Crea un curso en la institución del usuario.
export async function createCourse(user, { code, title, description }) {
  if (await Course.findOne({ where: { institutionId: user.institutionId, code } })) {
    throw conflict('CODE_IN_USE', 'Ya existe un curso con ese código en tu institución.');
  }
  return sequelize.transaction(async (transaction) => {
    const course = await Course.create({ institutionId: user.institutionId, code, title, description: description || null, createdBy: user.id }, { transaction });
    if (user.role === 'teacher') await CourseTeacher.create({ courseId: course.id, userId: user.id }, { transaction });
    await recordAudit({ actor: user, action: 'course.created', resourceType: 'course', resourceId: course.id, transaction });
    return toDto(course);
  });
}

// Devuelve el curso con módulos, temas y lecciones visibles para el usuario.
export async function getCourseDetail(user, courseId) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const lessonWhere = canEdit ? {} : { status: 'published' };

  const [modules, teachers, prerequisites, completed] = await Promise.all([
    Module.findAll({
      where: { courseId: course.id },
      include: [{
        model: Topic, as: 'topics', required: false,
        include: [{ model: Lesson, as: 'lessons', required: false, where: lessonWhere, attributes: ['id', 'title', 'status', 'position'] }],
      }],
      order: [['position', 'ASC'], ['id', 'ASC'], [{ model: Topic, as: 'topics' }, 'position', 'ASC'], [{ model: Topic, as: 'topics' }, 'id', 'ASC'],
        [{ model: Topic, as: 'topics' }, { model: Lesson, as: 'lessons' }, 'position', 'ASC']],
    }),
    course.getTeachers({ attributes: ['id', 'displayName', 'email'], joinTableAttributes: [] }),
    TopicPrerequisite.findAll({
      include: [{ model: Topic, as: 'topic', attributes: [], where: { courseId: course.id } }],
      attributes: ['topicId', 'prerequisiteTopicId'],
    }),
    user.role === 'student'
      ? LessonProgress.findAll({ where: { studentId: user.id }, attributes: ['lessonId'] })
      : [],
  ]);

  const completedIds = new Set(completed.map((row) => row.lessonId));
  const prerequisitesByTopic = new Map();
  for (const row of prerequisites) {
    prerequisitesByTopic.set(row.topicId, [...(prerequisitesByTopic.get(row.topicId) || []), row.prerequisiteTopicId]);
  }

  return {
    ...toDto(course),
    canEdit,
    teachers: teachers.map((teacher) => ({ id: teacher.id, displayName: teacher.displayName, ...(canEdit ? { email: teacher.email } : {}) })),
    modules: modules.map((module) => ({
      id: module.id,
      title: module.title,
      position: module.position,
      topics: module.topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        learningObjective: topic.learningObjective,
        position: topic.position,
        prerequisiteIds: prerequisitesByTopic.get(topic.id) || [],
        lessons: topic.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          status: lesson.status,
          position: lesson.position,
          ...(user.role === 'student' ? { completed: completedIds.has(lesson.id) } : {}),
        })),
      })),
    })),
  };
}

// Actualiza los datos o el estado del curso.
export async function updateCourse(user, courseId, changes) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const wasStatus = course.status;
  await course.update(changes);
  if (changes.status && changes.status !== wasStatus) {
    await recordAudit({ actor: user, action: `course.${changes.status}`, resourceType: 'course', resourceId: course.id });
  }
  return toDto(course);
}

async function findInstitutionUser(user, userId, role) {
  const found = await User.findOne({ where: { id: userId, institutionId: user.institutionId, role } });
  if (!found) throw notFound(role === 'teacher' ? 'Docente no encontrado en tu institución.' : 'Estudiante no encontrado en tu institución.');
  if (found.status === 'disabled') throw invalid('La cuenta está deshabilitada.');
  return found;
}

// Asigna un docente al curso (solo administración).
export async function assignTeacher(user, courseId, teacherId) {
  if (user.role !== 'institution_admin') throw forbidden();
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const teacher = await findInstitutionUser(user, teacherId, 'teacher');
  await CourseTeacher.findOrCreate({ where: { courseId: course.id, userId: teacher.id } });
  await recordAudit({ actor: user, action: 'course.teacher_assigned', resourceType: 'course', resourceId: course.id, metadata: { teacherId: teacher.id } });
  return { courseId: course.id, teacherId: teacher.id };
}

// Quita un docente del curso (solo administración).
export async function removeTeacher(user, courseId, teacherId) {
  if (user.role !== 'institution_admin') throw forbidden();
  const { course } = await getCourseAccess(user, courseId, { write: true });
  await CourseTeacher.destroy({ where: { courseId: course.id, userId: teacherId } });
  await recordAudit({ actor: user, action: 'course.teacher_removed', resourceType: 'course', resourceId: course.id, metadata: { teacherId } });
}

// Lista las matrículas del curso.
export async function listEnrollments(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const rows = await Enrollment.findAll({
    where: { courseId: course.id },
    include: [{ model: User, as: 'student', attributes: ['id', 'displayName', 'email', 'status'] }],
    order: [[{ model: User, as: 'student' }, 'displayName', 'ASC']],
  });
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    student: { id: row.student.id, displayName: row.student.displayName, email: row.student.email, status: row.student.status },
  }));
}

// Lista estudiantes de la institución que aún no están matriculados.
export async function listEnrollableStudents(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const enrolled = await Enrollment.findAll({ where: { courseId: course.id, status: 'active' }, attributes: ['studentId'] });
  const students = await User.findAll({
    where: {
      institutionId: user.institutionId,
      role: 'student',
      status: { [Op.ne]: 'disabled' },
      id: { [Op.notIn]: enrolled.map((row) => row.studentId) },
    },
    attributes: ['id', 'displayName', 'email'],
    order: [['displayName', 'ASC']],
    limit: 200,
  });
  return students.map((student) => ({ id: student.id, displayName: student.displayName, email: student.email }));
}

// Matricula a un estudiante de la misma institución; si estaba retirado, lo reintegra con su historial.
export async function enrollStudent(user, courseId, studentId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const student = await findInstitutionUser(user, studentId, 'student');
  const [enrollment, created] = await Enrollment.findOrCreate({
    where: { courseId: course.id, studentId: student.id },
    defaults: { status: 'active' },
  });
  if (!created && enrollment.status === 'active') throw conflict('ALREADY_ENROLLED', 'El estudiante ya está matriculado.');
  if (!created) await enrollment.update({ status: 'active' });
  const action = created ? 'enrollment.created' : 'enrollment.reinstated';
  await recordAudit({ actor: user, action, resourceType: 'course', resourceId: course.id, metadata: { studentId: student.id } });
  return {
    id: enrollment.id,
    status: 'active',
    reinstated: !created,
    student: { id: student.id, displayName: student.displayName, email: student.email },
  };
}

// Retira la matrícula sin borrar el historial.
export async function withdrawEnrollment(user, courseId, enrollmentId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const enrollment = await Enrollment.findOne({ where: { id: enrollmentId, courseId: course.id } });
  if (!enrollment) throw notFound('Matrícula no encontrada.');
  await enrollment.update({ status: 'withdrawn' });
  await recordAudit({ actor: user, action: 'enrollment.withdrawn', resourceType: 'course', resourceId: course.id, metadata: { studentId: enrollment.studentId } });
}
