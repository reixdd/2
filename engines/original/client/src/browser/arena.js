import { listChallenges, getChallenge, publicChallenge, buildMessages, DISCIPLINES } from '../../../shared/challenges/index.js';
import { aggregate } from '../../../shared/results.js';
import { configHash } from '../../../shared/hash.js';

const now = () => new Date().toISOString();
const copy = (x) => structuredClone(x);
const fail = (message, code = 'browser_error') => Object.assign(new Error(message), { code });
const CAP = 200000;

/** Same deterministic challenges as the server; browser results are explicitly untrusted. */
export function createBrowserArena({ provider, store, catalog, cast, onChange = () => {}, loadTimeoutMs = 600000, inferenceTimeoutMs = 180000, assetBase = '/' }) {
  const records = new Map(store.records.map((b) => [b.battleId, b]));
  const ready = new Map(), subscribers = new Map();
  let busy = false, controller = null;
  let device = { supported: false, reason: 'Checking WebGPU…' };
  let loading = null, storageWarning = store.warning;
  let closing = false;
  const all = () => [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const changed = () => onChange();
  const save = async (b) => {
    records.set(b.battleId, b);
    try { await store.save(copy(b)); }
    catch (e) { storageWarning = `Evidence could not be saved: ${e.message}. Export JSON before leaving.`; changed(); }
  };
  for (const b of records.values()) if (['LIVE', 'UNTESTED'].includes(b.status)) {
    b.status = 'FAILED'; b.completedAt = now();
    for (const e of b.entries) if (['LIVE', 'UNTESTED'].includes(e.status)) {
      e.status = 'FAILED'; e.verification = null; e.error = { code: 'interrupted', message: 'Browser session ended during evaluation' }; e.timestamps.completedAt = b.completedAt;
    }
    void save(b);
  }
  const emit = (b) => { for (const s of subscribers.get(b.battleId) ?? []) s.update(copy(b)); };
  const notify = (b) => { emit(b); changed(); };
  const waitAbort = (work, signal) => new Promise((resolve, reject) => {
    const abort = () => reject(fail('Operation cancelled or timed out', 'cancelled'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });

  async function load(model, signal) {
    loading = { model, progress: 0, text: 'Initializing real model weights…' }; changed();
    try {
      const artifact = await waitAbort(provider.load(model, (report) => {
        loading = { model, progress: Math.max(0, Math.min(1, report.progress || 0)), text: report.text || 'Loading…' }; changed();
      }, signal), signal);
      ready.set(model, artifact); changed();
      return artifact;
    } catch (e) { ready.delete(model); throw e instanceof Error ? e : new Error(String(e)); }
    finally { loading = null; changed(); }
  }
  async function initializeModel(id) {
    if (busy) throw fail('A model download or battle is already running', 'arena_busy');
    if (!device.supported) throw fail(device.reason || 'Device inference unavailable', 'unsupported_device');
    const c = catalog.find((c) => c.id === id && c.integrated);
    if (!c) throw fail('This contestant has no browser adapter');
    busy = true; controller = new AbortController(); changed();
    const timer = setTimeout(() => controller?.abort(), loadTimeoutMs);
    try { return await load(c.model, controller.signal); }
    finally { clearTimeout(timer); busy = false; closing = false; controller = null; changed(); }
  }
  const described = () => catalog.map((c) => {
    const operational = c.integrated && ready.has(c.model) && device.supported;
    const entries = all().flatMap((b) => b.entries).filter((e) => e.contenderId === c.id && e.configuration.configHash === configHash(c.config));
    const state = entries.some((e) => e.status === 'LIVE') ? 'LIVE' : entries[0]?.status ?? 'UNTESTED';
    return { ...c, operational, state, availability: operational ? 'confirmed' : 'unconfirmed',
      reason: !c.integrated ? 'Future contestant — no browser adapter' : !device.supported ? device.reason : operational ? 'Weights successfully initialized in this browser session' : 'Load and validate weights on this device first' };
  });

  const artUrl = (url) => url?.startsWith('/') ? assetBase.replace(/\/$/, '') + url : url;
  function characters() {
    const results = aggregate(all());
    return described().map((c) => {
      const rows = Object.values(results.disciplines).flat().filter((r) => r.contenderId === c.id && r.configHash === configHash(c.config));
      const byCh = Object.assign({}, ...rows.map((r) => r.byChallenge));
      const testedCapabilities = listChallenges().map((ch) => ({ challengeId: ch.id, title: ch.title, discipline: ch.discipline, avgScore: byCh[ch.id]?.avgScore ?? null, runs: byCh[ch.id]?.runs ?? 0 }));
      const evaluation = rows.reduce((a, r) => ({ attempts: a.attempts + r.attempts, completed: a.completed + r.completed, failed: a.failed + r.failed }), { attempts: 0, completed: 0, failed: 0 });
      const verificationStatus = !evaluation.completed ? 'UNVERIFIED' : testedCapabilities.some((t) => !t.runs) ? 'PARTIAL' : 'EVALUATED';
      const p = cast[c.family] ?? {}, variant = c.mutationParentId !== null;
      return { id: c.id, joinedAt: null,
        technical: { modelId: c.model, modelVersion: c.modelVersion, provider: c.provider, sourceRepository: c.sourceRepo, openWeights: c.openWeights, family: c.family, kind: c.kind,
          baseModelId: c.baseModelId, mutationParentId: c.mutationParentId, configuration: c.config, configHash: configHash(c.config), catalogConfirmed: c.operational, verificationStatus, testedCapabilities, evaluation },
        presentation: { cast: !!p.artKey || !!p.originalArtworkUrl, displayName: c.name, characterName: variant ? 'Twice-Checked Sage' : p.characterName ?? null, archetype: p.archetype ?? null,
          originalArtworkUrl: artUrl(p.originalArtworkUrl ?? (p.artKey ? `/art/${variant ? 'qwen-verifier' : p.artKey}.svg` : null)), portraitUrl: artUrl(p.portraitUrl ?? (p.artKey ? `/art/${variant ? 'qwen-verifier' : p.artKey}-portrait.svg` : null)),
          entranceAnimation: p.entranceAnimation, visualTheme: p.visualTheme, lore: p.lore, unofficial: true, inheritedTraits: variant ? ['silhouette', 'palette'] : [], disclaimer: 'Original concept placeholder; unofficial interpretation, no affiliation.' },
        status: { operational: c.operational, integrated: c.integrated, availability: c.operational ? 'ONLINE' : c.integrated ? 'OFFLINE' : 'RESERVED', label: c.operational ? c.state : c.integrated ? 'OFFLINE' : 'RESERVED', state: c.state, reason: c.reason },
      };
    });
  }
  function overrideConfig(c, overrides = {}) {
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw fail('Invalid configuration');
    const config = { ...c.config };
    if (overrides.systemPrompt !== undefined) {
      if (typeof overrides.systemPrompt !== 'string' || overrides.systemPrompt.length > 4000) throw fail('System prompt must be at most 4000 characters');
      config.systemPrompt = overrides.systemPrompt;
    }
    if (overrides.temperature !== undefined) {
      if (!Number.isFinite(overrides.temperature)) throw fail('Invalid temperature');
      config.temperature = Math.max(0, Math.min(2, overrides.temperature));
    }
    if (overrides.maxTokens !== undefined) {
      if (!Number.isInteger(overrides.maxTokens)) throw fail('Invalid token limit');
      config.maxTokens = Math.max(16, Math.min(2048, overrides.maxTokens));
    }
    const hash = configHash(config);
    return { ...config, configHash: hash, mutated: hash !== configHash(c.config), overrides };
  }
  async function run(battle, challenge) {
    battle.status = 'LIVE'; battle.startedAt = now(); await save(battle); notify(battle);
    // Serial execution avoids holding two models in scarce GPU memory. Preparation
    // time is reported separately; inference latency starts when the prompt is sent.
    for (const entry of battle.entries) {
      if (closing) {
        entry.status = 'FAILED'; entry.error = { code: 'cancelled', message: 'Battle cancelled before this entry started' }; entry.timestamps.completedAt = now();
        continue;
      }
      controller = new AbortController();
      const signal = controller.signal;
      let timer = setTimeout(() => controller?.abort(), loadTimeoutMs), phase = 'model_loading', t0;
      entry.status = 'LIVE'; entry.timestamps.startedAt = now(); notify(battle);
      try {
        const prep = performance.now();
        entry.modelArtifact = await load(entry.model, signal);
        entry.latency.modelLoadMs = Math.round(performance.now() - prep);
        clearTimeout(timer); phase = 'inference';
        timer = setTimeout(() => controller?.abort(), inferenceTimeoutMs);
        t0 = performance.now(); entry.timestamps.promptSentAt = now();
        const iterator = provider.stream({ model: entry.model, messages: entry.messages, temperature: entry.configuration.temperature, maxTokens: entry.configuration.maxTokens, signal })[Symbol.asyncIterator]();
        try {
          for (;;) {
            const step = await waitAbort(iterator.next(), signal);
            if (step.done) break;
            const ev = step.value;
            if (ev.type === 'delta' || ev.type === 'reasoning') {
              if (typeof ev.text !== 'string') throw fail('Malformed model stream');
              if (entry.timestamps.firstTokenAt === null && ev.text) { entry.timestamps.firstTokenAt = now(); entry.latency.firstTokenMs = Math.round(performance.now() - t0); }
              const channel = ev.type === 'delta' ? 'output' : 'reasoning';
              if (entry[channel].length + ev.text.length > CAP) throw fail('Model output exceeded the capture limit', 'output_limit');
              entry[channel] += ev.text; emit(battle);
            } else if (ev.type === 'finish') entry.finishReason = ev.reason;
            else if (ev.type === 'usage') entry.usage = ev.usage;
          }
        } finally { if (signal.aborted) void iterator.return?.(); }
        entry.latency.totalMs = Math.round(performance.now() - t0);
        if (signal.aborted) throw fail('Inference cancelled or timed out', 'cancelled');
        if (!entry.finishReason) throw fail('Model stream ended without a completion marker', 'incomplete_stream');
        if (!entry.output.trim()) throw fail('Model returned no answer content', 'empty_response');
        entry.verification = { ...challenge.verify(entry.output), verifiedAt: now(), trust: 'device-local; not server-attested' };
        if (entry.finishReason === 'length') entry.verification.notes.push('Output hit the token limit');
        entry.status = 'COMPLETED';
      } catch (e) {
        provider.cancel(); ready.clear();
        entry.status = 'FAILED'; entry.verification = null;
        entry.error = { code: signal.aborted ? closing ? 'cancelled' : 'timeout' : e.code || 'provider_error', message: e?.message || String(e), phase };
        if (t0 !== undefined) entry.latency.totalMs = Math.round(performance.now() - t0);
      } finally { clearTimeout(timer); entry.timestamps.completedAt = now(); controller = null; await save(battle); notify(battle); }
    }
    battle.status = battle.entries.every((e) => e.status === 'FAILED') ? 'FAILED' : 'COMPLETED';
    battle.completedAt = now(); await save(battle); notify(battle);
    for (const s of subscribers.get(battle.battleId) ?? []) s.resolve(copy(battle));
    subscribers.delete(battle.battleId); busy = false; closing = false; changed();
  }
  async function createBattle({ challengeId, entrants }) {
    if (busy) throw fail('A download or battle is already running', 'arena_busy');
    const ch = getChallenge(challengeId);
    if (!ch) throw fail('Unknown challenge');
    if (!Array.isArray(entrants) || entrants.length < 1 || entrants.length > 6) throw fail('Select between one and six entrants');
    const roster = described(), seen = new Set();
    const entries = entrants.map((en, i) => {
      const c = roster.find((c) => c.id === en.contenderId);
      if (!c?.operational) throw fail(c?.reason || 'Unknown contender', 'contender_offline');
      const configuration = overrideConfig(c, en.overrides);
      const key = `${c.id}#${configuration.configHash}`;
      if (seen.has(key)) throw fail('Duplicate contestant and configuration');
      seen.add(key);
      return { entryId: `e${i + 1}`, contenderId: c.id, label: typeof en.label === 'string' && en.label.trim() ? en.label.trim().slice(0, 80) : c.name, kind: c.kind, family: c.family, provider: c.provider, model: c.model,
        modelIdentity: { modelId: c.model, declaredVersion: c.modelVersion, sourceRepository: c.sourceRepo }, modelArtifact: null,
        baseModelId: c.baseModelId, mutationParentId: configuration.mutated ? c.id : c.mutationParentId, configuration, messages: buildMessages(ch, configuration.systemPrompt),
        status: 'UNTESTED', timestamps: { createdAt: now(), startedAt: null, promptSentAt: null, firstTokenAt: null, completedAt: null }, latency: { totalMs: null, firstTokenMs: null, modelLoadMs: null, queueMs: null },
        output: '', reasoning: '', usage: null, finishReason: null, error: null, verification: null };
    });
    busy = true; changed();
    const battle = { schema: 'colosseum.battle/v1', battleId: `browser_${crypto.randomUUID()}`, challengeId: ch.id, challenge: publicChallenge(ch), status: 'UNTESTED', createdAt: now(), startedAt: null, completedAt: null,
      environment: { colosseum: '0.2', runtime: device.backend === 'wasm' ? 'browser / WASM CPU' : 'browser / WebGPU', evidenceScope: 'device-local', trust: 'client-controlled; not independently attested', execution: 'serial; loading excluded from inference latency', userAgent: globalThis.navigator?.userAgent ?? null }, entries };
    await save(battle);
    setTimeout(() => run(battle, ch).catch((err) => {
      battle.status = 'FAILED'; battle.completedAt = now();
      for (const e of battle.entries) if (['UNTESTED', 'LIVE'].includes(e.status)) { e.status = 'FAILED'; e.error = { code: 'engine_error', message: err.message }; e.timestamps.completedAt = battle.completedAt; }
      void save(battle); notify(battle);
      for (const s of subscribers.get(battle.battleId) ?? []) s.resolve(copy(battle));
      subscribers.delete(battle.battleId); busy = false; changed();
    }), 0);
    return copy(battle);
  }
  return {
    async init() { device = await provider.probe(); changed(); },
    load: initializeModel,
    cancel() { closing = busy; controller?.abort(); provider.cancel(); ready.clear(); changed(); },
    health: () => ({ mode: 'browser', ok: true, busy, loading, device, persistent: store.persistent, storageWarning, readyModels: [...ready.keys()], activeBattles: busy && !loading ? 1 : 0 }),
    async api(path, opts = {}) {
      if (path === '/health') return this.health();
      if (path === '/contenders') return { contenders: described() };
      if (path === '/characters') return { characters: characters() };
      if (path === '/challenges') return { challenges: listChallenges().map(publicChallenge), disciplines: DISCIPLINES };
      if (path === '/results') return { ...aggregate(all()), evidenceScope: 'device-local' };
      if (path === '/genealogy') return { nodes: characters().filter((c) => c.status.integrated).map((c) => ({ id: c.id, name: c.presentation.displayName, characterName: c.presentation.characterName, portraitUrl: c.presentation.portraitUrl, family: c.technical.family, kind: c.technical.kind,
        parentId: c.technical.mutationParentId, baseModelId: c.technical.baseModelId, configuration: c.technical.configuration, diffFromParent: c.technical.mutationParentId ? { systemPrompt: { added: c.technical.configuration.systemPrompt } } : null, inheritedTraits: c.presentation.inheritedTraits, label: c.status.label, verificationStatus: c.technical.verificationStatus })) };
      if (path === '/battles' && opts.method === 'POST') return createBattle(JSON.parse(opts.body));
      if (path === '/battles') return { battles: all().map((b) => ({ battleId: b.battleId, title: b.challenge.title, status: b.status, createdAt: b.createdAt, entries: b.entries.map((e) => ({ label: e.label, score: e.verification?.score ?? null })) })) };
      if (path.startsWith('/battles/')) { const b = records.get(path.slice(9)); if (!b) throw fail('Battle not found'); return copy(b); }
      throw fail('Unsupported browser endpoint');
    },
    stream(battleId, update) {
      const b = records.get(battleId);
      if (!b) return Promise.reject(fail('Battle not found'));
      update(copy(b));
      if (!['UNTESTED', 'LIVE'].includes(b.status)) return Promise.resolve(copy(b));
      return new Promise((resolve) => { const list = subscribers.get(battleId) ?? []; list.push({ update, resolve }); subscribers.set(battleId, list); });
    },
  };
}
