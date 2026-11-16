import { Course, CourseTeacher, Enrollment } from '../models/index.js';
import { forbidden, notFound } from '../utils/AppError.js';

// Verifica el acceso a un curso según rol, institución y relación con el curso.
export async function getCourseAccess(user, courseId, { write = false, transaction } = {}) {
  const course = courseId ? await Course.findByPk(courseId, { transaction }) : null;
  // Un curso de otra institución se trata como inexistente para no filtrar datos.
  if (!course || !user.institutionId || course.institutionId !== user.institutionId) {
    throw notFound('Curso no encontrado.');
  }

  if (user.role === 'institution_admin') return { course, canEdit: true };

  if (user.role === 'teacher') {
    const assigned = await CourseTeacher.findOne({ where: { courseId: course.id, userId: user.id }, transaction });
    if (!assigned) throw forbidden('No eres docente de este curso.');
    return { course, canEdit: true };
  }

  if (user.role === 'student') {
    if (write) throw forbidden();
    const enrollment = await Enrollment.findOne({ where: { courseId: course.id, studentId: user.id, status: 'active' }, transaction });
    if (!enrollment || course.status !== 'published') throw forbidden('No estás matriculado en este curso.');
    return { course, canEdit: false };
  }

  throw forbidden();
}
