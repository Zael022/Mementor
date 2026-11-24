// Métricas básicas de las solicitudes en memoria de esta instancia: latencia (p50, p95, p99) y errores.
// Es un punto de partida para la operación; en producción conviene enviarlas a un sistema central de monitoreo.

const WINDOW = 2000;
const startedAt = new Date();
let durations = [];
const counts = { total: 0, status4xx: 0, status5xx: 0 };
const slowRoutes = new Map();

export function recordRequest({ route, status, durationMs }) {
  counts.total += 1;
  if (status >= 500) counts.status5xx += 1;
  else if (status >= 400) counts.status4xx += 1;
  durations.push(durationMs);
  if (durations.length > WINDOW) durations = durations.slice(-WINDOW);
  const current = slowRoutes.get(route) || { count: 0, maxMs: 0 };
  slowRoutes.set(route, { count: current.count + 1, maxMs: Math.max(current.maxMs, durationMs) });
}

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null);

export function metricsSnapshot() {
  const sorted = [...durations].sort((a, b) => a - b);
  const slowest = [...slowRoutes].sort((a, b) => b[1].maxMs - a[1].maxMs).slice(0, 10).map(([route, data]) => ({ route, ...data }));
  return {
    since: startedAt.toISOString(),
    requests: { ...counts },
    latencyMs: { sample: sorted.length, p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) },
    slowestRoutes: slowest,
  };
}

export function resetMetricsForTests() {
  durations = [];
  Object.assign(counts, { total: 0, status4xx: 0, status5xx: 0 });
  slowRoutes.clear();
}
