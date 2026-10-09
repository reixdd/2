import fs from 'node:fs';
import path from 'node:path';
import { aggregate } from './results.js';
import { listChallenges } from './challenges/index.js';
import { configHash } from './contenders.js';

/**
 * Character registry. Joins three INDEPENDENT sources:
 *   1. technical metadata  (manifest + live availability + real results)
 *   2. fictional presentation (cast.json)
 *   3. registry ledger (when each contender first joined)
 * The model adapters never import this file. Deleting cast.json must not break evaluation.
 */
export function loadCast(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const cast = read('cast.json');
  const local = path.join(dir, 'cast.local.json');
  if (fs.existsSync(local)) {
    const l = read('cast.local.json');
    cast.families = { ...cast.families, ...(l.families ?? {}) };
    cast.contenders = { ...cast.contenders, ...(l.contenders ?? {}) };
  }
  return cast;
}

export function diffConfig(parent, child) {
  const d = {};
  const ps = parent.systemPrompt || '', cs = child.systemPrompt || '';
  if (ps !== cs) d.systemPrompt = cs.startsWith(ps) ? { added: cs.slice(ps.length).trim() } : { from: ps, to: cs };
  for (const k of ['temperature', 'maxTokens']) if (parent[k] !== child[k]) d[k] = { from: parent[k], to: child[k] };
  return d;
}

export function createCharacterService({ cast, contenders, getBattles, dataDir, artDir }) {
  const ledgerFile = path.join(dataDir, 'registry.json');
  let ledger = {};
  try { ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch { /* first run */ }

  const artExists = (url) => !!url && (!artDir || fs.existsSync(path.join(artDir, path.basename(url))));

  function presentation(c) {
    const fam = cast.families?.[c.family] ?? {};
    const own = cast.contenders?.[c.id] ?? {};
    const p = { ...fam, ...own };
    const artKey = p.artKey ?? null;
    const art = p.originalArtworkUrl ?? (artKey ? `/art/${artKey}.svg` : null);
    const portrait = p.portraitUrl ?? (artKey ? `/art/${artKey}-portrait.svg` : null);
    const cast_ = !!p.characterName && artExists(art);
    return {
      cast: cast_,
      displayName: p.displayName ?? c.name,
      characterName: cast_ ? p.characterName : null,
      archetype: cast_ ? p.archetype ?? null : null,
      originalArtworkUrl: cast_ ? art : null,
      portraitUrl: cast_ && artExists(portrait) ? portrait : null,
      entranceAnimation: p.entranceAnimation ?? 'lotus-rise',
      visualTheme: p.visualTheme ?? null,
      inheritedTraits: own.inheritedTraits ?? [],
      lore: cast_ ? p.lore ?? null : null,
      unofficial: true,
      disclaimer: cast.disclaimer,
    };
  }

  async function build() {
    const list = await contenders.describeAll();
    const byId = new Map(list.map((c) => [c.id, c]));
    const battles = getBattles();
    const res = aggregate(battles);
    const challenges = listChallenges();
    let dirty = false;
    const now = new Date().toISOString();
    for (const c of list) if (!ledger[c.id]) { ledger[c.id] = { firstSeenAt: now }; dirty = true; }
    if (dirty) { try { fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2)); } catch { /* read-only fs: ephemeral */ } }

    return list.map((c) => {
      const hash = configHash(c.config);
      const rows = Object.values(res.disciplines).flat().filter((r) => r.contenderId === c.id && r.configHash === hash);
      const evaluation = rows.reduce((a, r) => ({ attempts: a.attempts + r.attempts, completed: a.completed + r.completed, failed: a.failed + r.failed }), { attempts: 0, completed: 0, failed: 0 });
      const byCh = {};
      for (const r of rows) for (const [k, v] of Object.entries(r.byChallenge)) byCh[k] = v;
      const testedCapabilities = challenges.map((ch) => ({
        challengeId: ch.id, title: ch.title, discipline: ch.discipline,
        avgScore: byCh[ch.id]?.avgScore ?? null, runs: byCh[ch.id]?.runs ?? 0,
      }));
      const covered = testedCapabilities.filter((t) => t.runs > 0).length;
      const verificationStatus = evaluation.completed === 0 ? 'UNVERIFIED' : covered < challenges.length ? 'PARTIAL' : 'EVALUATED';
      const availability = !c.integrated ? 'RESERVED' : c.operational ? 'ONLINE' : 'OFFLINE';
      return {
        id: c.id,
        joinedAt: ledger[c.id].firstSeenAt,
        technical: {
          modelId: c.model, modelVersion: c.modelVersion, family: c.family, kind: c.kind, provider: c.provider,
          sourceRepository: c.sourceRepo, openWeights: c.openWeights,
          baseModelId: c.baseModelId, mutationParentId: c.mutationParentId,
          configuration: c.config, configHash: hash,
          catalogConfirmed: c.availability === 'confirmed',
          verificationStatus, evaluation, testedCapabilities,
        },
        presentation: presentation(c),
        status: { availability, state: c.state, operational: c.operational, reason: c.reason, integrated: c.integrated,
          // single label the UI shows: never implies readiness unless the provider+model were confirmed
          label: availability === 'ONLINE' ? c.state : availability },
      };
    });
  }

  return {
    build,
    async get(id) { return (await build()).find((c) => c.id === id) ?? null; },
    async genealogy() {
      const chars = await build();
      const byId = new Map(chars.map((c) => [c.id, c]));
      return chars.filter((c) => c.status.integrated).map((c) => {
        const parent = c.technical.mutationParentId ? byId.get(c.technical.mutationParentId) : null;
        return {
          id: c.id, name: c.presentation.displayName, characterName: c.presentation.characterName, portraitUrl: c.presentation.portraitUrl,
          family: c.technical.family, kind: c.technical.kind, parentId: parent?.id ?? null, baseModelId: c.technical.baseModelId,
          configuration: c.technical.configuration, diffFromParent: parent ? diffConfig(parent.technical.configuration, c.technical.configuration) : null,
          inheritedTraits: c.presentation.inheritedTraits, label: c.status.label, verificationStatus: c.technical.verificationStatus,
        };
      });
    },
  };
}
