import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeStack, waitForBattle } from './helpers.js';
import { loadCast, diffConfig } from '../characters.js';
import { loadManifest, createContenderService } from '../contenders.js';
import { getConfig } from '../config.js';
import { listChallenges } from '../challenges/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let s;
test.before(async () => { s = await makeStack({ timeoutMs: 600 }); });
test.after(() => s.close());
const get = async (p) => (await fetch(`${s.base}${p}`)).json();
const post = (body) => fetch(`${s.base}/api/battles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('registry keeps technical truth separate from fictional presentation', async () => {
  const { characters } = await get('/api/characters');
  const good = characters.find((c) => c.id === 'good');
  assert.ok(good.technical && good.presentation && good.status);
  assert.equal(good.presentation.characterName, 'Test Hero');
  assert.equal(good.presentation.unofficial, true);
  assert.equal(good.technical.modelId, 'good');
  // presentation never contains technical verdict fields and vice versa
  assert.equal(good.presentation.operational, undefined);
  assert.equal(good.technical.characterName, undefined);
});

test('a character can exist offline and says so; reserved slots say so; none claim readiness', async () => {
  const { characters } = await get('/api/characters');
  const by = Object.fromEntries(characters.map((c) => [c.id, c]));
  assert.equal(by.ghost.status.availability, 'OFFLINE');
  assert.equal(by.ghost.status.label, 'OFFLINE');
  assert.equal(by.slot.status.label, 'RESERVED');
  assert.equal(by.or.status.label, 'OFFLINE');
  assert.equal(by.good.status.label, 'UNTESTED');
  for (const c of characters) {
    assert.equal(c.technical.verificationStatus, 'UNVERIFIED');
    assert.ok(c.technical.testedCapabilities.every((t) => t.avgScore === null && t.runs === 0), 'no fabricated capability values');
  }
});

test('capabilities appear only after genuine completed evaluations, and only for the matching configuration', async () => {
  const r = await post({ challengeId: 'math.chain', entrants: [{ contenderId: 'good' }, { contenderId: 'good', label: 'mut', overrides: { systemPrompt: 'MUTATION-MARKER' } }, { contenderId: 'bad' }] });
  await waitForBattle(s.base, (await r.json()).battleId);
  const good = await get('/api/characters/good');
  const cap = good.technical.testedCapabilities.find((t) => t.challengeId === 'math.chain');
  assert.equal(cap.avgScore, 100, 'mutated run (score 0) must not pollute the base character');
  assert.equal(cap.runs, 1);
  assert.equal(good.technical.verificationStatus, 'PARTIAL');
  assert.equal(good.status.label, 'COMPLETED');
  const bad = await get('/api/characters/bad');
  assert.equal(bad.technical.testedCapabilities.find((t) => t.challengeId === 'math.chain').avgScore, 0);
  const untouched = good.technical.testedCapabilities.filter((t) => t.challengeId !== 'math.chain');
  assert.ok(untouched.every((t) => t.avgScore === null));
});

test('failed runs never become capability scores', async () => {
  const r = await post({ challengeId: 'math.gcd-lcm', entrants: [{ contenderId: 'boom' }] });
  await waitForBattle(s.base, (await r.json()).battleId);
  const boom = await get('/api/characters/boom');
  assert.equal(boom.technical.verificationStatus, 'UNVERIFIED');
  assert.equal(boom.technical.evaluation.failed, 1);
  assert.equal(boom.status.label, 'FAILED');
});

test('a runtime mutation does not mark its untested base configuration completed', async () => {
  const r = await post({ challengeId: 'math.chain', entrants: [{ contenderId: 'ghost', overrides: { systemPrompt: 'MUTATION-MARKER' } }] });
  assert.equal(r.status, 422, 'offline models remain rejected even with overrides');
  const before = await get('/api/characters/thinker');
  assert.equal(before.status.state, 'UNTESTED');
  const battle = await post({ challengeId: 'math.chain', entrants: [{ contenderId: 'thinker', overrides: { systemPrompt: 'MUTATION-MARKER' } }] });
  await waitForBattle(s.base, (await battle.json()).battleId);
  const after = await get('/api/characters/thinker');
  assert.equal(after.status.state, 'UNTESTED');
  assert.equal(after.technical.evaluation.completed, 0);
  assert.equal(after.technical.verificationStatus, 'UNVERIFIED');
});

test('genealogy exposes parent links and configuration differences', async () => {
  const { nodes } = await get('/api/genealogy');
  const child = nodes.find((n) => n.id === 'thinker');
  assert.equal(child.parentId, 'good');
  assert.deepEqual(child.diffFromParent.systemPrompt, { added: 'be careful' });
  assert.deepEqual(child.inheritedTraits, ['palette']);
  assert.equal(nodes.find((n) => n.id === 'good').diffFromParent, null);
});

test('registry ledger records first arrival and survives restarts', async () => {
  const { characters } = await get('/api/characters');
  assert.ok(characters.every((c) => !Number.isNaN(Date.parse(c.joinedAt))));
  assert.ok(fs.existsSync(path.join(s.dataDir, 'registry.json')));
});

test('shipped cast + manifest are consistent (real files)', async () => {
  const root = path.resolve(here, '../..');
  const manifest = loadManifest(path.join(root, 'server', 'manifest'));
  const cast = loadCast(path.join(root, 'server', 'characters'));
  const ids = new Set(manifest.map((c) => c.id));
  for (const id of Object.keys(cast.contenders)) assert.ok(ids.has(id), `cast references unknown contender ${id}`);
  for (const f of ['Qwen', 'DeepSeek', 'Llama', 'Gemma', 'Grok']) assert.ok(cast.families[f]?.characterName, f);
  const keys = new Set([...Object.values(cast.families), ...Object.values(cast.contenders)].map((p) => p.artKey).filter(Boolean));
  for (const k of keys) for (const suffix of ['', '-portrait']) assert.ok(fs.existsSync(path.join(root, 'client/public/art', `${k}${suffix}.svg`)), `missing art ${k}${suffix}`);
  // technical metadata is never declared inside the fiction file
  for (const p of [...Object.values(cast.families), ...Object.values(cast.contenders)]) for (const k of ['modelId', 'provider', 'score', 'operational', 'verificationStatus']) assert.equal(p[k], undefined, k);
});

test('Qwen lineage resolves: base → research → quant with inherited config', () => {
  const root = path.resolve(here, '../..');
  const cfg = getConfig({});
  const svc = createContenderService({ manifest: loadManifest(path.join(root, 'server', 'manifest')), providers: {}, config: { ...cfg, skipAvailabilityCheck: true }, getBattles: () => [] });
  return svc.describeAll().then((list) => {
    const by = Object.fromEntries(list.map((c) => [c.id, c]));
    assert.equal(by['agent-qwen-research'].mutationParentId, 'ol-qwen3-8b');
    assert.equal(by['agent-qwen-quant'].mutationParentId, 'agent-qwen-research');
    assert.equal(by['agent-qwen-quant'].baseModelId, 'ol-qwen3-8b');
    assert.equal(by['agent-qwen-quant'].model, 'qwen3:8b');
    assert.ok(by['agent-qwen-quant'].config.systemPrompt.startsWith(by['agent-qwen-research'].config.systemPrompt));
    assert.deepEqual(Object.keys(diffConfig(by['agent-qwen-research'].config, by['agent-qwen-quant'].config)), ['systemPrompt']);
    assert.ok(listChallenges().length >= 7);
  });
});
