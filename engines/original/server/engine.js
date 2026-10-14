import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { getChallenge, publicChallenge, buildMessages } from './challenges/index.js';
import { configHash } from './contenders.js';
import { aggregate } from './results.js';
import { ProviderError } from './providers/openaiCompatible.js';

export class HttpError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

const OUTPUT_CAP = 200_000;
const iso = () => new Date().toISOString();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function sanitizeOverrides(o) {
  if (o == null) return {};
  if (typeof o !== 'object' || Array.isArray(o)) throw new HttpError(400, 'bad_overrides', 'overrides must be an object');
  const out = {};
  if (o.systemPrompt !== undefined) {
    if (typeof o.systemPrompt !== 'string' || o.systemPrompt.length > 4000) throw new HttpError(400, 'bad_overrides', 'systemPrompt must be a string ≤ 4000 chars');
    out.systemPrompt = o.systemPrompt;
  }
  if (o.temperature !== undefined) {
    if (typeof o.temperature !== 'number' || !Number.isFinite(o.temperature)) throw new HttpError(400, 'bad_overrides', 'temperature must be a number');
    out.temperature = clamp(o.temperature, 0, 2);
  }
  if (o.maxTokens !== undefined) {
    if (!Number.isInteger(o.maxTokens)) throw new HttpError(400, 'bad_overrides', 'maxTokens must be an integer');
    out.maxTokens = clamp(o.maxTokens, 16, 16384);
  }
  return out;
}

/**
 * Battle engine. One battle = one challenge × N entrants, all receiving the identical challenge messages.
 * Events (via .events): 'event' → { battleId, type: 'delta'|'entry'|'battle', data }
 */
