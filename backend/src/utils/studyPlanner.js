import { addDays } from './clock.js';
import { MASTERY } from './mastery.js';

// Reglas del planificador (docs/08 «Planificador»). Las duraciones son estimaciones editables por el estudiante.
export const PLANNER = {
  version: 'planner-1',
  minutes: { reinforce: 40, practice: 25, learn: 45, review: 15 },
  // Prioridad: primero las brechas, luego consolidar y por último lo nuevo.
  rank: { reinforce: 0, practice: 1, learn: 2 },
  minChunk: 10,
  maxDays: 180,
};

// Día ISO de la semana (1 = lunes … 7 = domingo) de una fecha AAAA-MM-DD.
export function isoWeekday(day) {
  const [year, month, date] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

// Qué necesita cada tema según su dominio y su evidencia.
export function topicNeed(topic) {
  if (topic.masteryScore === null || topic.masteryScore === undefined || !topic.evidenceCount) return 'learn';
  if (topic.masteryScore < MASTERY.reinforceBelow) return 'reinforce';
  if (topic.masteryScore < MASTERY.advanceAtOrAbove || topic.evidenceCount < MASTERY.minEvidence) return 'practice';
  return null;
}

function describe(kind, topic, part) {
  const title = `«${topic.title}»`;
  const suffix = part > 1 ? ` (parte ${part})` : '';
  if (kind === 'learn') return `Estudia las lecciones de ${title} y anota tus dudas${suffix}.`;
  if (kind === 'reinforce') return `Refuerza ${title}: relee las lecciones y vuelve a practicar (dominio estimado ${Math.round(topic.masteryScore * 100)} %)${suffix}.`;
  if (kind === 'practice') return `Practica ${title} para consolidarlo${suffix}.`;
  return `Repaso espaciado de ${title}: intenta recordarlo sin mirar y luego compruébalo.`;
}

// Orden topológico: un tema nunca va antes que sus prerrequisitos; entre los disponibles gana la mayor prioridad.
function orderTasks(tasks) {
  const ids = new Set(tasks.map((task) => task.topic.id));
  const pending = new Map(tasks.map((task) => [task.topic.id, new Set((task.topic.prerequisiteIds || []).filter((id) => ids.has(id)))]));
  const ordered = [];
  const remaining = [...tasks];
  const better = (a, b) => (PLANNER.rank[a.kind] - PLANNER.rank[b.kind]) || (a.topic.order - b.topic.order);
  while (remaining.length) {
    let ready = remaining.filter((task) => pending.get(task.topic.id).size === 0);
    // Si hubiera un ciclo de prerrequisitos, se sigue el orden del curso para no bloquear el plan.
    if (ready.length === 0) ready = [...remaining].sort((a, b) => a.topic.order - b.topic.order).slice(0, 1);
    const next = ready.sort(better)[0];
    ordered.push(next);
    remaining.splice(remaining.indexOf(next), 1);
    for (const deps of pending.values()) deps.delete(next.topic.id);
  }
  return ordered;
}

// Arma el plan sin superar los minutos disponibles; lo que no cabe se informa, no se amontona.
export function buildStudyPlan({ topics, startDate, targetDate, studyDays, minutesPerSession }) {
  const days = [];
  for (let day = startDate; day <= targetDate; day = addDays(day, 1)) {
    if (studyDays.includes(isoWeekday(day))) days.push(day);
  }
  const capacity = new Map(days.map((day) => [day, minutesPerSession]));
  const items = [];
  const unscheduledTopicIds = new Set();
  let unscheduledMinutes = 0;

  // 1) Repasos espaciados de temas ya dominados, en su fecha o en el primer día libre después.
  const reviews = topics
    .filter((topic) => !topicNeed(topic) && topic.reviewDueDay && topic.reviewDueDay <= targetDate)
    .sort((a, b) => a.reviewDueDay.localeCompare(b.reviewDueDay) || a.order - b.order);
  for (const topic of reviews) {
    const from = topic.reviewDueDay < startDate ? startDate : topic.reviewDueDay;
    const day = days.find((candidate) => candidate >= from && capacity.get(candidate) >= PLANNER.minutes.review);
    if (!day) {
      unscheduledMinutes += PLANNER.minutes.review;
      unscheduledTopicIds.add(topic.id);
      continue;
    }
    capacity.set(day, capacity.get(day) - PLANNER.minutes.review);
    items.push({ topicId: topic.id, kind: 'review', minutes: PLANNER.minutes.review, scheduledDate: day, description: describe('review', topic, 1) });
  }

  // 2) Estudio, refuerzo y práctica en orden de prioridad, partidos en sesiones si no caben en un día.
  const tasks = orderTasks(topics.map((topic) => ({ topic, kind: topicNeed(topic) })).filter((task) => task.kind));
  let pointer = 0;
  for (const { topic, kind } of tasks) {
    let remaining = PLANNER.minutes[kind];
    let part = 1;
    while (remaining > 0 && pointer < days.length) {
      const day = days[pointer];
      const free = capacity.get(day);
      if (free < Math.min(PLANNER.minChunk, remaining)) { pointer += 1; continue; }
      let take = Math.min(free, remaining);
      // Evita dejar un resto menor que una sesión mínima.
      const rest = remaining - take;
      if (rest > 0 && rest < PLANNER.minChunk && take - (PLANNER.minChunk - rest) >= PLANNER.minChunk) take -= PLANNER.minChunk - rest;
      items.push({ topicId: topic.id, kind, minutes: take, scheduledDate: day, description: describe(kind, topic, part) });
      capacity.set(day, free - take);
      remaining -= take;
      part += 1;
      if (capacity.get(day) < PLANNER.minChunk) pointer += 1;
    }
    if (remaining > 0) {
      unscheduledMinutes += remaining;
      unscheduledTopicIds.add(topic.id);
    }
  }

  // Orden estable: dentro del mismo día se conserva la prioridad.
  items.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  return {
    items: items.map((item, index) => ({ ...item, position: index + 1 })),
    studyDayCount: days.length,
    unscheduledMinutes,
    unscheduledTopicIds: [...unscheduledTopicIds],
  };
}
