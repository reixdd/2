import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStack, waitForBattle } from './helpers.js';

let s;
test.before(async () => { s = await makeStack({ timeoutMs: 600 }); });
test.after(() => s.close());

const post = (body) => fetch(`${s.base}/api/battles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('health reports provider truth', async () => {
  const h = await (await fetch(`${s.base}/api/health`)).json();
  assert.equal(h.status, 'ok');
  assert.equal(h.providers.fake.reachable, true);
  assert.equal(h.providers.openrouter.configured, false);
});

test('contenders: only confirmed models are operational', async () => {
  const { contenders } = await (await fetch(`${s.base}/api/contenders`)).json();
  const by = Object.fromEntries(contenders.map((c) => [c.id, c]));
  assert.equal(by.good.operational, true);
  assert.equal(by.ghost.operational, false);
  assert.match(by.ghost.reason, /not found/);
  assert.equal(by.or.operational, false);
  assert.match(by.or.reason, /OPENROUTER_API_KEY/);
  assert.equal(by.slot.operational, false);
  assert.equal(by.good.state, 'UNTESTED');
});

test('battle: identical inputs, real timing, verified scores, honest failures', async () => {
  const r = await post({ challengeId: 'math.chain', entrants: [{ contenderId: 'good' }, { contenderId: 'bad' }, { contenderId: 'boom' }, { contenderId: 'slow' }, { contenderId: 'thinker' }] });
  assert.equal(r.status, 202);
  const started = await r.json();
  const b = await waitForBattle(s.base, started.battleId);
  const e = Object.fromEntries(b.entries.map((x) => [x.contenderId, x]));
  assert.equal(e.good.status, 'COMPLETED'); assert.equal(e.good.verification.score, 100); assert.equal(e.good.verification.passed, true);
  assert.ok(e.good.latency.totalMs > 0 && e.good.latency.firstTokenMs > 0);
  assert.equal(e.bad.status, 'COMPLETED'); assert.equal(e.bad.verification.score, 0);
  assert.equal(e.thinker.verification.score, 100, 'thinking blocks must not be judged');
  assert.equal(e.boom.status, 'FAILED'); assert.equal(e.boom.error.code, 'http_500'); assert.equal(e.boom.verification, null);
  assert.equal(e.slow.status, 'FAILED'); assert.equal(e.slow.error.code, 'timeout');
  assert.equal(b.status, 'COMPLETED');
  assert.ok(b.challenge.promptHash);
  assert.equal(s.store.get(b.battleId).status, 'COMPLETED', 'persisted');
});

test('non-operational entrants are rejected, never silently run', async () => {
  const r = await post({ challengeId: 'math.chain', entrants: [{ contenderId: 'good' }, { contenderId: 'ghost' }, { contenderId: 'or' }] });
  assert.equal(r.status, 422);
  const j = await r.json();
  assert.equal(j.error.code, 'entrants_rejected');
  assert.equal(j.error.details.length, 2);
});

test('validation errors', async () => {
  assert.equal((await post({ challengeId: 'nope', entrants: [{ contenderId: 'good' }] })).status, 404);
  assert.equal((await post({ challengeId: 'math.chain', entrants: [] })).status, 400);
  assert.equal((await post({ challengeId: 'math.chain', entrants: [{ contenderId: 'good', overrides: { temperature: 'hot' } }] })).status, 400);
  assert.equal((await post({ challengeId: 'math.chain', entrants: [{ contenderId: 'good' }, { contenderId: 'good' }] })).status, 422);
});

test('mutation lab: same model, modified config, recorded separately', async () => {
  const r = await post({ challengeId: 'math.gcd-lcm', entrants: [{ contenderId: 'good' }, { contenderId: 'good', label: 'good + sabotage', overrides: { systemPrompt: 'MUTATION-MARKER', temperature: 0.7 } }] });
  const b = await waitForBattle(s.base, (await r.json()).battleId);
  const [orig, mut] = b.entries;
  assert.equal(orig.configuration.mutated, false);
  assert.equal(mut.configuration.mutated, true);
  assert.notEqual(orig.configuration.configHash, mut.configuration.configHash);
  assert.equal(orig.verification.score, 100);
  assert.equal(mut.verification.score, 0);
});

test('results: per-discipline, verified runs only, failures counted separately', async () => {
  const res = await (await fetch(`${s.base}/api/results`)).json();
  const math = res.disciplines.math;
  const good = math.find((r) => r.contenderId === 'good' && !r.mutated);
  assert.equal(good.avgScore, 100);
  const boom = math.find((r) => r.contenderId === 'boom');
  assert.equal(boom.completed, 0); assert.equal(boom.failed, 1); assert.equal(boom.rank, null);
  assert.equal(res.disciplines['structured-reasoning'], undefined, 'no fabricated rows for untested disciplines');
});

test('SSE stream delivers progressive deltas then done', async () => {
  const r = await post({ challengeId: 'math.prime-sum', entrants: [{ contenderId: 'good' }] });
  const { battleId } = await r.json();
  const res = await fetch(`${s.base}/api/battles/${battleId}/stream`);
  const text = await res.text();
  assert.match(text, /event: snapshot/);
  assert.ok((text.match(/event: delta/g) || []).length >= 2, 'multiple delta events');
  assert.match(text, /event: done/);
});

test('challenges and archive endpoints', async () => {
  const c = await (await fetch(`${s.base}/api/challenges`)).json();
  assert.ok(c.challenges.length >= 7);
  assert.ok(!JSON.stringify(c).includes('referenceAnswer'));
  const list = await (await fetch(`${s.base}/api/battles`)).json();
  assert.ok(list.battles.length >= 3);
  assert.equal((await fetch(`${s.base}/api/battles/zzz`)).status, 404);
});
