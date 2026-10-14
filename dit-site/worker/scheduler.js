// Durable job scheduler. State lives in agent_jobs (Postgres), so restarts lose nothing and no website visitor is needed.
// Guarantees: deduplication (unique dedupe_key), lease-based claiming, per-job timeout, exponential-backoff retries, dead-lettering, daily budgets.
import { AGENTS, AGENT_IDS } from '../server/lib/agents.js';
import { StoreError, PG } from '../server/lib/store-core.js';
import { recordExpense, reconcileReceipts } from '../server/lib/ledger.js';
import { runCycle, runOutcomeCheck, setAgentState } from './pipeline.js';
import { SourceGate } from './sources.js';

const MIN = 60_000, HOUR = 3600_000;
export function limitsFromEnv(env) {
  const n = (k, d) => { const v = env[k] == null || env[k] === '' ? d : Number(env[k]); if (!Number.isFinite(v) || v < 0) throw new Error(`${k} must be a non-negative number`); return v; };
  return { cycleIntervalMs: n('DIT_CYCLE_INTERVAL_MINUTES', 60) * MIN, staggerMs: n('DIT_AGENT_STAGGER_MINUTES', 7) * MIN, maxCyclesPerDay: n('DIT_MAX_CYCLES_PER_AGENT_DAY', 24), maxLlmTokensPerDay: n('DIT_MAX_LLM_TOKENS_PER_AGENT_DAY', 60000),
    jobTimeoutMs: n('DIT_JOB_TIMEOUT_SECONDS', 180) * 1000, maxAttempts: n('DIT_JOB_MAX_ATTEMPTS', 3), backoffBaseMs: n('DIT_RETRY_BACKOFF_SECONDS', 60) * 1000, outcomeDelayMs: n('DIT_OUTCOME_DELAY_HOURS', 24) * HOUR, reconcileIntervalMs: n('DIT_RECONCILE_INTERVAL_MINUTES', 5) * MIN, concurrency: n('DIT_WORKER_CONCURRENCY', 2) };
}
export const backoff = (attempts, base) => Math.min(base * 2 ** Math.max(0, attempts - 1), 6 * HOUR);

