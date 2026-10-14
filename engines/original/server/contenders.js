import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function configHash(cfg) {
  const canon = JSON.stringify({ s: cfg.systemPrompt || '', t: cfg.temperature, m: cfg.maxTokens });
  return crypto.createHash('sha256').update(canon).digest('hex').slice(0, 8);
}

export function loadManifest(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).contenders ?? [];
  const base = read('contenders.json');
  const localFile = path.join(dir, 'contenders.local.json');
  if (!fs.existsSync(localFile)) return base;
  const byId = new Map(base.map((c) => [c.id, c]));
  for (const c of read('contenders.local.json')) byId.set(c.id, { integrated: true, ...c });
  return [...byId.values()];
}

/** Technical inheritance is independent of artwork. Invalid lineages cannot compete. */
export function resolveInheritance(manifest) {
  const byId = new Map(manifest.map((c) => [c.id, c]));
  const cache = new Map();
  function resolve(id, trail = new Set()) {
    if (cache.has(id)) return cache.get(id);
    if (trail.has(id)) throw new Error(`Circular contender lineage at ${id}`);
    const c = byId.get(id);
    if (!c) throw new Error(`Missing contender ${id}`);
    const next = new Set([...trail, id]);
    let out = { ...c, baseModelId: null, mutationParentId: null };
    if (c.kind === 'agent' && c.base) {
      const base = resolve(c.base, next);
      const parentId = c.parent ?? c.base;
      const parent = resolve(parentId, next);
      const rootId = base.baseModelId ?? base.id;
      if ((parent.baseModelId ?? parent.id) !== rootId) throw new Error(`Parent ${parentId} uses a different base model`);
      const own = c.config ?? {}, inherited = parent.config ?? {};
      const systemPrompt = own.extendsParent
        ? [inherited.systemPrompt, own.systemPrompt].filter(Boolean).join('\n\n')
        : own.systemPrompt ?? inherited.systemPrompt ?? '';
      out = { ...c, provider: base.provider, model: base.model,
        integrated: c.integrated !== false && base.integrated !== false && parent.integrated !== false,
        modelVersion: c.modelVersion ?? base.modelVersion, sourceRepo: c.sourceRepo ?? base.sourceRepo,
        openWeights: c.openWeights ?? base.openWeights,
        baseModelId: rootId, mutationParentId: parentId,
        config: { systemPrompt, temperature: own.temperature ?? inherited.temperature, maxTokens: own.maxTokens ?? inherited.maxTokens } };
    }
    cache.set(id, out);
    return out;
  }
  return manifest.map((c) => {
    try { return resolve(c.id); }
    catch (err) { return { ...c, integrated: false, provider: null, model: null, note: err.message, baseModelId: null, mutationParentId: null }; }
  });
}

export function createContenderService({ manifest, providers, config, getBattles }) {
  const resolved = resolveInheritance(manifest);

  async function availability(c) {
    if (c.integrated === false || !c.provider || !c.model) return { operational: false, reason: c.note || 'Reserved slot — no adapter integrated yet' };
    const p = providers[c.provider];
    if (!p) return { operational: false, reason: `No adapter registered for provider "${c.provider}"` };
    if (!p.isConfigured()) return { operational: false, reason: p.notConfiguredReason };
    const cat = await p.listModels();
    if (!cat.ok) return { operational: false, reason: `${p.label} unreachable (${cat.error})` };
    if (!p.hasModel(cat.models, c.model)) {
      return { operational: false, reason: p.catalog === 'ollama' ? `Model not pulled — run: ollama pull ${c.model}` : `Model "${c.model}" not found in ${p.label} catalog` };
    }
    return { operational: true, reason: null, availability: 'confirmed' };
  }

  function stateFor(id, configurationHash) {
    let live = 0, completed = 0, failed = 0, lastFinished = null;
    for (const b of getBattles()) {
      for (const e of b.entries) {
        if (e.contenderId !== id || e.configuration.configHash !== configurationHash) continue;
        if (e.status === 'LIVE') live++;
        else if (e.status === 'COMPLETED') { completed++; if (!lastFinished || e.timestamps.completedAt > lastFinished.at) lastFinished = { at: e.timestamps.completedAt, status: 'COMPLETED' }; }
        else if (e.status === 'FAILED') { failed++; const at = e.timestamps.completedAt || e.timestamps.createdAt; if (!lastFinished || at > lastFinished.at) lastFinished = { at, status: 'FAILED' }; }
      }
    }
    const state = live ? 'LIVE' : !lastFinished ? 'UNTESTED' : lastFinished.status;
    return { state, runs: { live, completed, failed } };
  }

  return {
    async describeAll() {
      return Promise.all(resolved.map(async (c) => ({
        id: c.id, name: c.name, family: c.family, kind: c.kind, provider: c.provider, model: c.model, base: c.base ?? null,
        modelId: c.model, modelVersion: c.modelVersion ?? null, sourceRepo: c.sourceRepo ?? null, openWeights: c.openWeights ?? null,
        baseModelId: c.baseModelId ?? null, mutationParentId: c.mutationParentId ?? null,
        description: c.description ?? null,
        config: { systemPrompt: c.config?.systemPrompt ?? '', temperature: c.config?.temperature ?? config.defaultTemperature, maxTokens: c.config?.maxTokens ?? config.defaultMaxTokens },
        integrated: c.integrated !== false,
        ...(await availability(c)),
        ...stateFor(c.id, configHash({ systemPrompt: c.config?.systemPrompt ?? '', temperature: c.config?.temperature ?? config.defaultTemperature, maxTokens: c.config?.maxTokens ?? config.defaultMaxTokens })),
      })));
    },
  };
}
