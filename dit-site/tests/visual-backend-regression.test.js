// Archived V7 design regression: current homepage intentionally uses the user's MIAMI SIGNAL HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleApi } from '../server/api.js';
import { createStore } from '../server/lib/store-core.js';
import { freshStore, req } from './helpers.js';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
test('hosted Site supports public Supabase URL alias but still requires a private service key', async () => {
 const env = { NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-anon' };
 assert.equal(createStore(env), null);
 const missing = await (await handleApi(req('/api/config'), env)).json();
 assert.deepEqual(missing.backend.missingBindings, ['SUPABASE_SERVICE_ROLE_KEY']);
 assert.equal(missing.backend.configured,false);
 const withSecret = {...env, SUPABASE_SERVICE_ROLE_KEY:'secret-value'};
 const good = await (await handleApi(req('/api/config'), withSecret, {store:await freshStore()})).json();
 assert.equal(good.backend.configured,true);
 assert.equal(good.auth,'supabase');
 assert.deepEqual(good.backend.missingBindings,[]);
 assert.ok(!JSON.stringify(good).includes('secret-value'));
 assert.ok(createStore(withSecret));
});
test('backend diagnostic describes missing bindings by name only and identifies deployed release',async()=>{
 const r=await (await handleApi(req('/api/config'), {})).json();
 assert.deepEqual(r.backend.missingBindings,['SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']);
 assert.equal(r.release,'v7-interactive-2_5d-20261014');
});
test('moving background bars never overlay characters or run during reduced motion',()=>{
 const css=read('../dist/reference-v7.css'), html=read('../dist/legacy-v7.html'), stage=read('../dist/stage.js');
 assert.match(html,/class="world-bars"/);
 assert.doesNotMatch(html,/class="world-noise"/);
 assert.match(css,/\.world-bars.*?z-index: 0/s);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@keyframes bars-breathe/);
 assert.doesNotMatch(stage,/float scan=/);
 assert.doesNotMatch(stage,/float shoulderWidth=/);
 assert.doesNotMatch(stage,/new THREE\.LatheGeometry/);assert.match(stage,/--world-x/);assert.match(stage,/pointermove/);
});

test('three agents use the same 2.5D render loop with restored interaction from original version',()=>{
 const stage=read('../dist/stage.js'),css=read('../dist/reference-v7.css');
 assert.match(stage,/for \(const it of items\)/);
 assert.match(stage,/mx \* \.22/);
 assert.match(stage,/pointer\.x \* \.35/);
 assert.match(stage,/pointer\.y \* \.20/);
 assert.match(stage,/--world-x/);
 assert.match(css,/\.dit-stage-label:before/);
 assert.doesNotMatch(stage,/podiums\[i\]/);
});
