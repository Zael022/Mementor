import { Op } from 'sequelize';
import { Assignment, AssignmentSubmission, Enrollment, Topic, User, sequelize } from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { getCourseAccess } from './accessService.js';
import { recordAudit } from './auditService.js';

const assignmentDto = (row) => ({
  id: row.id,
  courseId: row.courseId,
  topicId: row.topicId,
  title: row.title,
  instructions: row.instructions,
  dueAt: row.dueAt,
  maxPoints: row.maxPoints,
  status: row.status,
});

const submissionDto = (row) => row && ({
  id: row.id,
  body: row.body,
  linkUrl: row.linkUrl,
  submittedAt: row.submittedAt,
  gradePoints: row.gradePoints,
  feedback: row.feedback,
  gradedAt: row.gradedAt,
});

async function loadAssignment(user, assignmentId, { write = false, transaction } = {}) {
  const assignment = assignmentId ? await Assignment.findByPk(assignmentId, { transaction }) : null;
  if (!assignment) throw notFound('Tarea no encontrada.');
  const access = await getCourseAccess(user, assignment.courseId, { write, transaction });
  if (!access.canEdit && assignment.status !== 'published') throw notFound('Tarea no encontrada.');
  return { assignment, ...access };
}

async function assertTopic(topicId, courseId) {
  if (!topicId) return;
  if (!(await Topic.findOne({ where: { id: topicId, courseId } }))) throw invalid('El tema indicado no pertenece a este curso.');
}

// Lista las tareas del curso con el estado de entrega de quien consulta.
export async function listAssignments(user, courseId) {
  const { course, canEdit } = await getCourseAccess(user, courseId);
  const assignments = await Assignment.findAll({
    where: { courseId: course.id, ...(canEdit ? {} : { status: 'published' }) },
    include: [{ model: AssignmentSubmission, as: 'submissions', attributes: ['id', 'studentId', 'gradePoints', 'submittedAt'] }],
    order: [['dueAt', 'ASC'], ['id', 'ASC']],
  });
  return assignments.map((assignment) => {
    const mine = assignment.submissions.find((row) => row.studentId === user.id);
    return {
      ...assignmentDto(assignment),
      ...(canEdit ? {
        submissionCount: assignment.submissions.length,
        pendingGradeCount: assignment.submissions.filter((row) => row.gradePoints === null).length,
      } : {
        submitted: Boolean(mine),
        gradePoints: mine?.gradePoints ?? null,
      }),
    };
  });
}

export async function createAssignment(user, courseId, data) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  await assertTopic(data.topicId, course.id);
  const assignment = await Assignment.create({ ...data, topicId: data.topicId || null, dueAt: data.dueAt || null, courseId: course.id });
  return assignmentDto(assignment);
}

// El puntaje máximo es el denominador de las notas ya emitidas: con entregas calificadas no se cambia,
// porque una entrega de 80/100 pasaría a valer 160 % sin que nadie la recalificara.
export async function updateAssignment(user, assignmentId, changes) {
  const { assignment: found } = await loadAssignment(user, assignmentId, { write: true });
  if (changes.topicId) await assertTopic(changes.topicId, found.courseId);
  return sequelize.transaction(async (transaction) => {
    const assignment = await Assignment.findByPk(found.id, { lock: transaction.LOCK.UPDATE, transaction });
    const wasStatus = assignment.status;
    const previousMax = assignment.maxPoints;
    const maxChanges = changes.maxPoints !== undefined && changes.maxPoints !== previousMax;
    if (maxChanges) {
      const graded = await AssignmentSubmission.count({ where: { assignmentId: assignment.id, gradePoints: { [Op.ne]: null } }, transaction });
      if (graded) {
        throw conflict('GRADED_MAX_LOCKED', `Esta tarea ya tiene ${graded} ${graded === 1 ? 'entrega calificada' : 'entregas calificadas'}: el puntaje máximo no se puede cambiar. Crea una tarea nueva si necesitas otra escala.`);
      }
    }
    await assignment.update(changes, { transaction });
    if (maxChanges) {
      await recordAudit({ actor: user, action: 'assignment.max_points_changed', resourceType: 'assignment', resourceId: assignment.id, metadata: { from: previousMax, to: changes.maxPoints }, transaction });
    }
    if (changes.status && changes.status !== wasStatus) {
      await recordAudit({ actor: user, action: `assignment.${changes.status}`, resourceType: 'assignment', resourceId: assignment.id, transaction });
    }
    return assignmentDto(assignment);
  });
}