export function createEngine({ config, providers, contenders, store }) {
  const events = new EventEmitter();
  events.setMaxListeners(200);
  const active = new Set();
  let pending = 0;
  const emit = (battleId, type, data) => events.emit('event', { battleId, type, data });

  function persistResults() {
    try { store.writeResults(aggregate(store.all())); } catch (e) { console.warn('[engine] results snapshot failed:', e.message); }
  }

  async function runEntry(battle, entry, challenge) {
    const provider = providers[entry.provider];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.entryTimeoutMs);
    const t0 = performance.now();
    entry.status = 'LIVE';
    entry.timestamps.startedAt = iso();
    emit(battle.battleId, 'entry', { entry });
    let truncated = false;
    try {
      const messages = buildMessages(challenge, entry.configuration.systemPrompt);
      for await (const ev of provider.stream({
        model: entry.model, messages, temperature: entry.configuration.temperature, maxTokens: entry.configuration.maxTokens, signal: ctrl.signal,
      })) {
        if (ev.type === 'delta' || ev.type === 'reasoning') {
          if (entry.timestamps.firstTokenAt == null) {
            entry.timestamps.firstTokenAt = iso();
            entry.latency.firstTokenMs = Math.round(performance.now() - t0);
          }
          const field = ev.type === 'delta' ? 'output' : 'reasoning';
          if (entry[field].length + ev.text.length <= OUTPUT_CAP) {
            entry[field] += ev.text;
            emit(battle.battleId, 'delta', { entryId: entry.entryId, channel: field, text: ev.text });
          } else { truncated = true; ctrl.abort(); throw new ProviderError('Output limit exceeded'); }
        } else if (ev.type === 'queue') entry.latency.queueMs = ev.queueMs;
        else if (ev.type === 'usage') entry.usage = ev.usage;
        else if (ev.type === 'finish') entry.finishReason = ev.reason;
      }
      entry.latency.totalMs = Math.round(performance.now() - t0);
      if (ctrl.signal.aborted) throw new ProviderError('Generation aborted');
      if (!entry.finishReason) throw new ProviderError('Provider stream ended without a completion marker', { code: 'incomplete_stream' });
      if (!entry.output.trim()) throw new ProviderError('The model returned no answer content', { code: 'empty_response', detail: entry.reasoning ? 'Only reasoning tokens were produced; try a larger maxTokens.' : null });
      const v = challenge.verify(entry.output);
      v.verifiedAt = iso();
      if (entry.finishReason === 'length') v.notes = [...(v.notes || []), 'Output hit the token limit before finishing'];
      entry.verification = v;
      entry.status = 'COMPLETED';
    } catch (err) {
      entry.latency.totalMs = Math.round(performance.now() - t0);
      const timedOut = ctrl.signal.aborted && !truncated;
      entry.status = 'FAILED';
      entry.error = {
        code: timedOut ? 'timeout' : truncated ? 'output_limit' : err.code || 'provider_error',
        message: timedOut ? `No completion within ${config.entryTimeoutMs} ms` : truncated ? `Output exceeded ${OUTPUT_CAP} characters` : err.message || String(err),
        detail: err.detail ?? (err.cause?.code ? String(err.cause.code) : null),
      };
    } finally {
      clearTimeout(timer);
      entry.timestamps.completedAt = iso();
      emit(battle.battleId, 'entry', { entry });
      store.save(battle);
    }
  }

  async function run(battle, challenge) {
    active.add(battle.battleId);
    battle.status = 'LIVE';
    battle.startedAt = iso();
    store.save(battle);
    emit(battle.battleId, 'battle', { status: battle.status, startedAt: battle.startedAt });
    try {
      await Promise.all(battle.entries.map((e) => runEntry(battle, e, challenge)));
    } finally {
      battle.status = battle.entries.every((e) => e.status === 'FAILED') ? 'FAILED' : 'COMPLETED';
      battle.completedAt = iso();
      store.save(battle);
      active.delete(battle.battleId);
      persistResults();
      emit(battle.battleId, 'battle', { status: battle.status, completedAt: battle.completedAt, final: battle });
    }
  }

  return {
    events,
    activeCount: () => active.size,
    async createBattle({ challengeId, entrants }) {
      const challenge = getChallenge(challengeId);
      if (!challenge) throw new HttpError(404, 'unknown_challenge', `Unknown challengeId "${challengeId}"`);
      if (!Array.isArray(entrants) || entrants.length < 1) throw new HttpError(400, 'bad_entrants', 'entrants must be a non-empty array');
      if (entrants.length > config.maxEntrants) throw new HttpError(400, 'too_many_entrants', `At most ${config.maxEntrants} entrants per battle`);
      if (active.size + pending >= config.maxConcurrentBattles) throw new HttpError(429, 'arena_busy', `Arena capacity reached (limit ${config.maxConcurrentBattles})`);
      pending++;
      try {

      const roster = new Map((await contenders.describeAll()).map((c) => [c.id, c]));
      const problems = [];
      const seen = new Set();
      const entries = [];
      for (const [i, en] of entrants.entries()) {
        const c = roster.get(en?.contenderId);
        if (!c) { problems.push({ contenderId: en?.contenderId ?? null, reason: 'Unknown contender' }); continue; }
        if (!c.operational) { problems.push({ contenderId: c.id, reason: c.reason }); continue; }
        const overrides = sanitizeOverrides(en.overrides);
        const effective = { ...c.config, ...overrides };
        const hash = configHash(effective);
        const mutated = hash !== configHash(c.config);
        const dupKey = `${c.id}#${hash}`;
        if (seen.has(dupKey)) { problems.push({ contenderId: c.id, reason: 'Duplicate entrant with identical configuration' }); continue; }
        seen.add(dupKey);
        const label = typeof en.label === 'string' && en.label.trim() ? en.label.trim().slice(0, 80) : mutated ? `${c.name} ⟡ mutated` : c.name;
        entries.push({
          entryId: `e${i + 1}`, contenderId: c.id, label, kind: c.kind, family: c.family, provider: c.provider, model: c.model,
          modelIdentity: { modelId: c.model, declaredVersion: c.modelVersion, sourceRepository: c.sourceRepo },
          modelArtifact: providers[c.provider]?.modelArtifact?.(c.model) ?? null,
          baseModelId: c.baseModelId ?? c.id, mutationParentId: mutated ? c.id : c.mutationParentId ?? null,
          configuration: { ...effective, configHash: hash, mutated, overrides },
          messages: buildMessages(challenge, effective.systemPrompt),
          status: 'UNTESTED',
          timestamps: { createdAt: iso(), startedAt: null, firstTokenAt: null, completedAt: null },
          latency: { firstTokenMs: null, totalMs: null, queueMs: null },
          output: '', reasoning: '', finishReason: null, usage: null, verification: null, error: null,
        });
      }
      if (problems.length) throw new HttpError(422, 'entrants_rejected', 'One or more entrants cannot compete', problems);

      const battle = {
        schema: 'colosseum.battle/v1',
        battleId: `b_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        challengeId: challenge.id,
        challenge: publicChallenge(challenge),
        status: 'UNTESTED',
        createdAt: iso(), startedAt: null, completedAt: null,
        environment: { colosseum: config.version, node: process.version },
        entries,
      };
      store.save(battle);
      run(battle, challenge).catch((e) => console.error('[engine] battle crashed', battle.battleId, e));
      return battle;
      } finally { pending--; }
    },
  };
}
