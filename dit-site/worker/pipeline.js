// OBSERVE → CLASSIFY → RESEARCH → REMEMBER → GENERATE → EVALUATE → ARCHIVE
// Each agent runs the same stages with DIFFERENT sources, category weights, memory retrieval, prompts and scoring rubrics (see server/lib/agents.js).
import { AGENTS, STAGE_STATE } from '../server/lib/agents.js';
import { StoreError, PG } from '../server/lib/store-core.js';
import { proposalDraft, ValidationError } from '../server/lib/validate.js';
import { SOURCES } from './sources.js';
import { classify, clusterKey, KIND_HINT, jaccard, tokens } from './classify.js';
import { recall, remember, consolidate } from './memory.js';
import { extractJson, LlmUnavailable } from './llm.js';

const HOUR = 3600_000;
const HYPE = /(guaranteed|100x|1000x|to the moon|can'?t lose|risk[- ]free|will (pump|moon|explode|10x)|financial advice|next (doge|pepe|bonk|shib))/i;
const BLOCKED_NAME = /\b(official|elon|musk|trump|biden|vitalik|satoshi|binance|pump\.?fun|solana foundation)\b/i;

export async function setAgentState(store, agentId, stage, now) {
  await store.update('agents', [['id', 'eq', agentId]], { state: stage ? STAGE_STATE[stage] : 'IDLE', current_stage: stage || null, state_since: new Date(now()).toISOString(), last_active_at: new Date(now()).toISOString() });
}
const event = (store, agentId, jobId, event_type, title, detail, payload = {}, severity = 'info') => store.insert('activity_events', { agent_id: agentId, job_id: jobId, event_type, title, detail, payload, severity });

async function markSource(store, id, ok, err, now) {
  const patch = ok ? { last_success_at: new Date(now()).toISOString(), verified_live: true, last_error: null } : { last_error: String(err).slice(0, 300), last_error_at: new Date(now()).toISOString() };
  await store.update('research_sources', [['id', 'eq', id]], patch).catch(() => {});
}

// ---------------------------------------------------------------- OBSERVE
export async function observe(ctx) {
  const { store, persona, env, job, now } = ctx; const errors = []; let fresh = 0, attempted = 0;
  for (const { id } of persona.sources) {
    const a = SOURCES[id]; if (!a || a.researchOnly) continue;
    if (a.requiresCredentials && !a.configured?.(env)) { await markSource(store, id, false, 'credentials not configured', now); errors.push({ source: id, error: 'credentials not configured' }); continue; }
    if (ctx.gate && !ctx.gate.ok(id)) { errors.push({ source: id, error: 'rate-limited locally; skipped this cycle' }); continue; }
    attempted++;
    try {
      const items = await a.fetch(ctx); await markSource(store, id, true, null, now);
      const rows = items.map(it => { const c = classify(it.title, KIND_HINT[a.kind]); return { agent_id: persona.id, source_id: id, external_id: it.external_id, title: it.title, url: it.url, observed_at: it.observed_at, category: c.category, classifier: c.classifier, confidence: c.confidence, metrics: { ...it.metrics, engagement: it.engagement }, evidence: it.evidence || {}, job_id: job.id }; });
      if (rows.length) fresh += (await store.upsert('observations', rows, { onConflict: 'agent_id,source_id,external_id', ignoreDuplicates: true })).length;
    } catch (e) { await markSource(store, id, false, e.message, now); errors.push({ source: id, error: e.message }); }
  }
  if (attempted > 0 && errors.filter(e => e.error !== 'credentials not configured' && !e.error.startsWith('rate-limited')).length === attempted) throw new Error('every research source failed: ' + errors.map(e => `${e.source}: ${e.error}`).join('; '));
  await event(store, persona.id, job.id, 'observe', `${persona.id} scanned ${attempted} source(s)`, `${fresh} new observation(s) recorded${errors.length ? `; ${errors.length} source issue(s)` : ''}.`, { fresh, errors });
  return { fresh, errors };
}

// ---------------------------------------------------------------- CLASSIFY (cluster + persona-weighted ranking)
export function rankClusters(persona, observations, priorProposals, now) {
  const srcW = Object.fromEntries(persona.sources.map(s => [s.id, s.weight])); const byKey = new Map(); const maxEng = {};
  for (const o of observations) maxEng[o.source_id] = Math.max(maxEng[o.source_id] || 1, o.metrics?.engagement || 1);
  for (const o of observations) {
    const key = o.cluster_key || clusterKey(o.title); const eng = Math.log10(1 + (o.metrics?.engagement || 1)) / Math.log10(1 + maxEng[o.source_id]);
    const fresh = Math.pow(0.5, Math.max(0, now - Date.parse(o.observed_at)) / (24 * HOUR));
    const ctxOnly = o.evidence?.context_only; const paid = o.evidence?.paid_attention;
    const w = ctxOnly ? 0 : (srcW[o.source_id] ?? 0.2) * (persona.categoryWeights[o.category] ?? 0.5) * (0.3 + eng) * (0.3 + 0.7 * fresh) * (paid ? 0.3 : 1);
    const c = byKey.get(key) || { key, obs: [], sources: new Set(), score: 0, cats: {} };
    c.obs.push(o); c.sources.add(o.source_id); c.score += w; c.cats[o.category] = (c.cats[o.category] || 0) + (persona.categoryWeights[o.category] ?? 0.5); byKey.set(key, c);
  }
  const recent = new Set(priorProposals.filter(p => p.status !== 'REJECTED' && now - Date.parse(p.created_at) < 7 * 24 * HOUR).map(p => p.cluster_key));
  return [...byKey.values()].map(c => {
    const organic = c.obs.filter(o => !o.evidence?.paid_attention && !o.evidence?.context_only);
    const category = Object.entries(c.cats).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    const label = [...c.obs].sort((a, b) => (b.metrics?.engagement || 0) - (a.metrics?.engagement || 0))[0].title.slice(0, 120);
    return { key: c.key, label, category, observation_count: c.obs.length, organic_count: organic.length, sources: [...c.sources], first_seen_at: c.obs.map(o => o.observed_at).sort()[0], last_seen_at: c.obs.map(o => o.observed_at).sort().at(-1),
      score: c.score * (1 + 0.5 * (c.sources.size - 1)) * (recent.has(c.key) ? 0.2 : 1), obs: c.obs };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}
export async function classifyStage(ctx) {
  const { store, persona, now, job } = ctx; const since = new Date(now() - 72 * HOUR).toISOString();
  const obs = await store.select('observations', { filters: [['agent_id', 'eq', persona.id], ['observed_at', 'gte', since]], order: ['observed_at', 'desc'], limit: 400 });
  const priors = await store.select('token_proposals', { filters: [['agent_id', 'eq', persona.id]], order: ['created_at', 'desc'], limit: 50 });
  const clusters = await store.select('trend_clusters', { filters: [['agent_id', 'eq', persona.id]] }); const keyOf = Object.fromEntries(clusters.map(c => [c.id, c.key]));
  const ranked = rankClusters(persona, obs, priors.map(p => ({ ...p, cluster_key: keyOf[p.cluster_id] })), now());
  const top = ranked.slice(0, 8); const rows = [];
  for (const c of top) {
    const row = await store.upsert('trend_clusters', { agent_id: persona.id, key: c.key, label: c.label, category: c.category, score: Math.round(c.score * 1000) / 1000, observation_count: c.observation_count, first_seen_at: c.first_seen_at, last_seen_at: c.last_seen_at }, { onConflict: 'agent_id,key' });
    c.id = row?.id || (await store.select('trend_clusters', { filters: [['agent_id', 'eq', persona.id], ['key', 'eq', c.key]] }))[0].id; rows.push(c);
    for (const o of c.obs.filter(o => o.cluster_id !== c.id)) await store.update('observations', [['id', 'eq', o.id]], { cluster_id: c.id });
  }
  await event(store, persona.id, job.id, 'classify', `${persona.id} ranked ${ranked.length} trend cluster(s)`, top[0] ? `Leading signal: "${top[0].label}" (${top[0].category}, score ${top[0].score.toFixed(2)}).` : 'No qualifying signal this cycle.', { top: top.slice(0, 3).map(c => ({ key: c.key, category: c.category, score: c.score })) });
  return { ranked: rows };
}

// ---------------------------------------------------------------- RESEARCH (Market Observer)
export async function researchStage(ctx, cluster) {
  const { store, persona, job, now } = ctx; const q = cluster.key.split('-').slice(0, 2).join(' '); let market = null;
  if (ctx.gate?.ok('dexscreener_search') !== false) {
    try { market = await SOURCES.dexscreener_search.search(ctx, q); await markSource(store, 'dexscreener_search', true, null, now);
      const hour = new Date(now()).toISOString().slice(0, 13);
      await store.upsert('observations', [{ agent_id: persona.id, source_id: 'dexscreener_search', external_id: `dss:${q}:${hour}`, title: `Market check for "${q}": ${market.pairs} Solana pair(s), $${market.volume24h.toLocaleString('en-US')} 24h volume`, url: 'https://dexscreener.com/search?q=' + encodeURIComponent(q), observed_at: new Date(now()).toISOString(), category: 'market_anomaly', classifier: 'rules', confidence: 0.9, metrics: { pairs: market.pairs, volume24h: market.volume24h, liquidityUsd: market.liquidityUsd, engagement: market.pairs }, evidence: { market_check: true, context_only: true }, cluster_id: cluster.id, job_id: job.id }], { onConflict: 'agent_id,source_id,external_id', ignoreDuplicates: true });
    } catch (e) { await markSource(store, 'dexscreener_search', false, e.message, now); }
  }
  await event(store, persona.id, job.id, 'research', `${persona.id} researched "${cluster.label.slice(0, 60)}"`, market ? `${market.pairs} existing Solana pair(s) match "${q}".` : 'Market check unavailable this cycle; originality unverified.', { query: q, market: market && { pairs: market.pairs, volume24h: market.volume24h } });
  return { market, query: q };
}

// ---------------------------------------------------------------- GENERATE (Creative Director)
const SCHEMA = '{"name":"<=32 bytes","ticker":"A-Z0-9, <=13","narrative":"20-600 chars","aesthetic_direction":"visual direction, text only","transmission":"short fictional transmission in your own voice","rationale":"why this signal caught your attention","reasoning_summary":"your reasoning, with uncertainty stated","evidence_ids":["ids from evidence ONLY"],"confidence":0.0}';
export async function generateStage(ctx, cluster, evidence, market, memories, priors) {
  const { persona, llm, signal } = ctx; let lastErr = null, usage = { in: 0, out: 0 }, draft = null;
  const payload = { your_voice: persona.voiceLine, cluster: { label: cluster.label, category: cluster.category }, evidence: evidence.map(o => ({ id: o.id, source: o.source_id, title: o.title, url: o.url, metrics: o.metrics, paid_promotion: !!o.evidence?.paid_attention })),
    market_check: market && { query: market.query, existing_solana_pairs: market.pairs, volume24h_usd: market.volume24h, existing_symbols: market.tokens.slice(0, 15).map(t => t.symbol) }, your_memories: memories.map(m => ({ kind: m.kind, note: m.summary })), your_previous_concepts: priors.slice(0, 8).map(p => ({ name: p.name, ticker: p.ticker, status: p.status, lesson: p.lesson })), reply_schema: SCHEMA };
  for (let attempt = 0; attempt < 2 && !draft; attempt++) {
    const r = await llm.complete({ agentId: persona.id, system: persona.systemPrompt, user: JSON.stringify(payload) + (lastErr ? `\nYour previous reply was rejected: ${lastErr}. Reply again with valid JSON only.` : ''), temperature: persona.temperature, signal });
    usage = { in: usage.in + r.usage.in, out: usage.out + r.usage.out };
    try { const raw = extractJson(r.text); const ids = new Set(evidence.map(o => o.id)); draft = proposalDraft(raw); draft.evidence_ids = draft.evidence_ids.filter(id => ids.has(id)); if (!draft.evidence_ids.length) throw new ValidationError('evidence_ids must cite provided evidence'); }
    catch (e) { lastErr = e.message; draft = null; }
  }
  return { draft, usage, error: draft ? null : lastErr };
}

// ---------------------------------------------------------------- EVALUATE (Originality Checker + Evidence Verifier + persona rubric)
export function evaluate(persona, draft, { evidence, cluster, market, priors, now }) {
  const reasons = []; const text = [draft.name, draft.narrative, draft.rationale, draft.transmission, draft.reasoning_summary].join(' ');
  if (HYPE.test(text)) reasons.push('fabricated_hype');
  if (BLOCKED_NAME.test(draft.name + ' ' + draft.ticker)) reasons.push('possible_impersonation');
  const nameTok = tokens(draft.name);
  const selfSim = Math.max(0, ...priors.filter(p => p.status !== 'REJECTED' && p.name).map(p => Math.max(jaccard(nameTok, tokens(p.name)), p.ticker === draft.ticker ? 1 : 0)));
  let marketSim = 0, collisions = [], checked = !!market;
  for (const t of market?.tokens || []) { const s = Math.max(jaccard(nameTok, tokens(t.name)), t.symbol.toUpperCase() === draft.ticker ? 1 : 0); if (s >= 0.8) collisions.push({ symbol: t.symbol, name: t.name, url: t.url }); marketSim = Math.max(marketSim, s); }
  if (selfSim >= 0.6) reasons.push('duplicates_own_earlier_concept');
  if (collisions.length) reasons.push('collides_with_existing_token');
  const organic = evidence.filter(o => !o.evidence?.paid_attention && !o.evidence?.context_only); const orgSources = new Set(organic.map(o => o.source_id));
  if (!evidence.every(o => o.url)) reasons.push('evidence_without_source_link');
  const ev = Math.min(1, orgSources.size / 2) * 0.6 + Math.min(1, organic.length / 4) * 0.4;
  const hist = evidence.filter(o => o.metrics?.year || /^wikipedia/.test(o.source_id)); const old = evidence.some(o => o.metrics?.year && o.metrics.year < 2012);
  const days = new Set(cluster.obs.map(o => o.observed_at.slice(0, 10))).size; const newest = Math.max(...evidence.map(o => Date.parse(o.observed_at)));
  const comp = {
    evidence: organic.length ? ev : Math.min(ev, 0.2),
    novelty: 1 - Math.max(selfSim, marketSim), personaFit: Math.min(1, (persona.categoryWeights[cluster.category] ?? 0.5) / 1.6),
    historicalDepth: old ? 1 : Math.min(1, (hist.length / Math.max(1, evidence.length)) * 0.6), longevity: Math.min(1, days / 3),
    timing: Math.min(1, Math.pow(0.5, Math.max(0, now - newest) / (24 * HOUR)) + (market && market.pairs === 0 ? 0.2 : 0))
  };
  const wsum = Object.values(persona.rubric).reduce((a, b) => a + b, 0) || 1; const score = Object.entries(persona.rubric).reduce((n, [k, w]) => n + w * comp[k], 0) / wsum;
  const confidence = Math.round(Math.min(draft.confidence, 0.4 + 0.6 * comp.evidence) * 100) / 100;
  const status = reasons.length ? 'REJECTED' : !checked ? 'EVALUATED' : score >= persona.minScore ? 'PROPOSED' : 'EVALUATED';
  return { status, reasons, score: Math.round(score * 1000) / 1000, breakdown: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, Math.round(v * 1000) / 1000])), confidence,
    originality: { checked, collisions, self_similarity: Math.round(selfSim * 100) / 100, market_baseline: market ? { pairs: market.pairs, volume24h: market.volume24h, query: market.query } : null, note: checked ? undefined : 'Market originality could not be checked this cycle; concept is held at EVALUATED.' } };
}

