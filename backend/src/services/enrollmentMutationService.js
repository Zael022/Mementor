import { Enrollment } from '../models/index.js';
import { conflict } from '../utils/AppError.js';
import { recordAudit } from './auditService.js';

// El usuario debe estar bloqueado y autorizado por quien coordina la transacción.
export async function applyEnrollment(actor, course, student, mode, transaction) {
  let row = await Enrollment.findOne({ where: { courseId: course.id, studentId: student.id }, transaction, lock: transaction.LOCK.UPDATE });
  let kind = 'nueva';
  if (row?.status === 'active') {
    if (mode !== 'vincular') throw conflict('EXISTING_ENROLLMENT', 'Ya existe matrícula activa. Selecciona vinculación explícita con motivo.');
    kind = 'vinculada';
  } else if (row) {
    if (mode !== 'reintegrar') throw conflict('WITHDRAWN_ENROLLMENT', 'La matrícula está retirada. Selecciona reintegro explícito.');
    await row.update({ status: 'active' }, { transaction }); kind = 'reintegrada';
  } else {
    if (mode !== 'nueva') throw conflict('NO_ENROLLMENT', 'No hay una matrícula anterior para esta operación.');
    row = await Enrollment.create({ courseId: course.id, studentId: student.id, status: 'active' }, { transaction });
  }
  await recordAudit({ actor, action: { nueva: 'enrollment.created', vinculada: 'enrollment.linked', reintegrada: 'enrollment.reinstated' }[kind], resourceType: 'course', resourceId: course.id, metadata: { studentId: student.id }, transaction });
  return { enrollment: row, kind };
}