export async function deleteAssignment(user, assignmentId) {
  const { assignment } = await loadAssignment(user, assignmentId, { write: true });
  await assignment.destroy();
}

// Detalle: el estudiante ve su entrega; el docente ve la de cada matriculado.
export async function getAssignment(user, assignmentId) {
  const { assignment, canEdit } = await loadAssignment(user, assignmentId);
  const data = { ...assignmentDto(assignment), canEdit };

  if (!canEdit) {
    const mine = await AssignmentSubmission.findOne({ where: { assignmentId: assignment.id, studentId: user.id } });
    return { ...data, submission: submissionDto(mine) };
  }

  const [enrollments, submissions] = await Promise.all([
    Enrollment.findAll({
      where: { courseId: assignment.courseId, status: 'active' },
      include: [{ model: User, as: 'student', attributes: ['id', 'displayName', 'email'] }],
      order: [[{ model: User, as: 'student' }, 'displayName', 'ASC']],
    }),
    AssignmentSubmission.findAll({ where: { assignmentId: assignment.id } }),
  ]);
  const byStudent = new Map(submissions.map((row) => [row.studentId, row]));
  return {
    ...data,
    students: enrollments.map((row) => ({
      id: row.student.id,
      displayName: row.student.displayName,
      email: row.student.email,
      submission: submissionDto(byStudent.get(row.student.id)),
    })),
  };
}

// Guarda o reemplaza la entrega del estudiante mientras no haya sido calificada.
export async function submitAssignment(user, assignmentId, { body, linkUrl }) {
  if (user.role !== 'student') throw forbidden('Solo los estudiantes entregan tareas.');
  return sequelize.transaction(async (transaction) => {
    const { assignment } = await loadAssignment(user, assignmentId, { transaction });
    const existing = await AssignmentSubmission.findOne({
      where: { assignmentId: assignment.id, studentId: user.id }, lock: transaction.LOCK.UPDATE, transaction,
    });
    if (existing?.gradePoints !== null && existing?.gradePoints !== undefined) {
      throw conflict('ALREADY_GRADED', 'Esta entrega ya fue calificada y no se puede cambiar.');
    }
    const values = { body, linkUrl: linkUrl || null, submittedAt: new Date() };
    const submission = existing
      ? await existing.update(values, { transaction })
      : await AssignmentSubmission.create({ ...values, assignmentId: assignment.id, studentId: user.id }, { transaction });
    await recordAudit({ actor: user, action: 'assignment.submitted', resourceType: 'assignment', resourceId: assignment.id, transaction });
    const late = Boolean(assignment.dueAt) && submission.submittedAt > assignment.dueAt;
    return { ...submissionDto(submission), late };
  });
}

// Registra la nota y la retroalimentación del docente.
export async function gradeSubmission(user, submissionId, { gradePoints, feedback }) {
  const submission = submissionId ? await AssignmentSubmission.findByPk(submissionId) : null;
  if (!submission) throw notFound('Entrega no encontrada.');
  await loadAssignment(user, submission.assignmentId, { write: true });
  // Se bloquea la tarea para que el máximo no cambie mientras se califica.
  return sequelize.transaction(async (transaction) => {
    const assignment = await Assignment.findByPk(submission.assignmentId, { lock: transaction.LOCK.UPDATE, transaction });
    if (gradePoints > assignment.maxPoints) throw invalid(`La nota no puede superar ${assignment.maxPoints} puntos.`);
    await submission.update({ gradePoints, feedback: feedback || null, gradedBy: user.id, gradedAt: new Date() }, { transaction });
    await recordAudit({
      actor: user, action: 'assignment.graded', resourceType: 'assignment_submission', resourceId: submission.id, metadata: { studentId: submission.studentId, maxPoints: assignment.maxPoints }, transaction,
    });
    return submissionDto(submission);
  });
}
