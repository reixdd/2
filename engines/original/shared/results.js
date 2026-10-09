/** Per-discipline leaderboards. Only COMPLETED (verified) entries contribute to scores. Nothing is estimated. */
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function aggregate(battles) {
  const disc = {};
  for (const b of battles) {
    const d = b.challenge.discipline;
    disc[d] ??= {};
    for (const e of b.entries) {
      if (e.status !== 'COMPLETED' && e.status !== 'FAILED') continue;
      const key = `${e.contenderId}#${e.configuration.configHash}`;
      const row = (disc[d][key] ??= {
        key, contenderId: e.contenderId, label: e.label, kind: e.kind, provider: e.provider, model: e.model,
        mutated: e.configuration.mutated, configHash: e.configuration.configHash,
        attempts: 0, completed: 0, failed: 0, passes: 0, scores: [], latencies: [], byChallenge: {},
      });
      row.attempts++;
      if (e.status === 'FAILED') { row.failed++; continue; }
      row.completed++;
      row.scores.push(e.verification.score);
      if (e.verification.passed) row.passes++;
      if (e.latency.totalMs != null) row.latencies.push(e.latency.totalMs);
      const c = (row.byChallenge[b.challengeId] ??= { runs: 0, scores: [] });
      c.runs++; c.scores.push(e.verification.score);
    }
  }
  const disciplines = {};
  for (const [d, rows] of Object.entries(disc)) {
    const list = Object.values(rows).map((r) => ({
      key: r.key, contenderId: r.contenderId, label: r.label, kind: r.kind, provider: r.provider, model: r.model,
      mutated: r.mutated, configHash: r.configHash,
      attempts: r.attempts, completed: r.completed, failed: r.failed,
      reliability: r.attempts ? r.completed / r.attempts : null,
      passRate: r.completed ? r.passes / r.completed : null,
      avgScore: avg(r.scores), medianLatencyMs: median(r.latencies),
      byChallenge: Object.fromEntries(Object.entries(r.byChallenge).map(([k, v]) => [k, { runs: v.runs, avgScore: avg(v.scores) }])),
    }));
    const ranked = list.filter((r) => r.completed > 0).sort((a, b) =>
      b.avgScore - a.avgScore || b.reliability - a.reliability || (a.medianLatencyMs ?? Infinity) - (b.medianLatencyMs ?? Infinity));
    ranked.forEach((r, i) => { r.rank = i + 1; });
    const unranked = list.filter((r) => r.completed === 0).map((r) => ({ ...r, rank: null }));
    disciplines[d] = [...ranked, ...unranked];
  }
  return { schema: 'colosseum.results/v1', generatedAt: new Date().toISOString(), battleCount: battles.length, disciplines };
}
