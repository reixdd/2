import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLlm, selectOllamaModels } from '../worker/llm.js';
const file = n=>readFileSync(new URL(n, import.meta.url),'utf8');
test('V5 keeps one open stage, top-level system, independent music controls and a 2.5D stage',()=>{
 const html=file('../dist/index.html'),css=file('../dist/presence-v5.css'),stage=file('../dist/stage.js');
 assert.match(html,/reference-v7\.css/);assert.match(html,/id="dit-music-toggle"/);assert.match(html,/03 \/ SYSTEM</);
 assert.match(stage,/PlaneGeometry/);assert.match(stage,/assets\/cutouts/);assert.doesNotMatch(stage,/CylinderGeometry/);assert.doesNotMatch(stage,/const orbitRings/);
 assert.match(css,/\.dit-stage-labels\{width:min\(67%/);assert.match(css,/grayscale\(1\)/);
});
test('Ollama discovery chooses actual text models and never selects embeddings',()=>{
 const s=selectOllamaModels([{name:'nomic-embed-text',details:{parameter_size:'3B'}},{name:'tiny:1b',details:{parameter_size:'1B'}},{name:'research:4b',details:{parameter_size:'4B'}},{name:'deep:14b',details:{parameter_size:'14B'}}]);
 assert.equal(s.fast,'research:4b');assert.equal(s.deep,'deep:14b');assert.equal(s.names.length,3);
});
test('LLM router discovers JARVIS Ollama and uses distinct fast/deep models',async()=>{
 const calls=[];
 const fake=async(url,init)=>{calls.push([String(url),init]);if(String(url).endsWith('/api/tags'))return {ok:true,json:async()=>({models:[{name:'fast:4b',details:{parameter_size:'4B'}},{name:'deep:14b',details:{parameter_size:'14B'}}]})};return {ok:true,json:async()=>({message:{content:'{"name":"Example"}'},prompt_eval_count:12,eval_count:7})};};
 const llm=createLlm({DIT_LLM_PROVIDER:'auto'},fake);assert.equal(llm.configured,false);await llm.discover();assert.equal(llm.configured,true);
 assert.equal(llm.model,'fast:4b');await llm.complete({agentId:'GHOST_001',system:'research',user:'hello'});
 await llm.complete({agentId:'NULL_ENTITY',system:'research',user:'hello'});
 assert.equal(JSON.parse(calls[1][1].body).model,'fast:4b');assert.equal(JSON.parse(calls[2][1].body).model,'deep:14b');
});
test('Router does not silently send prompts to external network and supports offline fallback',async()=>{
 assert.throws(()=>createLlm({OLLAMA_URL:'https://example.org'}),/Non-loopback/);
 const llm=createLlm({},async()=>{throw Error('offline')});await llm.discover();assert.equal(llm.configured,false);
 await assert.rejects(llm.complete({system:'test',user:'hello'}),/offline/);
});