// ---------------------------------------------------------------- the whole cycle
export async function runCycle(ctx) {
  const { store, persona, job, now, llm } = ctx; const usage = { in: 0, out: 0 }; const result = { stages: {} };
  const stage = async (s, fn) => { ctx.setStage?.(s); await setAgentState(store, persona.id, s, now); await store.update('agent_jobs', [['id', 'eq', job.id]], { stage: s }); result.stages[s] = 'ok'; return fn(); };
  try {
    await event(store, persona.id, job.id, 'cycle_start', `${persona.id} began a research cycle`, null);
    const obs = await stage('OBSERVE', () => observe(ctx)); result.fresh_observations = obs.fresh; result.source_errors = obs.errors.length;
    const { ranked } = await stage('CLASSIFY', () => classifyStage(ctx));
    const cluster = ranked[0]; if (!cluster) { result.outcome = 'no_signal'; await event(store, persona.id, job.id, 'idle', `${persona.id} found no qualifying signal`, 'Nothing cleared its thresholds. No concept generated.'); return { result, usage }; }
    const { market, query } = await stage('RESEARCH', () => researchStage(ctx, cluster)); if (market) market.query = query;
    const memories = await stage('REMEMBER', async () => { const terms = [...tokens(cluster.label), cluster.category]; const m = await recall(store, persona, terms, { now: now() }); const cons = await consolidate(store, persona, { llm, signal: ctx.signal, jobId: job.id }); if (cons.usage) { usage.in += cons.usage.in; usage.out += cons.usage.out; } return m; });
    const mem = await remember(store, persona.id, { kind: 'episodic', content: `Cycle observed ${obs.fresh} new items. Leading cluster "${cluster.label}" (${cluster.category}); score ${cluster.score.toFixed(2)} from ${cluster.sources.join(', ')}. ${market ? `Market check: ${market.pairs} existing Solana pair(s).` : 'Market check unavailable.'}`, summary: `Saw "${cluster.label.slice(0, 80)}" as ${cluster.category}; ${market ? market.pairs + ' pairs already trade it' : 'market unchecked'}.`, tags: [cluster.category, ...Object.keys(persona.memoryWeights.tags).slice(0, 1)], importance: Math.min(1, 0.3 + cluster.score / 10), refs: cluster.obs.slice(0, 5).map(o => ({ type: 'observation', id: o.id })), jobId: job.id });
    if (!ctx.llmAllowed || !llm.configured) { result.outcome = 'research_only'; result.generate = llm.configured ? 'skipped: token budget reached' : 'skipped: LLM provider not configured'; await event(store, persona.id, job.id, 'generate_skipped', `${persona.id} recorded research but generated no concept`, result.generate, {}, 'warn'); return { result, usage }; }
    const evidence = [...cluster.obs].filter(o => !o.evidence?.context_only || o.evidence?.market_check).sort((a, b) => (b.metrics?.engagement || 0) - (a.metrics?.engagement || 0)).slice(0, 6);
    const stored = await store.select('observations', { filters: [['cluster_id', 'eq', cluster.id]] }); const market_obs = stored.filter(o => o.evidence?.market_check).slice(0, 1);
    const evidenceFull = [...evidence.filter(o => !o.evidence?.market_check), ...market_obs].slice(0, 7);
    const priors = await store.select('token_proposals', { filters: [['agent_id', 'eq', persona.id]], order: ['created_at', 'desc'], limit: 20 });
    const proposal = await store.insert('token_proposals', { agent_id: persona.id, status: 'RESEARCHING', cluster_id: cluster.id, evidence_ids: evidenceFull.map(o => o.id), job_id: job.id });
    const gen = await stage('GENERATE', () => generateStage(ctx, cluster, evidenceFull, market, memories, priors)); usage.in += gen.usage.in; usage.out += gen.usage.out;
    if (!gen.draft) {
      await store.update('token_proposals', [['id', 'eq', proposal.id]], { status: 'REJECTED', rejected_reason: 'generation_invalid: ' + gen.error });
      await event(store, persona.id, job.id, 'generate_failed', `${persona.id}'s concept failed validation`, gen.error, { proposal_id: proposal.id }, 'warn'); result.outcome = 'generation_invalid'; return { result, usage };
    }
    const dedupe = `${gen.draft.name.toLowerCase()}|${gen.draft.ticker}`;
    try { await store.update('token_proposals', [['id', 'eq', proposal.id]], { ...gen.draft, dedupe_key: dedupe, status: 'DRAFT' }); } catch (e) { if (e instanceof StoreError && e.code === PG.UNIQUE) { await store.update('token_proposals', [['id', 'eq', proposal.id]], { status: 'REJECTED', rejected_reason: 'duplicates_own_earlier_concept' }); result.outcome = 'duplicate'; return { result, usage }; } throw e; }
    await event(store, persona.id, job.id, 'draft', `${persona.id} drafted "${gen.draft.name}" ($${gen.draft.ticker})`, gen.draft.rationale, { proposal_id: proposal.id });
    const ev = await stage('EVALUATE', async () => evaluate(persona, gen.draft, { evidence: evidenceFull, cluster, market, priors, now: now() }));
    await stage('ARCHIVE', async () => {
      const base = { score: ev.score, score_breakdown: ev.breakdown, originality: ev.originality, confidence: ev.confidence };
      if (ev.status === 'REJECTED') {
        await store.update('token_proposals', [['id', 'eq', proposal.id]], { ...base, status: 'REJECTED', rejected_reason: ev.reasons.join(', '), dedupe_key: null });
        await remember(store, persona.id, { kind: 'lesson', content: `Rejected my own concept "${gen.draft.name}" ($${gen.draft.ticker}): ${ev.reasons.join(', ')}. ${ev.originality.collisions.map(c => `Collides with ${c.symbol}`).join('; ')}`, summary: `Self-rejected "${gen.draft.name}": ${ev.reasons.join(', ')}`, tags: ['false_positive', 'originality', 'lesson'], importance: 0.8, refs: [{ type: 'proposal', id: proposal.id }], jobId: job.id });
      } else {
        await store.update('token_proposals', [['id', 'eq', proposal.id]], { ...base, status: 'EVALUATED' });
        if (ev.status === 'PROPOSED') await store.update('token_proposals', [['id', 'eq', proposal.id]], { status: 'PROPOSED' });
        await remember(store, persona.id, { kind: 'episodic', content: `Concept "${gen.draft.name}" ($${gen.draft.ticker}) scored ${ev.score} (min ${persona.minScore}) → ${ev.status}. Breakdown ${JSON.stringify(ev.breakdown)}.`, summary: `Concept "${gen.draft.name}" → ${ev.status} (${ev.score})`, tags: [cluster.category, 'proposal'], importance: ev.status === 'PROPOSED' ? 0.7 : 0.4, refs: [{ type: 'proposal', id: proposal.id }], jobId: job.id });
      }
      await event(store, persona.id, job.id, 'decision', `${persona.id} ${ev.status === 'PROPOSED' ? 'published a proposal' : ev.status === 'REJECTED' ? 'rejected its own concept' : 'held a concept at EVALUATED'}: "${gen.draft.name}"`, `Score ${ev.score}${ev.reasons.length ? ' — ' + ev.reasons.join(', ') : ''}. Simulation only; no launch occurs without explicit human approval.`, { proposal_id: proposal.id, status: ev.status });
    });
    result.outcome = ev.status; result.proposal_id = proposal.id; return { result, usage };
  } finally { await setAgentState(store, persona.id, null, now);  }
}

