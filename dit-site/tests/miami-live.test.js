import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleBackendApi} from '../server/lib/routes.js';
import {extractConcept,recordedSources} from '../server/lib/concepts.js';
import {freshStore,req} from './helpers.js';
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('homepage uses the exact interactive MIAMI SIGNAL stage and real evidence surfaces',()=>{
 const html=file('../dist/index.html'),js=file('../dist/live-research.js');
 for(const token of ['DIT // TERMINAL DECAY','id="stage"','id="fx"','data-view="ghost"','data-view="null"','data-view="echo"','id="dit-live-network"','id="dit-live-evidence"','id="dit-live-concepts"','live-research.js','live-research.css'])assert.ok(html.includes(token),token);
 assert.match(html,/data:image\/png;base64,/);
 assert.ok(js.includes('/api/observatory'));assert.ok(js.includes('/api/concepts'));
 assert.ok(js.includes('/api/observations'));assert.ok(js.includes('/api/results'));
 assert.ok(file('../dist/legacy-v7.html').includes('dit-stage'));
});
test('archived cloud evidence does not falsely claim local JARVIS is online',async()=>{
 const store=await freshStore();
 await store.insert('worker_heartbeats',{worker_id:'dit-edge-cultural-evidence',last_seen_at:new Date().toISOString(),info:{kind:'source_collection'}});
 const r=await handleBackendApi(req('/api/observatory'),{}, {store});
 assert.equal(r.status,200);const j=await r.json();
 assert.equal(j.researcher.online,false);assert.equal(j.collector.online,true);
 assert.ok(j.agents.every(a=>a.presence==='offline'));
});
test('concepts require recorded source provenance and remain private until human review',async()=>{
 const source={id:'observation-1',agent_id:'GHOST_001',url:'https://example.org/history',title:'Recorded history',observed_at:new Date().toISOString()};
 const refs=recordedSources('Documented at https://example.org/history', [source]);
 assert.equal(refs.length,1);
 const x=extractConcept('Here is a report.\n'+String.fromCharCode(96).repeat(3)+'json\n'+JSON.stringify({name:'Archive Echo',ticker:'ARCH',narrative:'A remembered fragment of internet culture with source evidence.',social_draft:'A fictional concept rooted in archival evidence, not a financial asset.'})+'\n'+String.fromCharCode(96).repeat(3),'GHOST_001',refs);
 assert.equal(x.ticker,'ARCH');
 assert.equal(extractConcept('Made-up coin', 'GHOST_001',[]),null);
 const store=await freshStore();
 await store.insert('agent_research_runs',{id:'run-1',agent_id:'GHOST_001',prompt:'Research evidence',provider:'jarvis',status:'completed',answer:'Example'});
 await store.insert('fictional_concepts',{id:'concept-1',run_id:'run-1',agent_id:'GHOST_001',status:'review',content:x,source_refs:refs});
 let r=await handleBackendApi(req('/api/concepts'),{}, {store});assert.deepEqual((await r.json()).concepts,[]);
 await store.update('fictional_concepts',[['id','eq','concept-1']],{status:'published',published_at:new Date().toISOString()});
 r=await handleBackendApi(req('/api/concepts'),{}, {store});assert.equal((await r.json()).concepts.length,1);
});

test('public config identifies the uploaded MIAMI SIGNAL release for deployment checks',async()=>{
 const store=await freshStore();
 const response=await handleBackendApi(req('/api/config'),{}, {store});
 assert.equal(response.status,200);
 assert.equal((await response.json()).release,'dit-miami-signal-20261015');
});
