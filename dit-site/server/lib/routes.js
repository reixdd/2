import {enrichConceptSources} from './coin-metadata.js';
import {publicConcepts} from './concepts.js';
import {readMarketSnapshot} from './market-snapshot.js';
// Backend routes beyond the original read-only chain verifier. Returns a Response, or null when the path is not ours.
import { AGENTS, AGENT_IDS } from './agents.js';
import { createStore } from './store-core.js';
import { agentId, limit as vLimit, ValidationError } from './validate.js';
import { bearer, makeVerifier, RateLimiter, AuthError, publicSupabaseKey, publicSupabaseUrl } from './auth.js';
import { castVote, voteTotals, currentVote } from './votes.js';
import { verifyWebhook } from './circuit.js';
import { ingestCircuitEvent, treasuryView, auditLog } from './ledger.js';

const voteLimiter = new RateLimiter(20, 60_000);       // best effort, per isolate; cast_vote() cooldown is the authoritative control
const hookLimiter = new RateLimiter(120, 60_000);
const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (data, status = 200, extra = {}) => Response.json(data, { status, headers: { ...HEADERS, ...extra } });
const clientKey = r => r.headers.get('cf-connecting-ip') || (r.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
const publicAgent = (a, p) => ({ id: a.id, title: a.title, tagline: a.tagline, specialty: a.specialty, state: a.state, current_stage: a.current_stage, state_since: a.state_since, last_active_at: a.last_active_at,
  profile: p ? { personality: p.personality, voice_line: p.voice_line, memory_focus: p.memory_focus, portrait: p.portrait, prompt_version: p.prompt_version, prompt_sha256: p.prompt_sha256 } : null });

async function workerStatus(store) {
  const beats = await store.select('worker_heartbeats'); const now = Date.now();
  const workers = beats.map(b => ({ worker_id: b.worker_id, version: b.version, started_at: b.started_at, last_seen_at: b.last_seen_at, alive: now - Date.parse(b.last_seen_at) < 180_000, info: b.info }));
  return { alive: workers.some(w => w.alive && ['local_autonomous_research','local_research'].includes(w.info?.kind)), workers };
}

export async function handleBackendApi(request, env, deps = {}) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  const mine = path === '/api/market' || path === '/api/config' || path === '/api/health' || path === '/api/vote' || path === '/api/votes' || path === '/api/me/vote' || /^\/api\/(agents|activity|proposals|tokens|treasury|memories|observations|evidence|integrations|results|observatory|concepts)(\/|$)/.test(path);
  if (!mine) return null;
  const allowedPost = path === '/api/vote' || path === '/api/integrations/circuit';
  if (method !== 'GET' && !(method === 'POST' && allowedPost)) return json({ error: 'Read-only API. Token signing is never exposed to visitors.' }, 405);
  try {
    const store = deps.store || createStore(env, deps.fetchImpl);
    const anonKey = publicSupabaseKey(env);
    const publicUrl = publicSupabaseUrl(env);
    const authMode = publicUrl && anonKey ? 'supabase' : env.DIT_DEV_AUTH === '1' && !publicUrl ? 'dev' : 'none';
    // Safe diagnostic: only missing variable NAMES, never values or secret prefixes.
    const missing = [!publicUrl && 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL', !env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean);
    if (path === '/api/config') return json({ backend: { configured: !!store, kind: store?.kind || null, missingBindings: store ? [] : missing }, auth: authMode, supabase: authMode === 'supabase' ? { url: publicUrl, anonKey } : null, treasuryTargetBps: Number(env.TREASURY_BPS || 2500), simulationOnly: true, release: 'dit-miami-signal-20261015' });
    if (!store) return json({ error: 'backend_not_configured', message: 'The database is not connected. Nothing below is live.' }, 503);

    if(path==='/api/market'){
      try{return json(await readMarketSnapshot(store))}
      catch{return json({signals:[],source_states:{},last_checked_at:null,stale:true,status:'SNAPSHOT_STORAGE_UNAVAILABLE',research_only:true},503)}
    }
    if(path==='/api/concepts'||path.startsWith('/api/concepts/')){
      const id=path==='/api/concepts'?null:decodeURIComponent(path.slice('/api/concepts/'.length));
      const requested=Number(url.searchParams.get('limit'));
      const pageSize=Number.isInteger(requested)&&requested>=1?Math.min(50,requested):200;
      const rows=await publicConcepts(store,id,url.searchParams.get('before'),pageSize);
      return id?(rows.length?json({concept:rows[0],fictional:true}):json({error:'Not found'},404)):
        json({concepts:rows.slice(0,pageSize),next_before:rows.length>pageSize?rows[pageSize-1].created_at:null,fictional:true});
    }
    if(path==='/api/observatory'){
      const [agents,profiles,beats,schedules,runs]=await Promise.all([
        store.select('agents'),store.select('agent_profiles'),store.select('worker_heartbeats'),
        store.select('research_schedules'),store.select('agent_research_runs',{order:['started_at','desc'],limit:50})
      ]);
      const local=beats.find(x=>x.worker_id==='dit-autonomous-local');
      const collector=beats.find(x=>x.worker_id==='dit-edge-cultural-evidence');
      const fresh=x=>!!x&&Number.isFinite(Date.parse(x.last_seen_at))&&
        Date.now()>=Date.parse(x.last_seen_at)&&Date.now()-Date.parse(x.last_seen_at)<180000;
      const live=fresh(local);
      return json({checked_at:new Date().toISOString(),researcher:{
        online:live,last_seen_at:local?.last_seen_at||null,
        paused_reason:live?local.info?.paused_reason||null:null,
        active:live?local.info?.active||[]:[],
        resources:live?local.info?.resources||null:null
      },collector:{online:fresh(collector),last_seen_at:collector?.last_seen_at||null},
      agents:agents.map(a=>{
        const schedule=schedules.find(x=>x.agent_id===a.id);
        const run=runs.find(x=>x.agent_id===a.id);
        return {...publicAgent(a,profiles.find(p=>p.agent_id===a.id)),
          presence:!live?'offline':local.info?.active?.includes(a.id)?'researching':
            local.info?.paused_reason?'resource pause':schedule?.enabled===false?'paused':'waiting',
          next_due_at:schedule?.next_due_at||null,queue_status:schedule?.status||null,
          last_run:run?{id:run.id,status:run.status,started_at:run.started_at,finished_at:run.finished_at,error:run.error}:null};
      })});
    }
    if (path === '/api/health') {
      const [w, jobs, sources] = await Promise.all([workerStatus(store), store.select('agent_jobs', { order: ['created_at', 'desc'], limit: 30, columns: 'id,agent_id,kind,status,stage,attempts,error,started_at,finished_at,created_at' }), store.select('research_sources')]);
      const agents = await store.select('agents');
      return json({ database: { status: 'connected', kind: store.kind }, worker: w, agents: agents.map(a => ({ id: a.id, state: a.state, last_active_at: a.last_active_at })),
        jobs: { recent: jobs.map(({ id, agent_id, kind, status, stage, attempts, error, started_at, finished_at }) => ({ id, agent_id, kind, status, stage, attempts, error, started_at, finished_at })), failed_recent: jobs.filter(j => j.status === 'failed' || j.status === 'dead').length },
        sources: sources.map(s => ({ id: s.id, enabled: s.enabled, requires_credentials: s.requires_credentials, verified_live: s.verified_live, last_success_at: s.last_success_at, last_error: s.last_error })), checkedAt: new Date().toISOString() });
    }
    if (path === '/api/agents') {
      const [agents, profiles, totals, w] = await Promise.all([store.select('agents'), store.select('agent_profiles'), voteTotals(store), workerStatus(store)]);
      const order = id => AGENT_IDS.indexOf(id);
      return json({ agents: agents.sort((a, b) => order(a.id) - order(b.id)).map(a => ({ ...publicAgent(a, profiles.find(p => p.agent_id === a.id)), votes: totals.leaderboard.find(l => l.agent_id === a.id) })), votes: totals, worker_alive: w.alive });
    }
    let m;
    if ((m = /^\/api\/agents\/([^/]+)$/.exec(path))) {
      const id = agentId(decodeURIComponent(m[1])); const eq = [['agent_id', 'eq', id]];
      const [a] = await store.select('agents', { filters: [['id', 'eq', id]] }); const [p] = await store.select('agent_profiles', { filters: eq });
      if (!a) return json({ error: 'Not found' }, 404);
      const [memories, observations, proposals, totals, tokens, activity, w] = await Promise.all([
        store.select('agent_memories', { filters: eq, order: ['created_at', 'desc'], limit: 30 }), store.select('observations', { filters: eq, order: ['observed_at', 'desc'], limit: 30 }),
        store.select('token_proposals', { filters: eq, order: ['created_at', 'desc'], limit: 30 }), voteTotals(store), store.select('verified_tokens', { filters: eq, order: ['verified_at', 'desc'], limit: 30 }),
        store.select('activity_events', { filters: eq, order: ['id', 'desc'], limit: 25 }), workerStatus(store)]);
      return json({ agent: publicAgent(a, p), memories, observations, proposals, tokens, activity, votes: totals.leaderboard.find(l => l.agent_id === id), vote_total: totals.total, worker_alive: w.alive,
        research_runs: await store.select('agent_research_runs',{filters:eq,order:['started_at','desc'],limit:12}), outcomes: proposals.filter(x => x.outcome).map(x => ({ proposal_id: x.id, name: x.name, ticker: x.ticker, outcome: x.outcome, lesson: x.lesson, checked_at: x.outcome_checked_at })) });
    }
    if (path === '/api/votes') return json(await voteTotals(store));
    if (path === '/api/me/vote') { const t = bearer(request); if (!t) return json({ error: 'Sign in required' }, 401); const u = await makeVerifier(env, deps.fetchImpl)(t); return json({ vote: await currentVote(store, u.id) }); }
    if (path === '/api/vote') {
      if (!voteLimiter.take(clientKey(request))) return json({ error: 'Too many vote requests. Slow down.' }, 429);
      const t = bearer(request); if (!t) return json({ error: 'Sign in with a verified email to vote.' }, 401);
      const user = await (deps.verifier || makeVerifier(env, deps.fetchImpl))(t);
      let body; try { const raw = await request.text(); if (raw.length > 2000) throw 0; body = JSON.parse(raw); } catch { return json({ error: 'Invalid request body' }, 400); }
      const result = await castVote(store, user.id, body?.agent_id);
      return json({ ...result, votes: await voteTotals(store) });
    }
    if (path === '/api/results') {
      const a = url.searchParams.get('agent'); const filters = a ? [['agent_id','eq',agentId(a)]] : [];
      const rows = await store.select('agent_research_runs',{filters,order:['started_at','desc'],limit:vLimit(url.searchParams.get('limit'),30,100)});
      return json({runs:rows.map(r=>({id:r.id,agent_id:r.agent_id,provider:r.provider,model:r.model,status:r.status,prompt:r.prompt,answer:r.answer,error:r.error,started_at:r.started_at,finished_at:r.finished_at,source_refs:r.source_refs||[],requested_specialists:r.requested_specialists||null})),note:'Research answers are interpretations, not verified transaction evidence.'});
    }
    if (path === '/api/activity') return json({ events: await store.select('activity_events', { order: ['id', 'desc'], limit: vLimit(url.searchParams.get('limit'), 50, 200) }) });
    if (path === '/api/observations') { const a = url.searchParams.get('agent'); return json({ observations: await store.select('observations', { filters: a ? [['agent_id', 'eq', agentId(a)]] : [], order: ['observed_at', 'desc'], limit: vLimit(url.searchParams.get('limit'), 50, 200) }) }); }
    if ((m = /^\/api\/memories\/([^/]+)$/.exec(path))) return json({ memories: await store.select('agent_memories', { filters: [['agent_id', 'eq', agentId(decodeURIComponent(m[1]))]], order: ['created_at', 'desc'], limit: vLimit(url.searchParams.get('limit'), 50, 200) }) });
    if (path === '/api/proposals') {
      const f = []; const a = url.searchParams.get('agent'), s = url.searchParams.get('status'); if (a) f.push(['agent_id', 'eq', agentId(a)]);
      if (s) { if (!/^[A-Z]+$/.test(s)) throw new ValidationError('Invalid status'); f.push(['status', 'eq', s]); }
      return json({ proposals: await store.select('token_proposals', { filters: f, order: ['created_at', 'desc'], limit: vLimit(url.searchParams.get('limit'), 50, 200) }), lifecycle: ['RESEARCHING', 'DRAFT', 'EVALUATED', 'PROPOSED', 'APPROVED', 'SIMULATED', 'VERIFIED'], note: 'Only VERIFIED proposals correspond to a finalized on-chain launch. APPROVED+ requires a human operator.' });
    }
    if ((m = /^\/api\/proposals\/([0-9a-f-]{36})$/.exec(path))) {
      const [p] = await store.select('token_proposals', { filters: [['id', 'eq', m[1]]] }); if (!p) return json({ error: 'Not found' }, 404);
      const ev = p.evidence_ids?.length ? await store.select('observations', { filters: [['id', 'in', p.evidence_ids]] }) : []; return json({ proposal: p, evidence: ev });
    }
    if (path === '/api/tokens') return json({ tokens: await store.select('verified_tokens', { order: ['verified_at', 'desc'], limit: 100 }) });
    if ((m = /^\/api\/evidence\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(path))) {
      const [t] = await store.select('verified_tokens', { filters: [['mint', 'eq', m[1]]] }); if (!t) return json({ error: 'No verified record for this mint' }, 404);
      const [proposal] = t.proposal_id ? await store.select('token_proposals', { filters: [['id', 'eq', t.proposal_id]] }) : [];
      const ev = proposal?.evidence_ids?.length ? await store.select('observations', { filters: [['id', 'in', proposal.evidence_ids]] }) : [];
      const [a] = await store.select('agents', { filters: [['id', 'eq', t.agent_id]] });
      const hist = proposal ? (await store.select('audit_logs', { filters: [['subject_type', 'eq', 'token_proposal'], ['subject_id', 'eq', String(proposal.id)], ['action', 'eq', 'proposal_transition']], order: ['created_at', 'asc'], limit: 50 })).map(h => ({ at: h.created_at, from: h.details?.from ?? null, to: h.details?.to ?? null })) : [];
      return json({ token: t, agent: a ? { id: a.id, title: a.title } : null, proposal: proposal || null, proposal_history: hist, evidence: ev, verifyPath: `/api/verify?signature=${t.signature}`, explorerUrl: `https://solscan.io/tx/${t.signature}`,
        note: 'Chain data proves the creation transaction and wallet relationship. It does not prove AI authorship.' });
    }
    if (path === '/api/treasury') return json(await treasuryView(store, env));
    if (path === '/api/integrations/circuit') {
      if (!hookLimiter.take(clientKey(request))) return json({ error: 'Rate limited' }, 429);
      const raw = await request.text(); if (raw.length > 65536) return json({ error: 'Payload too large' }, 413);
      const v = await verifyWebhook(env, request.headers, raw);
      if (!v.ok) { await auditLog(store, 'circuit', 'webhook_rejected', 'webhook', null, { reason: v.reason }).catch(() => {}); return json({ error: 'Unauthorized' }, v.reason === 'not_configured' ? 503 : 401); }
      let payload; try { payload = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
      return json(await ingestCircuitEvent(store, env, payload, { signatureValid: true }), 200);
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    if (e instanceof ValidationError) return json({ error: e.message }, e.status);
    if (e?.public) return json({ error: e.message }, e.status);
    return json({ error: 'Backend request failed', detail: e?.code === 'config' ? e.message : undefined }, 502);
  }
}
