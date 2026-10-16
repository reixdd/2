// Store abstraction. Two implementations with the SAME interface:
//   SupabaseStore — PostgREST over fetch (works in Workers and Node; uses the service-role key server-side only)
//   MemoryStore   — in-process mirror used by tests and local development (FileStore in store-file.js persists it)
// MemoryStore.rpc mirrors the SQL functions in supabase/migrations/0002. It is a test double, not proof the SQL works.
//
// Query shape:  select(table, { filters:[[col,op,val]], order:[col,'asc'|'desc'], limit, columns })
// ops: eq neq gt gte lt lte in is(null|true|false) contains(array)

export class StoreError extends Error { constructor(message, code, status) { super(message); this.code = code; this.status = status; } }
export const PG = { UNIQUE: '23505', RAISE: 'P0001', NOT_FOUND: 'P0002', RATE: 'P0003' };

const uuid = () => globalThis.crypto.randomUUID();
const nowIso = () => new Date().toISOString();

// ------------------------------------------------------------------ Supabase
export class SupabaseStore {
  constructor({ url, serviceKey, fetchImpl = (...a) => fetch(...a), timeoutMs = 10000 }) {
    if (!url || !serviceKey) throw new StoreError('Supabase URL and service key are required', 'config');
    this.base = url.replace(/\/+$/, '') + '/rest/v1'; this.key = serviceKey; this.f = fetchImpl; this.timeoutMs = timeoutMs; this.kind = 'supabase';
  }
  async #req(path, { method = 'GET', body, headers = {} } = {}) {
    const r = await this.f(this.base + path, { method, signal: AbortSignal.timeout(this.timeoutMs),
      headers: { apikey: this.key, authorization: 'Bearer ' + this.key, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
    if (!r.ok) throw new StoreError(data?.message || `Database request failed (${r.status})`, data?.code || String(r.status), r.status);
    return data;
  }
  static query({ filters = [], order, limit, columns = '*' } = {}) {
    const q = new URLSearchParams(); q.set('select', columns);
    for (const [c, op, v] of filters) {
      const val = op === 'in' ? `(${v.join(',')})` : op === 'contains' ? `{${v.join(',')}}` : op === 'is' ? String(v) : String(v);
      q.append(c, `${op === 'contains' ? 'cs' : op}.${val}`);
    }
    if (order) q.set('order', `${order[0]}.${order[1] || 'asc'}`);
    if (limit) q.set('limit', String(limit));
    return '?' + q.toString();
  }
  async count(table){
    const r=await this.f(this.base+'/'+table+'?select=id',{method:'HEAD',signal:AbortSignal.timeout(this.timeoutMs),headers:{apikey:this.key,authorization:'Bearer '+this.key,prefer:'count=exact'}});
    if(!r.ok)throw new StoreError('Count request failed',String(r.status),r.status);
    const total=r.headers.get('content-range')?.split('/')[1];return total&&/^\d+$/.test(total)?Number(total):null;
  }
  select(table, opts) { return this.#req(`/${table}${SupabaseStore.query(opts)}`); }
  async insert(table, rows) { const arr = await this.#req(`/${table}`, { method: 'POST', body: rows, headers: { prefer: 'return=representation' } }); return Array.isArray(rows) ? arr : arr[0]; }
  async upsert(table, rows, { onConflict, ignoreDuplicates = false } = {}) {
    const arr = await this.#req(`/${table}?on_conflict=${encodeURIComponent(onConflict)}`, { method: 'POST', body: rows, headers: { prefer: `resolution=${ignoreDuplicates ? 'ignore' : 'merge'}-duplicates,return=representation` } });
    return Array.isArray(rows) ? arr : arr[0] ?? null;
  }
  async update(table, filters, patch) { const q = SupabaseStore.query({ filters, columns: '*' }); return this.#req(`/${table}${q}`, { method: 'PATCH', body: patch, headers: { prefer: 'return=representation' } }); }
  rpc(name, args) { return this.#req(`/rpc/${name}`, { method: 'POST', body: args || {} }); }
}

// ------------------------------------------------------------------ Memory
const UNIQUE = {
  agents: [['id']], agent_profiles: [['agent_id']], agent_votes: [['user_id']], agent_vote_counts: [['agent_id']],
  research_sources: [['id']], trend_clusters: [['agent_id', 'key']], observations: [['agent_id', 'source_id', 'external_id']],
  token_proposals: [], verified_tokens: [['mint'], ['signature']], circuit_events: [['source', 'external_id']],
  fee_receipts: [['source', 'external_id']], treasury_allocations: [['receipt_id'], ['transfer_signature']],
  treasury_ledger: [['idempotency_key']], worker_heartbeats: [['worker_id']], agent_research_runs: [['id']],
  research_schedules: [['agent_id']], fictional_concepts: [['id'], ['run_id']], dit_market_snapshots: [['id']]
};
const IDENTITY = { agents: 'id', agent_profiles: 'agent_id', agent_vote_counts: 'agent_id', research_sources: 'id', verified_tokens: 'mint', worker_heartbeats: 'worker_id', agent_votes: 'user_id', research_schedules: 'agent_id', fictional_concepts: 'id', dit_market_snapshots: 'id' };
const SERIAL = new Set(['activity_events', 'audit_logs', 'treasury_ledger', 'vote_changes']);
const DEFAULTS = {
  agents: { state: 'IDLE', current_stage: null, state_since: nowIso, last_active_at: null, is_active: true },
  agent_jobs: { status: 'queued', stage: null, payload: () => ({}), attempts: 0, max_attempts: 3, run_after: nowIso, timeout_ms: 120000, locked_by: null, locked_until: null, started_at: null, finished_at: null, error: null, result: null, tokens_in: 0, tokens_out: 0, cost_usd_micros: 0, created_at: nowIso },
  agent_memories: { tags: () => [], importance: 0.5, source_refs: () => [], job_id: null, run_id: null, recall_count: 0, last_recalled_at: null, created_at: nowIso },
  observations: { category: 'general', classifier: 'rules', confidence: null, metrics: () => ({}), evidence: () => ({}), cluster_id: null, job_id: null, observed_at: nowIso, created_at: nowIso, url: null },
  trend_clusters: { score: 0, observation_count: 0, first_seen_at: nowIso, last_seen_at: nowIso },
  token_proposals: { status: 'RESEARCHING', evidence_ids: () => [], created_at: nowIso, updated_at: nowIso, approved_by: null, approved_at: null, simulation: null, outcome: null, outcome_checked_at: null, lesson: null, rejected_reason: null, dedupe_key: null },
  activity_events: { severity: 'info', payload: () => ({}), detail: null, job_id: null, agent_id: null, created_at: nowIso },
  audit_logs: { details: () => ({}), created_at: nowIso },
  treasury_ledger: { unit: 'lamports', simulated: false, created_at: nowIso, receipt_id: null, allocation_id: null, job_id: null, memo: null },
  research_sources: { enabled: true, rate_limit_per_min: 20, requires_credentials: false, verified_live: false, last_success_at: null, last_error: null, last_error_at: null },
  circuit_events: { signature_valid: false, status: 'received', error: null, received_at: nowIso, processed_at: null },
  fee_receipts: { status: 'observed', simulated: false, observed_at: nowIso, confirmed_lamports: null, confirmed_at: null, note: null, circuit_event_id: null, mint: null, tx_signature: null },
  treasury_allocations: { status: 'calculated', transferred_lamports: 0, transfer_signature: null, simulated: false, note: null, created_at: nowIso, updated_at: nowIso, mechanism: null },
  agent_votes: { created_at: nowIso, updated_at: nowIso, change_count: 0 },
  agent_research_runs: { status:'running', source_refs:()=>[], diagnostics:()=>({}), started_at:nowIso, finished_at:null, model:null, answer:null, error:null },
  research_schedules: { enabled:true,interval_minutes:20,next_due_at:nowIso,last_run_id:null,attempts:0,status:'waiting',detail:null,owner:null,lease_until:'1970-01-01T00:00:00Z',revision:1,updated_at:nowIso },
  fictional_concepts: { status:'review',revision:1,source_refs:()=>[],history:()=>[],created_at:nowIso,updated_at:nowIso,published_at:null },
  verified_tokens: { finality: 'finalized', verified_at: nowIso, proposal_id: null }
};
const PROPOSAL_ALLOWED = new Set(['RESEARCHING>DRAFT', 'DRAFT>EVALUATED', 'EVALUATED>PROPOSED', 'PROPOSED>APPROVED', 'APPROVED>SIMULATED', 'SIMULATED>VERIFIED', 'RESEARCHING>REJECTED', 'DRAFT>REJECTED', 'EVALUATED>REJECTED', 'PROPOSED>REJECTED']);
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function matches(row, [c, op, v]) {
  const x = row[c];
  switch (op) {
    case 'eq': return x === v; case 'neq': return x !== v; case 'gt': return x > v; case 'gte': return x >= v; case 'lt': return x < v; case 'lte': return x <= v;
    case 'in': return v.includes(x); case 'is': return v === null || v === 'null' ? x == null : x === v; case 'contains': return Array.isArray(x) && v.every(i => x.includes(i));
    default: throw new StoreError('unsupported filter ' + op, 'config');
  }
}

export class MemoryStore {
  constructor(snapshot = null, { onChange = null, clock = () => Date.now() } = {}) {
    this.kind = 'memory'; this.t = snapshot?.t ? clone(snapshot.t) : {}; this.seq = snapshot?.seq ? { ...snapshot.seq } : {}; this.onChange = onChange; this.clock = clock;
  }
  snapshot() { return clone({ t: this.t, seq: this.seq }); }
  #tab(name) { return (this.t[name] ??= []); }
  #changed() { this.onChange?.(this); }
  #now() { return new Date(this.clock()).toISOString(); }
  #prepare(table, input) {
    const row = { ...clone(input) }; const defs = DEFAULTS[table] || {};
    for (const [k, d] of Object.entries(defs)) if (row[k] === undefined) row[k] = typeof d === 'function' ? (d === nowIso ? this.#now() : d()) : d;
    if (SERIAL.has(table)) { this.seq[table] = (this.seq[table] || 0) + 1; if (row.id === undefined) row.id = this.seq[table]; }
    else if (!IDENTITY[table] && row.id === undefined) row.id = uuid();
    if (table === 'agent_vote_counts' && row.votes === undefined) row.votes = 0;
    return row;
  }
  #conflict(table, row, skipRow = null) {
    const rows = this.#tab(table);
    for (const cols of UNIQUE[table] || []) if (cols.every(c => row[c] != null) && rows.some(r => r !== skipRow && cols.every(c => r[c] === row[c]))) return cols.join(',');
    // A logical job is unique across ALL states. Previously the active and succeeded
    // partial indexes allowed the same cycle to be queued again after success, then
    // explode when that second instance was marked succeeded.
    if (table === 'agent_jobs' && rows.some(r => r !== skipRow && r.dedupe_key === row.dedupe_key)) return 'dedupe_key';
    if (table === 'token_proposals' && row.dedupe_key && row.status !== 'REJECTED' && rows.some(r => r !== skipRow && r.agent_id === row.agent_id && r.dedupe_key === row.dedupe_key && r.status !== 'REJECTED')) return 'agent_id,dedupe_key';
    if (table === 'fee_receipts' && row.tx_signature && rows.some(r => r !== skipRow && r.tx_signature === row.tx_signature && r.wallet === row.wallet)) return 'tx_signature,wallet';
    return null;
  }
  async select(table, { filters = [], order, limit } = {}) {
    let rows = this.#tab(table).filter(r => filters.every(f => matches(r, f)));
    if (order) { const [c, d = 'asc'] = order; rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
    if (limit) rows = rows.slice(0, limit);
    return clone(rows);
  }
  async count(table){return this.#tab(table).length;}
  async insert(table, rows) {
    const list = (Array.isArray(rows) ? rows : [rows]).map(r => this.#prepare(table, r)); const out = [];
    for (const r of list) { const c = this.#conflict(table, r); if (c) throw new StoreError(`duplicate key (${c})`, PG.UNIQUE, 409); }
    for (const r of list) { this.#tab(table).push(r); out.push(clone(r)); }
    this.#changed(); return Array.isArray(rows) ? out : out[0];
  }
  async upsert(table, rows, { onConflict, ignoreDuplicates = false } = {}) {
    const cols = onConflict.split(','); const out = [];
    for (const input of Array.isArray(rows) ? rows : [rows]) {
      const existing = this.#tab(table).find(r => cols.every(c => r[c] === input[c]));
      if (existing) { if (!ignoreDuplicates) { Object.assign(existing, clone(input)); out.push(clone(existing)); } continue; }
      out.push(await this.insert(table, input));
    }
    this.#changed(); return Array.isArray(rows) ? out : out[0] ?? null;
  }
  async update(table, filters, patch) {
    const hit = this.#tab(table).filter(r => filters.every(f => matches(r, f))); const out = [];
    for (const r of hit) {
      const next = { ...r, ...clone(patch) };
      if (table === 'token_proposals' && patch.status && patch.status !== r.status) this.#guardProposal(r, next);
      if (table === 'treasury_ledger') throw new StoreError('treasury_ledger is append-only', PG.RAISE, 400);
      const c = this.#conflict(table, next, r); if (c) throw new StoreError(`duplicate key (${c})`, PG.UNIQUE, 409);
      Object.assign(r, next); if ('updated_at' in r && table === 'token_proposals') r.updated_at = this.#now(); out.push(clone(r));
    }
    if (out.length) this.#changed(); return out;
  }
  #guardProposal(old, next) {
    const bad = m => new StoreError(m, PG.RAISE, 400);
    if (!PROPOSAL_ALLOWED.has(`${old.status}>${next.status}`)) throw bad(`illegal proposal transition ${old.status} -> ${next.status}`);
    if (next.status === 'PROPOSED' && !(next.evidence_ids || []).length) throw bad('a proposal needs recorded evidence before it can be PROPOSED');
    if (next.status === 'APPROVED' && !(next.approved_by && next.approved_at)) throw bad('APPROVED requires a human approver');
    if (next.status === 'SIMULATED' && !next.simulation) throw bad('SIMULATED requires launch simulation output');
    if (next.status === 'VERIFIED' && !this.#tab('verified_tokens').some(v => v.proposal_id === next.id)) throw bad('VERIFIED requires an on-chain verified token record');
    this.#tab('audit_logs').push(this.#prepare('audit_logs', { actor: 'db', action: 'proposal_transition', subject_type: 'token_proposal', subject_id: next.id, details: { from: old.status, to: next.status, approved_by: next.approved_by } }));
  }
  async rpc(name, args) { const fn = MEM_RPC[name]; if (!fn) throw new StoreError('unknown function ' + name, 'PGRST202', 404); const out = fn(this, args || {}); this.#changed(); return clone(out); }
  // internal helpers for the RPC mirrors
  _rows(t) { return this.#tab(t); }
  _insert(t, row) { const r = this.#prepare(t, row); const c = this.#conflict(t, r); if (c) throw new StoreError(`duplicate key (${c})`, PG.UNIQUE, 409); this.#tab(t).push(r); return r; }
  _now() { return this.#now(); }
}

// --------------------------------------------------- JS mirrors of the SQL functions
const fail = (m, code) => { throw new StoreError(m, code, 400); };
export function treasurySplit(confirmedLamports, bps) {   // exact integer math; shared with the SQL semantics (floor, remainder to the other side)
  const c = BigInt(confirmedLamports), b = BigInt(bps);
  if (c < 0n || b < 0n || b > 10000n) fail('invalid amounts', PG.RAISE);
  const t = (c * b) / 10000n; return { treasury: Number(t), remainder: Number(c - t) };
}
const MEM_RPC = {
  cast_vote(s, { p_user, p_agent, p_max_changes_per_hour = 5 }) {
    const agent = s._rows('agents').find(a => a.id === p_agent && a.is_active); if (!agent) fail('unknown agent', PG.NOT_FOUND);
    const counts = id => s._rows('agent_vote_counts').find(c => c.agent_id === id) || s._insert('agent_vote_counts', { agent_id: id, votes: 0 });
    const bump = (id, d) => { const c = counts(id); c.votes += d; c.updated_at = s._now(); };
    const cur = s._rows('agent_votes').find(v => v.user_id === p_user);
    if (!cur) { s._insert('agent_votes', { user_id: p_user, agent_id: p_agent }); bump(p_agent, 1); s._insert('vote_changes', { user_id: p_user, from_agent: null, to_agent: p_agent, created_at: s._now() }); return { agent_id: p_agent, previous_agent_id: null, changed: true }; }
    if (cur.agent_id === p_agent) return { agent_id: p_agent, previous_agent_id: p_agent, changed: false };
    const since = new Date(s.clock() - 3600_000).toISOString();
    if (s._rows('vote_changes').filter(c => c.user_id === p_user && c.created_at > since).length >= p_max_changes_per_hour) fail('vote change limit reached; try again later', PG.RATE);
    const prev = cur.agent_id; cur.agent_id = p_agent; cur.updated_at = s._now(); cur.change_count += 1; bump(prev, -1); bump(p_agent, 1);
    s._insert('vote_changes', { user_id: p_user, from_agent: prev, to_agent: p_agent, created_at: s._now() });
    return { agent_id: p_agent, previous_agent_id: prev, changed: true };
  },
  claim_job(s, { p_worker, p_lease_seconds = 180 }) {
    const now = s._now(); const jobs = s._rows('agent_jobs')
      .filter(j => (j.status === 'queued' && j.run_after <= now) || (j.status === 'running' && j.locked_until < now)).sort((a, b) => (a.run_after > b.run_after ? 1 : -1));
    const j = jobs[0]; if (!j) return [];
    j.status = 'running'; j.locked_by = p_worker; j.locked_until = new Date(s.clock() + p_lease_seconds * 1000).toISOString(); j.attempts += 1; j.started_at ||= now; return [j];
  },
  ingest_fee_receipt(s, a) {
    const ex = s._rows('fee_receipts').find(r => r.source === a.p_source && r.external_id === a.p_external_id);
    if (ex) return { receipt_id: ex.id, created: false, status: ex.status };
    if (!Number.isSafeInteger(a.p_claimed) || a.p_claimed < 0) fail('invalid amount', PG.RAISE);
    const r = s._insert('fee_receipts', { source: a.p_source, external_id: a.p_external_id, mint: a.p_mint ?? null, wallet: a.p_wallet, tx_signature: a.p_signature ?? null, claimed_lamports: a.p_claimed, simulated: !!a.p_simulated, circuit_event_id: a.p_event_id ?? null });
    s._insert('treasury_ledger', { idempotency_key: 'fee_observed:' + r.id, entry_type: 'fee_observed', bucket: 'fees', amount: a.p_claimed, simulated: !!a.p_simulated, receipt_id: r.id, memo: 'observed, not yet confirmed on chain' });
    return { receipt_id: r.id, created: true, status: r.status };
  },
  confirm_fee_receipt(s, a) {
    const r = s._rows('fee_receipts').find(x => x.id === a.p_receipt); if (!r) fail('unknown receipt', PG.NOT_FOUND);
    const ex = s._rows('treasury_allocations').find(x => x.receipt_id === r.id); if (ex) return { receipt_id: r.id, allocation_id: ex.id, created: false };
    if (!Number.isSafeInteger(a.p_confirmed)) fail('invalid amounts', PG.RAISE);
    const { treasury, remainder } = treasurySplit(a.p_confirmed, a.p_treasury_bps);
    r.confirmed_lamports = a.p_confirmed; r.confirmed_at = s._now(); r.status = a.p_confirmed === r.claimed_lamports ? 'confirmed' : 'mismatch';
    const st = r.simulated ? 'simulated' : a.p_transfer_supported ? 'pending' : 'unsupported';
    const al = s._insert('treasury_allocations', { receipt_id: r.id, basis_bps: a.p_treasury_bps, treasury_lamports: treasury, remainder_lamports: remainder, treasury_destination: a.p_treasury_dest ?? null, remainder_destination: a.p_remainder_dest ?? null, status: st, mechanism: a.p_mechanism ?? null, simulated: r.simulated, note: st === 'unsupported' ? 'No documented/authorized transfer mechanism configured; allocation is a calculation only.' : null });
    s._insert('treasury_ledger', { idempotency_key: 'fee_confirmed:' + r.id, entry_type: 'fee_confirmed', bucket: 'fees', amount: a.p_confirmed, simulated: r.simulated, receipt_id: r.id, allocation_id: al.id, memo: 'confirmed on chain' });
    s._insert('treasury_ledger', { idempotency_key: 'alloc_treasury:' + al.id, entry_type: 'allocation_calculated', bucket: 'treasury', amount: treasury, simulated: r.simulated, receipt_id: r.id, allocation_id: al.id, memo: 'treasury share (calculated)' });
    s._insert('treasury_ledger', { idempotency_key: 'alloc_remainder:' + al.id, entry_type: 'allocation_calculated', bucket: 'remainder', amount: remainder, simulated: r.simulated, receipt_id: r.id, allocation_id: al.id, memo: 'remaining allocation (calculated)' });
    return { receipt_id: r.id, allocation_id: al.id, created: true, treasury_lamports: treasury, remainder_lamports: remainder, status: st };
  },
  record_transfer(s, { p_allocation, p_signature, p_lamports }) {
    const a = s._rows('treasury_allocations').find(x => x.id === p_allocation); if (!a) fail('unknown allocation', PG.NOT_FOUND);
    if (a.simulated) fail('simulated allocations cannot record transfers', PG.RAISE);
    if (a.status === 'transferred') return { allocation_id: a.id, created: false };
    if (!(p_lamports > 0) || p_lamports > a.treasury_lamports) fail('transfer exceeds allocation', PG.RAISE);
    if (s._rows('treasury_allocations').some(x => x.transfer_signature === p_signature)) throw new StoreError('duplicate key (transfer_signature)', PG.UNIQUE, 409);
    Object.assign(a, { status: 'transferred', transferred_lamports: p_lamports, transfer_signature: p_signature, updated_at: s._now() });
    s._insert('treasury_ledger', { idempotency_key: 'transfer:' + p_signature, entry_type: 'transfer_confirmed', bucket: 'treasury', amount: p_lamports, receipt_id: a.receipt_id, allocation_id: a.id, memo: 'verified transfer' });
    return { allocation_id: a.id, created: true };
  }
};

export function summarizeTreasury(ledger) {   // mirrors the treasury_summary view
  const sum = f => ledger.filter(f).reduce((n, e) => n + Number(e.amount), 0);
  const real = e => !e.simulated;
  return {
    observed_lamports: sum(e => real(e) && e.entry_type === 'fee_observed'),
    confirmed_lamports: sum(e => real(e) && e.entry_type === 'fee_confirmed'),
    allocation_treasury_lamports: sum(e => real(e) && e.entry_type === 'allocation_calculated' && e.bucket === 'treasury'),
    allocation_remainder_lamports: sum(e => real(e) && e.entry_type === 'allocation_calculated' && e.bucket === 'remainder'),
    transferred_lamports: sum(e => real(e) && e.entry_type === 'transfer_confirmed'),
    funding_lamports: sum(e => real(e) && e.entry_type === 'funding_recorded' && e.unit === 'lamports'),
    expense_lamports: sum(e => real(e) && e.entry_type === 'expense_recorded' && e.unit === 'lamports'),
    expense_usd_micros: sum(e => e.entry_type === 'expense_recorded' && e.unit === 'usd_micros'),
    simulated_confirmed_lamports: sum(e => e.simulated && e.entry_type === 'fee_confirmed')
  };
}
// The public URL may use its documented NEXT_PUBLIC_ alias on hosted Sites.
// A *server-only* service role key is still mandatory; never expose or infer it.
export const supabaseUrlFromEnv = env => env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
export function createStore(env, fetchImpl) {
  const url = supabaseUrlFromEnv(env);
  if (url && env.SUPABASE_SERVICE_ROLE_KEY) return new SupabaseStore({ url, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl });
  return null;
}