// ---------------------------------------------------------------- outcome feedback
export async function runOutcomeCheck(ctx) {
  const { store, persona, job, now, llm } = ctx; const id = job.payload?.proposal_id; const [p] = await store.select('token_proposals', { filters: [['id', 'eq', id]] });
  if (!p || p.outcome) return { result: { outcome: 'nothing_to_check' }, usage: { in: 0, out: 0 } };
  const base = p.originality?.market_baseline; if (!base?.query) { await store.update('token_proposals', [['id', 'eq', id]], { outcome: { verdict: 'unmeasurable', reason: 'no market baseline was recorded' }, outcome_checked_at: new Date(now()).toISOString() }); return { result: { outcome: 'unmeasurable' }, usage: { in: 0, out: 0 } }; }
  const nowM = await SOURCES.dexscreener_search.search(ctx, base.query);   // throws → job retry
  const dv = nowM.volume24h - base.volume24h; const verdict = nowM.pairs > base.pairs * 1.25 + 1 || dv > base.volume24h * 0.5 + 1000 ? 'narrative_gained_market_attention' : nowM.pairs < base.pairs * 0.75 || dv < -base.volume24h * 0.5 ? 'faded' : 'no_material_change';
  const outcome = { verdict, measured: 'third-party Solana market attention to the narrative keyword, NOT the performance of any launched token', query: base.query, then: { pairs: base.pairs, volume24h: base.volume24h }, now: { pairs: nowM.pairs, volume24h: nowM.volume24h }, checked_after_hours: Math.round((now() - Date.parse(p.created_at)) / HOUR) };
  const lesson = { narrative_gained_market_attention: `"${p.name}" narrative later drew more market attention (${base.pairs}→${nowM.pairs} pairs). The early read held up.`, faded: `"${p.name}" narrative faded (${base.pairs}→${nowM.pairs} pairs). Treat similar signals with more caution.`, no_material_change: `"${p.name}" narrative showed no material market change after ${outcome.checked_after_hours}h. Signal may have been weak or too early.` }[verdict];
  await store.update('token_proposals', [['id', 'eq', id]], { outcome, lesson, outcome_checked_at: new Date(now()).toISOString() });
  await remember(store, persona.id, { kind: 'outcome', content: `${lesson} ${JSON.stringify(outcome.then)} → ${JSON.stringify(outcome.now)}.`, summary: lesson, tags: verdict === 'faded' ? ['false_positive', 'timing', 'longevity'] : ['timing', 'reaction', 'longevity'], importance: 0.85, refs: [{ type: 'proposal', id }], jobId: job.id });
  await event(store, persona.id, job.id, 'outcome', `${persona.id} reviewed an earlier concept: ${verdict.replaceAll('_', ' ')}`, lesson, { proposal_id: id, verdict });
  void llm; return { result: { outcome: verdict }, usage: { in: 0, out: 0 } };
}
