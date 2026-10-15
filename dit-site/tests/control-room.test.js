import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roomSummary} from '../dist/control-room.js';
import {conceptArtwork} from '../dist/terminal-ui.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('real observatory numbers are derived from saved backend payloads',()=>{
 const state=roomSummary({agents:[{id:'GHOST_001',presence:'idle'},{id:'ECHO.exe',presence:'offline'}]},
  {signals:[{address:'token-a',source_observed_at:new Date().toISOString(),volume_5m_usd:120,buys_5m:12,sells_5m:3}],stale:false},
  [{id:1,agent_id:'GHOST_001',title:'Observed market pair'}]);
 assert.equal(state.agents,2);assert.equal(state.pairs,1);assert.equal(state.events,1);
 assert.equal(state.status,'LIVE');
 assert.equal(roomSummary(null,null,[]).pairs,null);
});
test('meme artwork never impersonates agent portrait as concept artwork',()=>{
 const c={agent_id:'GHOST_001',content:{name:'GHOSTPOST'}};
 const a=conceptArtwork(c,[]);
 assert.equal(a.kind,'missing');
 assert.equal(a.url,null);
});
test('home is dynamic with visible New Pairs; radar and activity are separate terminal tabs',()=>{
 const script=(read('../dist/live-research.js')+read('../dist/market-feed.js'));
 const module=read('../dist/control-room.js');
 assert.match(script,/mountControlRoom/);
 assert.match(script,/activateTab/);
 assert.match(module,/dit-live-evidence-section/);
 assert.match(module,/data-dit-tab="radar"/);
 assert.match(module,/data-dit-tab="activity"/);
 assert.match(script,/\.hidden=selected/);
});
test('market priority fields are visible and rendered from API, not fake placeholders',()=>{
 const js=(read('../dist/live-research.js')+read('../dist/market-feed.js'));
 assert.match(js,/volume_5m_usd/);assert.match(js,/buys_5m/);assert.match(js,/sells_5m/);
 assert.match(js,/data-stat="txns"/);assert.match(js,/data-stat="vol"/);
});
test('moving background and flow use reduced-motion fallback',()=>{
 const css=read('../dist/control-room.css');
 assert.match(css,/@keyframes dit-city-breathe/);
 assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
 assert.match(read('../dist/live-research.css'),/data-transmitting=true/);
});
