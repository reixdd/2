import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = p => fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../dist/index.html');const css=read('../dist/experience.css');const stage=read('../dist/stage.js');const sound=read('../dist/sound.js');const scheduler=read('../worker/scheduler.js');
test('V4 uses an open character stage rather than a boxed crypto dashboard',()=>{
 assert.match(html,/id="dit-stage"/);assert.match(html,/id="dit-sound-toggle"/);assert.match(html,/experience.css/);
 assert.match(css,/\.control-deck\{[^}]*border:0!important/);
 assert.match(css,/\.command-grid\{[^}]*flex-direction:column/);
 assert.match(css,/\.dit-stage-labels\{[^}]*grid-template-columns:repeat\(3/);
 assert.match(stage,/alpha: true/);assert.doesNotMatch(stage,/const ceil =/);
});
test('V4 has opt-in accessible synthesized audio and reduced-motion handling',()=>{
 assert.match(sound,/fxEnabled = false/);assert.match(sound,/musicEnabled = false/);assert.match(sound,/AudioContext/);
 assert.match(sound,/aria-pressed/);assert.match(css,/prefers-reduced-motion:reduce/);
});
test('V4 scheduler guards a dedupe key in every terminal state',()=>{
 assert.match(scheduler,/filters: \[\['dedupe_key', 'eq', job.dedupe_key\]\]/);
 assert.match(read('../supabase/migrations/0003_job_dedupe_repair.sql'),/agent_jobs_all_status_dedupe_idx/);
});
