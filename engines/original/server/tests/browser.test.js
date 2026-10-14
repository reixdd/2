import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createBrowserArena } from '../../client/src/browser/arena.js';
import { getChallenge, listChallenges } from '../../shared/challenges/index.js';
import { configHash, hashText } from '../../shared/hash.js';

const catalog = ['one', 'two'].map((id) => ({ id, model: id, family: 'Fixture', name: id, provider: 'webllm', kind: 'model', integrated: true, baseModelId: id, mutationParentId: null, config: { systemPrompt: '', temperature: 0, maxTokens: 100 } }));
async function stack(options = {}) {
  const saved = [], inputs = [], cancelled = [];
  // Explicit TEST fixture, never imported into production runtime.
  const provider = {
    async probe() { return { supported: true }; },
    async load(model, progress) { progress({ progress: .5, text: 'TEST fixture initialization' }); return { backend: 'TEST ONLY', model }; },
    cancel() { cancelled.push(true); },
    async *stream(req) { inputs.push(req); yield { type: 'delta', text: `FINAL: ${req.model === 'one' ? 244 : 0}` }; yield { type: 'finish', reason: 'stop' }; },
    ...options.provider,
  };
  const arena = createBrowserArena({ provider, store: { records: options.records ?? [], persistent: true, warning: null, async save(b) { if (options.storageError) throw new Error('Quota exceeded'); saved.push(b); } }, catalog, cast: {}, inferenceTimeoutMs: options.timeout ?? 1000, loadTimeoutMs: options.timeout ?? 1000 });
  await arena.init();
  return { arena, saved, inputs, cancelled };
}
async function run(arena, entrants = [{ contenderId: 'one' }, { contenderId: 'two' }]) {
  const b = await arena.api('/battles', { method: 'POST', body: JSON.stringify({ challengeId: 'math.warmup', entrants }) });
  const states = [];
  const result = await arena.stream(b.battleId, (b) => states.push(b));
  return { result, states };
}

test('browser hash matches server SHA-256 and challenge identities', () => {
  const cfg = catalog[0].config;
  assert.equal(configHash(cfg), crypto.createHash('sha256').update(JSON.stringify({ s: '', t: 0, m: 100 })).digest('hex').slice(0, 8));
  for (const ch of listChallenges()) assert.equal(hashText(`${ch.system}\n---\n${ch.user}`).slice(0, 16), ch.promptHash);
});
test('browser weights are offline until initialization succeeds', async () => {
  const { arena } = await stack();
  assert.ok((await arena.api('/contenders')).contenders.every((c) => !c.operational));
  await assert.rejects(run(arena), /Load and validate/);
  await arena.load('one');
  assert.equal((await arena.api('/contenders')).contenders[0].operational, true);
  assert.equal((await arena.api('/contenders')).contenders[1].operational, false);
});
test('browser executes identical inputs serially, captures real fixture states and separate evidence', async () => {
  const { arena, inputs, saved } = await stack();
  await arena.load('one'); await arena.load('two');
  const { result, states } = await run(arena);
  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(inputs[0].messages, inputs[1].messages);
  assert.equal(result.entries[0].verification.score, 100);
  assert.equal(result.entries[1].verification.score, 0);
  assert.ok(states.some((b) => b.entries[0].status === 'LIVE' && b.entries[1].status === 'UNTESTED'));
  assert.ok(result.entries.every((e) => e.timestamps.promptSentAt && e.latency.totalMs !== null && e.latency.modelLoadMs !== null));
  assert.equal(result.environment.evidenceScope, 'device-local');
  assert.equal(saved.at(-1).status, 'COMPLETED');
});
test('browser partial streams and oversize output cannot acquire scores', async () => {
  for (const stream of [async function* () { yield { type: 'delta', text: 'FINAL: 244' }; }, async function* () { yield { type: 'delta', text: 'x'.repeat(200001) }; }]) {
    const { arena } = await stack({ provider: { stream } }); await arena.load('one');
    const { result } = await run(arena, [{ contenderId: 'one' }]);
    assert.equal(result.status, 'FAILED'); assert.equal(result.entries[0].verification, null);
  }
});
test('browser hung inference times out and releases the arena', async () => {
  const { arena, cancelled } = await stack({ timeout: 20, provider: { async *stream() { await new Promise(() => {}); } } });
  await arena.load('one');
  const { result } = await run(arena, [{ contenderId: 'one' }]);
  assert.equal(result.entries[0].error.code, 'timeout');
  assert.equal(arena.health().busy, false);
  assert.equal(cancelled.length, 1);
});
test('browser rejects concurrent battles and validates mutation configs', async () => {
  const { arena } = await stack(); await arena.load('one');
  await assert.rejects(run(arena, [{ contenderId: 'one', overrides: { systemPrompt: 123 } }]), /System prompt/);
  const first = await arena.api('/battles', { method: 'POST', body: JSON.stringify({ challengeId: 'math.warmup', entrants: [{ contenderId: 'one', overrides: { systemPrompt: 'Check twice' } }] }) });
  await assert.rejects(run(arena), /already running/);
  const result = await arena.stream(first.battleId, () => {});
  assert.equal(result.entries[0].configuration.mutated, true);
  assert.equal((await arena.api('/contenders')).contenders[0].state, 'UNTESTED');
});
test('browser interrupted records fail on reload and storage errors are visible', async () => {
  const { arena } = await stack(); await arena.load('one');
  const { result } = await run(arena, [{ contenderId: 'one' }]);
  result.status = result.entries[0].status = 'LIVE';
  const restarted = await stack({ records: [result], storageError: true });
  const recovered = await restarted.arena.api(`/battles/${result.battleId}`);
  assert.equal(recovered.entries[0].error.code, 'interrupted');
  assert.equal(recovered.status, 'FAILED');
  assert.equal(recovered.entries[0].verification, null);
  assert.match(restarted.arena.health().storageWarning, /Quota exceeded/);
});
test('adapted research checks indices and balance deltas, without code or transfer claims', () => {
  const task = getChallenge('reason.subsequence');
  assert.equal(task.verify('FINAL: {"sum":33,"indices":[0,3,4]}').passed, false);
  assert.equal(task.verify('FINAL: {"sum":33,"indices":[0,1,3,4]}').passed, true);
  const balances = getChallenge('reason.balances');
  assert.ok(balances.user.includes('No instruction data'));
  assert.equal(balances.verify('FINAL: {"fee_payer_lamport_change":-1005000,"spl_token_transferred":100}').passed, false);
  assert.equal(getChallenge('reason.signaling').user.includes('is_separating_equilibrium":false'), false);
});

test('browser converts worker string rejections into visible error messages', async () => {
  const { arena } = await stack({ provider: { async load() { throw 'TEST: model download rejected'; } } });
  await assert.rejects(arena.load('one'), /model download rejected/);
  assert.equal(arena.health().busy, false);
  assert.equal((await arena.api('/contenders')).contenders[0].operational, false);
});
