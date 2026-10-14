import test from 'node:test';
import assert from 'node:assert/strict';
import { freshStore, req, json, addr, sig } from './helpers.js';
import { handleBackendApi } from '../server/lib/routes.js';

const env = { DIT_DEV_AUTH: '1' };
const call = (store, path) => json(handleBackendApi(req(path), env, { store }));

test('evidence: unknown mint returns 404, never fabricated data', async () => {
  const store = await freshStore();
  const r = await call(store, '/api/evidence/' + addr(1));
  assert.equal(r.status, 404);
});

test('evidence: verified token exposes agent, proposal, linked source observations and sanitized history', async () => {
  const store = await freshStore();
  const [src] = await store.select('research_sources', { limit: 1 });
  const obs = await store.insert('observations', { agent_id: 'GHOST_001', source_id: src.id, external_id: 'e1', title: 'Forgotten forum meme', url: 'https://example.com/a', category: 'archive' });
  const p = await store.insert('token_proposals', { agent_id: 'GHOST_001', name: 'Dial Tone', ticker: 'DIAL', narrative: 'x', evidence_ids: [obs.id] });
  for (const status of ['DRAFT', 'EVALUATED', 'PROPOSED']) await store.update('token_proposals', [['id', 'eq', p.id]], { status });
  await store.insert('verified_tokens', { mint: addr(5), proposal_id: p.id, agent_id: 'GHOST_001', name: 'Dial Tone', ticker: 'DIAL', creator_wallet: addr(6), payer: addr(6), signature: sig(1), slot: 1 });
  const r = await call(store, '/api/evidence/' + addr(5));
  assert.equal(r.status, 200);
  assert.equal(r.body.agent.id, 'GHOST_001');
  assert.equal(r.body.evidence[0].url, 'https://example.com/a');
  assert.deepEqual(r.body.proposal_history.map(h => h.to), ['DRAFT', 'EVALUATED', 'PROPOSED']);
  assert.ok(!JSON.stringify(r.body).includes('system_prompt'));
  assert.match(r.body.note, /does not prove AI authorship/);
});
