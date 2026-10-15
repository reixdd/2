// Archived V7 design regression: current homepage intentionally uses the user's MIAMI SIGNAL HTML.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('production loads one consolidated stylesheet and a self-hosted renderer',()=>{
 const html=read('../dist/legacy-v7.html');
 assert.equal((html.match(/rel="stylesheet"/g)||[]).length,1);
 assert.match(html,/href="reference-v7.css"/);
 assert.match(html,/vendor\/three.module.js/);
 assert.doesNotMatch(html,/fonts.googleapis|cdn.jsdelivr/);
 for(const panel of ['network','activity','system'])assert.ok(html.includes(`data-panel="${panel}"`));
 assert.match(html,/RESEARCH TRANSMISSIONS/);
});
test('V7 labels carry status pill, VIEW DOSSIER, VOTE and a keyboard-operable more menu',()=>{
 const stage=read('../dist/stage.js');
 for(const s of ['VIEW DOSSIER','data-vote=','data-stage-more','aria-expanded','label-more','data-vote-count','data-vote-bar','data-stage-state'])assert.ok(stage.includes(s),s);
 assert.match(stage,/key === 'Escape'/);assert.match(stage,/--stage-span/);
});
test('V7 treasury panel shows only recorded totals and keeps the no-guaranteed-transfer wording',()=>{
 const js=read('../dist/command.js');
 for(const s of ['CONFIRMED FEES','TREASURY SHARE','PENDING ALLOCATION','fund-progress','No guaranteed transfer','transferred_lamports'])assert.ok(js.includes(s),s);
});
test('V7 character art is recoloured per machine and keeps the originals',()=>{
 for(const f of ['ghost_001','null_entity','echo_exe']){assert.equal(existsSync(new URL(`../dist/assets/cutouts/${f}.png`,import.meta.url)),true);assert.equal(existsSync(new URL(`../dist/assets/cutouts/original/${f}.png`,import.meta.url)),true)}
});