export class Scheduler {
  constructor({ store, env, llm, fetchImpl = (...a) => fetch(...a), workerId, clock = Date.now, log = () => {} }) {
    this.store = store; this.env = env; this.llm = llm; this.fetchImpl = fetchImpl; this.workerId = workerId || 'worker-' + Math.random().toString(36).slice(2, 8); this.clock = clock; this.log = log;
    this.limits = limitsFromEnv(env); this.gate = new SourceGate(clock); this.startedAt = clock();
  }
  iso(ms = this.clock()) { return new Date(ms).toISOString(); }
  async #enqueue(job) {
    // A successful/dead job must never be enqueued again for the same time window.
    // This guard also supports older stores that have not applied migration 0003.
    const existing = await this.store.select('agent_jobs', { filters: [['dedupe_key', 'eq', job.dedupe_key]], limit: 1 });
    if (existing.length) return null;
    try { return await this.store.insert('agent_jobs', { max_attempts: this.limits.maxAttempts, timeout_ms: this.limits.jobTimeoutMs, ...job }); }
    catch (e) { if (e instanceof StoreError && e.code === PG.UNIQUE) return null; throw e; }
  }

  async heartbeat() { await this.store.upsert('worker_heartbeats', { worker_id: this.workerId, started_at: this.iso(this.startedAt), last_seen_at: this.iso(), version: this.env.DIT_VERSION || 'dev', info: { llm_configured: !!this.llm.configured, llm_model: this.llm.model, llm_provider: this.llm.provider || null, llm_fast: this.llm.status?.fast || null, llm_deep: this.llm.status?.deep || null, store: this.store.kind } }, { onConflict: 'worker_id' }); }

  async ensureJobs() {
    const now = this.clock(); const { cycleIntervalMs: iv, staggerMs } = this.limits; const window = Math.floor(now / iv); let made = 0;
    for (const [i, id] of AGENT_IDS.entries()) {
      const runAfter = window * iv + i * staggerMs;     // each agent runs on its own phase inside the window
      if (runAfter > now + iv) continue;
      if (await this.#enqueue({ agent_id: id, kind: 'cycle', dedupe_key: `cycle:${id}:${window}`, run_after: this.iso(Math.min(runAfter, now)) })) made++;
    }
    const due = await this.store.select('token_proposals', { filters: [['status', 'in', ['PROPOSED', 'EVALUATED']], ['outcome_checked_at', 'is', null], ['created_at', 'lt', this.iso(now - this.limits.outcomeDelayMs)]], limit: 20 });
    for (const p of due) if (p.outcome == null && (await this.#enqueue({ agent_id: p.agent_id, kind: 'outcome_check', dedupe_key: 'outcome:' + p.id, payload: { proposal_id: p.id }, run_after: this.iso() }))) made++;
    const rw = Math.floor(now / this.limits.reconcileIntervalMs);
    if (await this.#enqueue({ agent_id: null, kind: 'reconcile', dedupe_key: 'reconcile:' + rw, run_after: this.iso() })) made++;
    return made;
  }
  async #todayUsage(agentId) {
    const since = this.iso(this.clock() - 24 * HOUR); const jobs = await this.store.select('agent_jobs', { filters: [['agent_id', 'eq', agentId], ['created_at', 'gte', since]] });
    return { cycles: jobs.filter(j => j.kind === 'cycle' && j.status !== 'queued').length, tokens: jobs.reduce((n, j) => n + j.tokens_in + j.tokens_out, 0) };
  }
  async #handle(job, signal) {
    const base = { store: this.store, env: this.env, llm: this.llm, fetchImpl: this.fetchImpl, job, signal, now: this.clock, gate: this.gate };
    if (job.kind === 'reconcile') {
      const getTransaction = async sig => { const r = await this.fetchImpl(this.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }] }), signal }); if (!r.ok) throw new Error('Solana RPC responded ' + r.status); const j = await r.json(); if (j.error) throw new Error('Solana RPC error'); return j.result; };
      return { result: await reconcileReceipts(this.store, this.env, { getTransaction }), usage: { in: 0, out: 0 } };
    }
    const persona = AGENTS[job.agent_id]; if (!persona) throw new Error('unknown agent on job');
    if (job.kind === 'outcome_check') return runOutcomeCheck({ ...base, persona });
    const u = await this.#todayUsage(persona.id);
    if (u.cycles > this.limits.maxCyclesPerDay) return { result: { outcome: 'skipped_daily_cycle_budget' }, usage: { in: 0, out: 0 } };
    return runCycle({ ...base, persona, llmAllowed: u.tokens < this.limits.maxLlmTokensPerDay });
  }
  async runJob(job) {
    const ac = new AbortController(); let timer; const timeout = new Promise((_, rej) => { timer = setTimeout(() => { ac.abort(); rej(Object.assign(new Error('job timed out after ' + job.timeout_ms + 'ms'), { code: 'timeout' })); }, job.timeout_ms); });
    try {
      if (job.attempts > job.max_attempts) throw Object.assign(new Error('attempt limit exceeded (lease expired repeatedly)'), { fatal: true });
      const { result, usage } = await Promise.race([this.#handle(job, ac.signal), timeout]);
      const cost = this.llm.costMicros?.(usage) ?? null;
      await this.store.update('agent_jobs', [['id', 'eq', job.id]], { status: 'succeeded', result, finished_at: this.iso(), locked_until: null, error: null, tokens_in: usage.in, tokens_out: usage.out, cost_usd_micros: cost || 0 });
      if (cost && job.agent_id) await recordExpense(this.store, { jobId: job.id, agentId: job.agent_id, usdMicros: cost });
      this.log('job ok', job.kind, job.agent_id, result?.outcome); return { ok: true };
    } catch (e) {
      const dead = e.fatal || job.attempts >= job.max_attempts;
      await this.store.update('agent_jobs', [['id', 'eq', job.id]], dead ? { status: 'dead', error: String(e.message).slice(0, 500), finished_at: this.iso(), locked_until: null } : { status: 'queued', error: String(e.message).slice(0, 500), run_after: this.iso(this.clock() + backoff(job.attempts, this.limits.backoffBaseMs)), locked_until: null, locked_by: null });
      if (job.agent_id) { await setAgentState(this.store, job.agent_id, null, this.clock).catch(() => {}); await this.store.insert('activity_events', { agent_id: job.agent_id, job_id: job.id, event_type: dead ? 'job_dead' : 'job_retry', severity: 'error', title: `${job.agent_id} ${job.kind} ${dead ? 'failed permanently' : 'failed; retry scheduled'}`, detail: String(e.message).slice(0, 300) }).catch(() => {}); }
      this.log('job fail', job.kind, job.agent_id, e.message); return { ok: false, dead };
    } finally { clearTimeout(timer); }
  }
  async tick() {
    await this.heartbeat(); const made = await this.ensureJobs(); const ran = [];
    const work = [];
    for (let i = 0; i < this.limits.concurrency; i++) {
      const claimed = await this.store.rpc('claim_job', { p_worker: this.workerId, p_lease_seconds: Math.ceil(this.limits.jobTimeoutMs / 1000) + 60 }); const job = Array.isArray(claimed) ? claimed[0] : claimed; if (!job) break;
      work.push(this.runJob(job).then(r => ran.push({ id: job.id, kind: job.kind, agent: job.agent_id, ...r })));
    }
    await Promise.all(work); return { enqueued: made, ran };
  }
}
