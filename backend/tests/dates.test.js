import test from 'node:test';
import assert from 'node:assert/strict';
import { isCalendarDate } from '../src/utils/dates.js';
import { addDays } from '../src/utils/clock.js';
import { classWorkItemSchema, studyPlanSchema } from '../src/validators/schemas.js';

// P2 de la revisión independiente: una fecha con forma correcta pero inexistente se rechaza.
test('solo acepta fechas que existen en el calendario', () => {
  for (const valida of ['2026-11-30', '2024-02-29', '2026-02-28', '2026-12-31', '2026-01-01']) assert.equal(isCalendarDate(valida), true, valida);
  for (const invalida of ['2026-11-31', '2026-02-29', '2025-02-29', '2026-02-30', '2026-00-10', '2026-13-01', '2026-04-31', '2026-06-00', '26-11-30', '2026-1-5', '', null]) {
    assert.equal(isCalendarDate(invalida), false, String(invalida));
  }
});

test('los esquemas de plan de estudio y trabajo en clase rechazan fechas inexistentes', () => {
  const plan = { minutesPerSession: 30, studyDays: [1, 3] };
  assert.equal(studyPlanSchema.safeParse({ ...plan, targetDate: '2026-11-31' }).success, false);
  assert.equal(studyPlanSchema.safeParse({ ...plan, targetDate: '2026-11-30' }).success, true);
  assert.equal(classWorkItemSchema.safeParse({ title: 'Práctica', maxPoints: 10, workDate: '2026-02-29' }).success, false);
  assert.equal(classWorkItemSchema.safeParse({ title: 'Práctica', maxPoints: 10, workDate: '2028-02-29' }).success, true);
});

test('addDays no normaliza en silencio una fecha inválida', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.throws(() => addDays('2026-02-30', 1), RangeError);
});
