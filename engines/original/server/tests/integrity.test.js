import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEngine } from '../engine.js';
import { createContenderService, resolveInheritance } from '../contenders.js';
import { createStore } from '../store.js';
import { createLocalProvider } from '../providers/local.js';
import { getConfig } from '../config.js';
import { getChallenge } from '../challenges/index.js';

function stack(provider, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'colosseum-integrity-'));
  const config = { ...getConfig({}), dataDir: dir, ...overrides };
  const store = createStore(dir);
  const contenders = { async describeAll() { await new Promise((r) => setTimeout(r, 30)); return [{ id: 'test', name: 'Test fixture',
    kind: 'model', provider: 'test', model: 'fixture', operational: true, config: { systemPrompt: '', temperature: 0, maxTokens: 100 } }]; } };
  const engine = createEngine({ config, providers: { test: provider }, contenders, store });
  return { engine, store, dir };
}
const request = { challengeId: 'math.chain', entrants: [{ contenderId: 'test' }] };
async function completed(s, id) {
  while (s.store.get(id).status === 'LIVE') await new Promise((r) => setTimeout(r, 5));
  return s.store.get(id);
}

test('an interrupted stream cannot turn a partial correct answer into a completed score', async () => {
  const s = stack({ async *stream() { yield { type: 'delta', text: 'FINAL: ' + getChallenge('math.chain').referenceAnswer }; } });
  const b = await completed(s, (await s.engine.createBattle(request)).battleId);
  assert.equal(b.entries[0].status, 'FAILED');
  assert.equal(b.entries[0].error.code, 'incomplete_stream');
  assert.equal(b.entries[0].verification, null);
});

test('output limit is enforced before retaining an oversized chunk', async () => {
  const s = stack({ async *stream() { yield { type: 'delta', text: 'x'.repeat(200001) }; yield { type: 'finish', reason: 'stop' }; } });
  const b = await completed(s, (await s.engine.createBattle(request)).battleId);
  assert.equal(b.entries[0].error.code, 'output_limit');
  assert.equal(b.entries[0].output, '');
  assert.equal(b.entries[0].verification, null);
});

test('parallel submissions reserve capacity before asynchronous availability checks', async () => {
  const s = stack({ async *stream() { yield { type: 'delta', text: 'FINAL: 0' }; yield { type: 'finish', reason: 'stop' }; } }, { maxConcurrentBattles: 1 });
  const [first, second] = await Promise.allSettled([s.engine.createBattle(request), s.engine.createBattle(request)]);
  assert.equal(first.status, 'fulfilled');
  assert.equal(second.status, 'rejected');
  assert.equal(second.reason.status, 429);
  await completed(s, first.value.battleId);
});

test('queued and live records become interrupted failures after a restart', () => {
  const s = stack({});
  const at = new Date().toISOString();
  s.store.save({ battleId: 'queued', createdAt: at, status: 'UNTESTED', entries: [{ status: 'UNTESTED', timestamps: { createdAt: at } }] });
  const restored = createStore(s.dir).get('queued');
  assert.equal(restored.status, 'FAILED');
  assert.equal(restored.entries[0].error.code, 'interrupted');
});

test('circular or missing lineage never creates an operational agent', () => {
  const invalid = resolveInheritance([{ id: 'a', kind: 'agent', base: 'b' }, { id: 'b', kind: 'agent', base: 'a' }, { id: 'c', kind: 'agent', base: 'missing' }]);
  assert.ok(invalid.every((c) => c.integrated === false && c.model === null));
});

test('a legacy trust flag cannot bypass a failed model catalog check', async () => {
  const service = createContenderService({ manifest: [{ id: 'c', kind: 'model', provider: 'p', model: 'unknown', integrated: true }],
    providers: { p: { isConfigured: () => true, label: 'Test', listModels: async () => ({ ok: false, error: 'offline' }) } },
    config: { ...getConfig({}), skipAvailabilityCheck: true }, getBattles: () => [] });
  assert.equal((await service.describeAll())[0].operational, false);
});

test('local provider with no installed weights is offline and supplies no invented model IDs', async () => {
  const provider = createLocalProvider({ localModelDir: fs.mkdtempSync(path.join(os.tmpdir(), 'colosseum-empty-')) });
  assert.equal(provider.isConfigured(), false);
  const catalog = await provider.listModels();
  assert.equal(catalog.ok, false);
  assert.equal(catalog.models.size, 0);
});
