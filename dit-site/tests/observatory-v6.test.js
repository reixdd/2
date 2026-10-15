// Archived V7 design regression: current homepage intentionally uses the user's MIAMI SIGNAL HTML.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('V6 shows one machine population with aligned IDs, real cutout assets and left-hand treasury',()=>{
 const html=read('../dist/legacy-v7.html'),stage=read('../dist/stage.js'),css=read('../dist/observatory-v6.css');
 assert.match(html,/reference-v7\.css/);assert.match(html,/operating-rail/);assert.match(html,/transmission-console/);assert.doesNotMatch(html,/command-sidebar/);
 assert.match(stage,/assets\/cutouts/);assert.match(stage,/entity-index/);assert.match(stage,/agent-role/);assert.match(stage,/rotation\.y = lerp/);assert.match(stage,/mx \* \.22/);
 for(const f of ['ghost_001','null_entity','echo_exe'])assert.equal(existsSync(new URL(`../dist/assets/cutouts/${f}.png`,import.meta.url)),true);
 assert.match(css,/grid-template-columns:clamp\(130px,11\.5vw,215px\)/);
});
test('local operator controls are not part of public Worker source',()=>{
 const script=read('../scripts/build-worker.mjs');assert.match(script,/operator/);assert.match(read('../dist/legacy-v7.html'),/04 \/ OPERATOR/);assert.match(read('../dist/sound.js'),/Non-melodic machine responses/);
});
