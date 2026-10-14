import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleApi } from '../server/api.js';
import { verifySupabaseUser } from '../server/lib/auth.js';
import { freshStore, req } from './helpers.js';

test('hosted configuration reports the genuine missing-backend status without inventing records', async () => {
  const config = await handleApi(req('/api/config'), { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon' });
  assert.equal(config.status, 200);
  const body = await config.json();
  assert.equal(body.backend.configured, false);
  assert.equal(body.auth, 'none');
  assert.equal(body.simulationOnly, true);
  const dossiers = await handleApi(req('/api/agents/GHOST_001'), {});
  assert.equal(dossiers.status, 503);
  assert.equal((await dossiers.json()).error, 'backend_not_configured');
});

test('hosted NEXT_PUBLIC_SUPABASE_ANON_KEY is accepted for auth without a duplicate env variable', async () => {
  const env = { SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon' };
  const store = await freshStore();
  const config = await (await handleApi(req('/api/config'), env, { store })).json();
  assert.equal(config.backend.configured, true);
  assert.equal(config.auth, 'supabase');
  assert.equal(config.supabase.anonKey, 'public-anon');
  let authHeader;
  const user = await verifySupabaseUser(env, 'test-token', async (_url, options) => {
    authHeader = options.headers.apikey;
    return Response.json({ id: 'test-user', email: 'confirmed@example.com', email_confirmed_at: '2026-10-01' });
  });
  assert.equal(user.id, 'test-user');
  assert.equal(authHeader, 'public-anon');
});

test('failed live dossier keeps artwork and explicitly shows no fake memories or votes', () => {
  const js = readFileSync(new URL('../dist/command.js', import.meta.url), 'utf8');
  assert.match(js, /dossier-layout-offline/);
  assert.match(js, /Memories, votes and activity are unavailable/);
  assert.match(js, /RETRY DATA CONNECTION/);
});
