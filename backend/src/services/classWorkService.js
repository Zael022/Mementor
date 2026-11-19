import { ClassWorkGrade, ClassWorkItem, Enrollment, sequelize } from '../models/index.js';
import { forbidden, invalid, notFound } from '../utils/AppError.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';

const itemDto = (item) => ({
  id: item.id,
  courseId: item.courseId,
  title: item.title,
  maxPoints: item.maxPoints,
  workDate: item.workDate,
});

const gradeDto = (grade) => ({
  studentId: grade.studentId,
  points: Number(grade.points),
  feedback: grade.feedback,
});

// Crea una actividad de trabajo en clase.
export async function createItem(user, courseId, { title, maxPoints, workDate }) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const item = await ClassWorkItem.create({ courseId: course.id, title, maxPoints, workDate: workDate || null, createdBy: user.id });
  return { ...itemDto(item), grades: [] };
}

// Lista las actividades; el docente ve todas las notas y el estudiante solo las suyas.
export async function listItems(user, courseId) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const items = await ClassWorkItem.findAll({
    where: { courseId: course.id },
    include: [{ model: ClassWorkGrade, as: 'grades', required: false, ...(canEdit ? {} : { where: { studentId: user.id } }) }],
    order: [['workDate', 'DESC'], ['id', 'DESC']],
  });
  return items.map((item) => ({ ...itemDto(item), grades: item.grades.map(gradeDto) }));
}

async function loadItem(user, itemId, transaction) {
  const item = itemId ? await ClassWorkItem.findByPk(itemId, { transaction }) : null;
  if (!item) throw notFound('Actividad no encontrada.');
  await getCourseAccess(user, item.courseId, { write: true, transaction });
  return item;
}

// Borra una actividad con sus calificaciones.
export async function deleteItem(user, itemId) {
  const item = await loadItem(user, itemId);
  await sequelize.transaction(async (transaction) => {
    await recordAudit({ actor: user, action: 'class_work.deleted', resourceType: 'class_work_item', resourceId: item.id, transaction });
    await item.destroy({ transaction });
  });
}

// Guarda varias calificaciones a la vez; solo para estudiantes activos del curso.
export async function saveGrades(user, itemId, grades) {
  if (user.role === 'student') throw forbidden();
  return sequelize.transaction(async (transaction) => {
    const item = await loadItem(user, itemId, transaction);
    const ids = [...new Set(grades.map((grade) => grade.studentId))];
    if (ids.length !== grades.length) throw invalid('Hay más de una nota para el mismo estudiante.');
    const enrolled = await Enrollment.findAll({ where: { courseId: item.courseId, studentId: ids, status: 'active' }, attributes: ['studentId'], transaction });
    if (enrolled.length !== ids.length) throw invalid('Una de las notas es de alguien que no está matriculado en el curso.');

    for (const grade of grades) {
      if (grade.points === null) {
        await ClassWorkGrade.destroy({ where: { itemId: item.id, studentId: grade.studentId }, transaction });
        continue;
      }
      if (grade.points > item.maxPoints) throw invalid(`La nota no puede pasar de ${item.maxPoints} puntos.`);
      await ClassWorkGrade.upsert({
        itemId: item.id, studentId: grade.studentId, points: grade.points, feedback: grade.feedback || null, gradedBy: user.id,
      }, { transaction });
    }
    await recordAudit({ actor: user, action: 'class_work.graded', resourceType: 'class_work_item', resourceId: item.id, metadata: { count: grades.length }, transaction });
    const saved = await ClassWorkGrade.findAll({ where: { itemId: item.id }, transaction });
    return { ...itemDto(item), grades: saved.map(gradeDto) };
  });
}
