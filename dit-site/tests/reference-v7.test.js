import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('V7 reference layout is wired in last and matches the mock structure',()=>{
 const html=read('../dist/index.html'),css=read('../dist/reference-v7.css');
 assert.ok(html.indexOf('reference-v7.css')>html.indexOf('observatory-v6.css'),'v7 must load after v6');
 assert.match(html,/03 \/ SYSTEM<\/button>/);assert.match(html,/\/\/ LIVE TRANSMISSIONS/);assert.match(html,/VIEW ALL TRANSMISSIONS/);assert.match(html,/01 \/ LIVE OBSERVATION/);
 assert.match(css,/\.operating-rail\{position:absolute/);assert.match(css,/\.dit-stage-labels\{[^}]*var\(--stage-span/);
 assert.match(css,/\.agent-live-state::before/);assert.match(css,/\.command-bottom\{display:none\}/);
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
