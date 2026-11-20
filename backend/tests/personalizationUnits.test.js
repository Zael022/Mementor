import test from 'node:test';
import assert from 'node:assert/strict';
import { FSRS, GRADES, gradeFromAnswers, intervalDays, retrievability, scheduleReview } from '../src/utils/spacedRepetition.js';
import { PLANNER, buildStudyPlan, isoWeekday, topicNeed } from '../src/utils/studyPlanner.js';

// Comprueba el repaso espaciado (FSRS-4.5) y el planificador con valores calculados a mano.
const DIA = 24 * 3600 * 1000;
const T0 = new Date('2026-11-20T15:00:00Z');

test('el primer repaso usa la estabilidad inicial de FSRS según la nota', () => {
  const bien = scheduleReview(null, GRADES.good, T0);
  assert.equal(bien.stability, 3.715);
  assert.equal(bien.difficulty, 5.162);
  assert.equal(bien.scheduledDays, 4);
  assert.equal(bien.dueAt.getTime(), T0.getTime() + 4 * DIA);
  assert.equal(scheduleReview(null, GRADES.easy, T0).scheduledDays, 14);
  assert.equal(scheduleReview(null, GRADES.again, T0).scheduledDays, 1);
});

test('con retención 0,9 el intervalo es igual a la estabilidad y la probabilidad de recordar cae con el tiempo', () => {
  assert.equal(FSRS.desiredRetention, 0.9);
  assert.equal(intervalDays(10), 10);
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  assert.equal(retrievability(0, 10), 1);
  assert.ok(retrievability(30, 10) < retrievability(10, 10));
});

test('recordar a tiempo alarga el intervalo; olvidar lo reinicia y cuenta un lapso', () => {
  const primero = scheduleReview(null, GRADES.good, T0);
  const aTiempo = new Date(primero.dueAt);
  const segundo = scheduleReview(primero, GRADES.good, aTiempo);
  assert.ok(segundo.stability > primero.stability * 3, `estabilidad ${segundo.stability}`);
  assert.ok(segundo.scheduledDays > primero.scheduledDays);
  assert.equal(segundo.reps, 2);

  const olvido = scheduleReview(segundo, GRADES.again, new Date(segundo.dueAt));
  assert.ok(olvido.stability < segundo.stability);
  assert.equal(olvido.scheduledDays, 1);
  assert.equal(olvido.lapses, 1);
  assert.ok(olvido.difficulty > segundo.difficulty);
});

test('«difícil» programa antes que «bien», y «fácil» después', () => {
  const base = scheduleReview(null, GRADES.good, T0);
  const cuando = new Date(base.dueAt);
  const dificil = scheduleReview(base, GRADES.hard, cuando).scheduledDays;
  const bien = scheduleReview(base, GRADES.good, cuando).scheduledDays;
  const facil = scheduleReview(base, GRADES.easy, cuando).scheduledDays;
  assert.ok(dificil < bien && bien < facil, `${dificil} < ${bien} < ${facil}`);
});

test('la nota objetiva sale de los aciertos del tema; «fácil» exige al menos 3 preguntas', () => {
  assert.equal(gradeFromAnswers(0, 0), null);
  assert.equal(gradeFromAnswers(1, 4), GRADES.again);
  assert.equal(gradeFromAnswers(2, 3), GRADES.hard);
  assert.equal(gradeFromAnswers(4, 5), GRADES.good);
  assert.equal(gradeFromAnswers(2, 2), GRADES.good);
  assert.equal(gradeFromAnswers(3, 3), GRADES.easy);
  assert.throws(() => scheduleReview(null, 5, T0));
});

const tema = (id, order, extra = {}) => ({ id, title: `Tema ${id}`, order, prerequisiteIds: [], masteryScore: null, evidenceCount: 0, reviewDueDay: null, ...extra });

test('el día de la semana sigue la norma ISO (lunes = 1, domingo = 7)', () => {
  assert.equal(isoWeekday('2026-11-23'), 1);
  assert.equal(isoWeekday('2026-11-22'), 7);
});

test('cada tema recibe la tarea que le corresponde según su dominio', () => {
  assert.equal(topicNeed(tema(1, 0)), 'learn');
  assert.equal(topicNeed(tema(1, 0, { masteryScore: 0.4, evidenceCount: 5 })), 'reinforce');
  assert.equal(topicNeed(tema(1, 0, { masteryScore: 0.7, evidenceCount: 5 })), 'practice');
  assert.equal(topicNeed(tema(1, 0, { masteryScore: 0.9, evidenceCount: 2 })), 'practice');
  assert.equal(topicNeed(tema(1, 0, { masteryScore: 0.9, evidenceCount: 5 })), null);
});

test('prioriza las brechas pero nunca pone un tema antes que su prerrequisito', () => {
  const topics = [
    tema(1, 0, { masteryScore: 0.7, evidenceCount: 4 }),
    tema(2, 1, { masteryScore: 0.3, evidenceCount: 4, prerequisiteIds: [3] }),
    tema(3, 2),
    tema(4, 3, { masteryScore: 0.2, evidenceCount: 4 }),
  ];
  const plan = buildStudyPlan({ topics, startDate: '2026-11-23', targetDate: '2026-12-31', studyDays: [1, 2, 3, 4, 5, 6, 7], minutesPerSession: 60 });
  const orden = [...new Set(plan.items.map((item) => item.topicId))];
  // El 4 es refuerzo sin dependencias; el 2 también es refuerzo pero espera al 3.
  assert.deepEqual(orden, [4, 1, 3, 2]);
  assert.equal(plan.unscheduledMinutes, 0);
});

test('respeta los días y minutos elegidos, parte las sesiones y avisa lo que no cabe', () => {
  const topics = [tema(1, 0), tema(2, 1), tema(3, 2)];
  // Solo lunes y miércoles, 30 minutos: dos días disponibles = 60 min de 135 necesarios.
  const plan = buildStudyPlan({ topics, startDate: '2026-11-23', targetDate: '2026-11-26', studyDays: [1, 3], minutesPerSession: 30 });
  assert.equal(plan.studyDayCount, 2);
  for (const item of plan.items) assert.ok([1, 3].includes(isoWeekday(item.scheduledDate)));
  const porDia = new Map();
  for (const item of plan.items) porDia.set(item.scheduledDate, (porDia.get(item.scheduledDate) || 0) + item.minutes);
  for (const minutos of porDia.values()) assert.ok(minutos <= 30);
  assert.equal(plan.items.reduce((sum, item) => sum + item.minutes, 0) + plan.unscheduledMinutes, 3 * PLANNER.minutes.learn);
  assert.ok(plan.unscheduledMinutes > 0);
  assert.match(plan.items[1].description, /parte 2/);
});

test('programa el repaso espaciado de un tema dominado en su fecha o el primer día libre', () => {
  const topics = [tema(1, 0, { masteryScore: 0.95, evidenceCount: 6, reviewDueDay: '2026-11-25' })];
  const plan = buildStudyPlan({ topics, startDate: '2026-11-23', targetDate: '2026-11-30', studyDays: [1, 2, 3, 4, 5], minutesPerSession: 30 });
  assert.deepEqual(plan.items.map((item) => [item.kind, item.scheduledDate, item.minutes]), [['review', '2026-11-25', PLANNER.minutes.review]]);
  const fuera = buildStudyPlan({ topics, startDate: '2026-11-23', targetDate: '2026-11-24', studyDays: [1, 2], minutesPerSession: 30 });
  assert.equal(fuera.items.length, 0);
});
