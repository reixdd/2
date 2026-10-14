import test from 'node:test'; import assert from 'node:assert/strict';
import { freshStore, clockAt, USER, req, json } from './helpers.js';
import { castVote, voteTotals, currentVote } from '../server/lib/votes.js';
import { handleApi } from '../server/api.js';

const counts = async s => Object.fromEntries((await s.select('agent_vote_counts')).map(r => [r.agent_id, r.votes]));

test('one current vote per person; totals and percentages are exact', async () => {
  const s = await freshStore();
  await castVote(s, USER(1), 'GHOST_001'); await castVote(s, USER(2), 'GHOST_001'); await castVote(s, USER(3), 'ECHO.exe');
  const t = await voteTotals(s); assert.equal(t.total, 3);
  assert.deepEqual(t.leaderboard.map(r => [r.agent_id, r.votes, r.percent, r.rank]), [['GHOST_001', 2, 66.7, 1], ['ECHO.exe', 1, 33.3, 2], ['NULL_ENTITY', 0, 0, 3]]);
  const again = await castVote(s, USER(1), 'GHOST_001'); assert.equal(again.changed, false); assert.equal((await voteTotals(s)).total, 3);
});
test('50 concurrent submissions by one person leave exactly one vote', async () => {
  const s = await freshStore(); const ids = ['GHOST_001', 'NULL_ENTITY', 'ECHO.exe'];
  const res = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => castVote(s, USER(7), ids[i % 3])));
  assert.equal((await s.select('agent_votes')).length, 1);
  const c = await counts(s); assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 1); assert.ok(Object.values(c).every(v => v >= 0));
  assert.ok(res.some(r => r.status === 'rejected') && res.some(r => r.status === 'fulfilled'));   // the hourly switch cap kicked in
});
test('switching moves one count atomically and never goes negative', async () => {
  const s = await freshStore(); await castVote(s, USER(1), 'GHOST_001'); const r = await castVote(s, USER(1), 'NULL_ENTITY');
  assert.deepEqual([r.previous_agent_id, r.agent_id, r.changed], ['GHOST_001', 'NULL_ENTITY', true]);
  assert.deepEqual(await counts(s), { GHOST_001: 0, NULL_ENTITY: 1, 'ECHO.exe': 0 }); assert.equal((await currentVote(s, USER(1))).agent_id, 'NULL_ENTITY');
});
test('vote switching is rate limited per hour, then recovers', async () => {
  const clock = clockAt(); const s = await freshStore(clock); const a = ['GHOST_001', 'NULL_ENTITY'];
  await castVote(s, USER(1), a[0]); for (let i = 1; i <= 4; i++) await castVote(s, USER(1), a[i % 2]);     // 1 initial + 4 switches = 5 recorded changes
  await assert.rejects(() => castVote(s, USER(1), 'ECHO.exe'), e => e.status === 429);
  clock.advance(3600_001); assert.equal((await castVote(s, USER(1), 'ECHO.exe')).changed, true);
});
test('unknown agents are rejected before touching the database', async () => {
  const s = await freshStore(); await assert.rejects(() => castVote(s, USER(1), 'HACKER'), /Unknown agent/); assert.equal((await s.select('agent_votes')).length, 0);
});

const devEnv = { DIT_DEV_AUTH: '1' };
test('API: voting needs a verified identity; totals come from the server', async () => {
  const s = await freshStore(); const call = (p, o) => json(handleApi(req(p, o), devEnv, { store: s }).then(r => r));
  assert.equal((await call('/api/vote', { method: 'POST', body: '{"agent_id":"GHOST_001"}' })).status, 401);
  assert.equal((await call('/api/vote', { method: 'POST', headers: { authorization: 'Bearer nope' }, body: '{"agent_id":"GHOST_001"}' })).status, 401);
  const ok = await call('/api/vote', { method: 'POST', headers: { authorization: 'Bearer dev:a@example.com' }, body: '{"agent_id":"ECHO.exe"}' });
  assert.equal(ok.status, 200); assert.equal(ok.body.votes.total, 1);
  assert.equal((await call('/api/vote', { method: 'POST', headers: { authorization: 'Bearer dev:a@example.com' }, body: 'not json' })).status, 400);
  assert.equal((await call('/api/me/vote', { headers: { authorization: 'Bearer dev:a@example.com' } })).body.vote.agent_id, 'ECHO.exe');
  assert.equal((await call('/api/votes')).body.leaderboard[0].agent_id, 'ECHO.exe');
});
test('API: dev auth cannot be switched on when Supabase auth is configured', async () => {
  const s = await freshStore(); const r = await handleApi(req('/api/vote', { method: 'POST', headers: { authorization: 'Bearer dev:a@example.com' }, body: '{"agent_id":"ECHO.exe"}' }), { DIT_DEV_AUTH: '1', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' }, { store: s, fetchImpl: async () => new Response('{}', { status: 401 }) });
  assert.equal(r.status, 401); assert.equal((await s.select('agent_votes')).length, 0);
});
test('API: anonymous and unconfirmed Supabase users cannot vote', async () => {
  const s = await freshStore(); const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
  const vote = user => handleApi(req('/api/vote', { method: 'POST', headers: { authorization: 'Bearer tok' }, body: '{"agent_id":"ECHO.exe"}' }), env, { store: s, fetchImpl: async () => Response.json(user) });
  assert.equal((await vote({ id: USER(1), is_anonymous: true })).status, 403);
  assert.equal((await vote({ id: USER(2), email: 'a@b.c' })).status, 403);
  assert.equal((await vote({ id: USER(3), email: 'a@b.c', email_confirmed_at: '2026-01-01' })).status, 200);
  assert.equal((await s.select('agent_votes')).length, 1);
});
test('API: public agent payload never includes system prompts or other secrets', async () => {
  const s = await freshStore(); const { body } = await json(handleApi(req('/api/agents'), {}, { store: s }));
  assert.equal(body.agents.length, 3); assert.ok(body.agents.every(a => a.profile.prompt_sha256.length === 64));
  assert.doesNotMatch(JSON.stringify(body), /systemPrompt|You are GHOST_001|service_role|api[_-]?key/i);
});
test('API: backend reports honestly when no database is connected', async () => {
  const r = await handleApi(req('/api/agents'), {}); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'backend_not_configured');
  const cfg = await (await handleApi(req('/api/config'), {})).json(); assert.equal(cfg.backend.configured, false); assert.equal(cfg.simulationOnly, true);
});
