import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ReadableStream} from 'node:stream/web';
import {MemoryStore} from '../server/lib/store-core.js';
import {bootstrap} from '../worker/bootstrap.js';
import {handleBackendApi} from '../server/lib/routes.js';
import {Operator,allowedOperatorRequest} from '../server/operator.mjs';
import {validateSettings,discoverProvider,readNdjson,runResearch} from '../worker/provider-bridge.js';
const request=(pathname,method='GET',host='127.0.0.1:4173',origin)=>({url:new URL(pathname,'http://127.0.0.1:4173'),method,headers:{host,...(origin?{origin}:{})}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const jsonResponse=(value,status=200)=>({ok:status===200,status,json:async()=>value});
const testSettings={provider:'ollama',url:'http://127.0.0.1:11434',models:{GHOST_001:'fast:4b',NULL_ENTITY:'deep:14b','ECHO.exe':'fast:4b'}};
const mockedOllama=async(url,opts={})=>{
 if(String(url).endsWith('/api/tags'))return jsonResponse({models:[{name:'fast:4b'},{name:'deep:14b'}]});
 if(String(url).endsWith('/api/chat'))return jsonResponse({message:{content:'Observed cultural history; one verified source is still needed.'}});
 return jsonResponse({},404);
};
test('provider settings reject remote, credentials, and unsupported models provider',()=>{
 assert.throws(()=>validateSettings({provider:'jarvis',url:'https://example.com'}),/Only local/);
 assert.throws(()=>validateSettings({provider:'ollama',url:'http://attacker.com:11434'}),/Only local/);
 assert.throws(()=>validateSettings({provider:'openai-local',url:'http://admin:secret@localhost:1234'}),/Only local/);
 assert.throws(()=>validateSettings({provider:'unknown'}),/Unsupported/);
 assert.equal(validateSettings({provider:'openai-local',url:'http://127.0.0.1:1234/v1'}).url,'http://127.0.0.1:1234');
});
test('Ollama and OpenAI-compatible model discovery normalize names',async()=>{
 assert.deepEqual((await discoverProvider(testSettings,{fetchImpl:mockedOllama})).models,['fast:4b','deep:14b']);
 const d=await discoverProvider({provider:'openai-local',url:'http://localhost:1234/v1'},{fetchImpl:async url=>{assert.match(url,/\/v1\/models$/);return jsonResponse({data:[{id:'qwen:7b'}]})}});
 assert.deepEqual(d.models,['qwen:7b']);
});
test('JARVIS NDJSON streaming parses state/heartbeat/answer/done and rejects errors',async()=>{
 const ndjson='{"type":"state","text":"Thinking"}\n{"type":"heartbeat","elapsed_s":3}\n{"type":"answer","text":"Evidence-based answer"}\n{"type":"done"}\n';
 const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(ndjson.slice(0,41)));c.enqueue(new TextEncoder().encode(ndjson.slice(41)));c.close()}}),{status:200});
 const out=await readNdjson(response);assert.equal(out.answer,'Evidence-based answer');assert.equal(out.done,true);
 await assert.rejects(readNdjson(new Response('{"type":"error","text":"JARVIS model unavailable"}\n')),/model unavailable/);
});
test('JARVIS bridge sends documented API request and stores honest research answer',async()=>{
 const settings={provider:'jarvis',url:'http://127.0.0.1:8768',models:{}};
 const fetchImpl=async(url,init)=>{assert.match(url,/\/api\/chat$/);const b=JSON.parse(init.body);assert.equal(b.identity_key,'NULL_ENTITY');assert.equal(b.mode,'lite');assert.match(b.message,/SCOUT/);return new Response('{"type":"answer","text":"Three publicly observed trends; confidence low."}\n{"type":"done"}\n')};
 const result=await runResearch({settings,agentId:'NULL_ENTITY',prompt:'Investigate why this pattern appears online',fetchImpl});assert.equal(result.provider,'jarvis');assert.equal(result.answer,'Three publicly observed trends; confidence low.');
});
test('loopback operator rejects foreign Host and Origin even when bound locally',async()=>{
 assert.equal(allowedOperatorRequest(request('/operator/api/settings').headers?request('/operator/api/settings'):null,4173),true);
 assert.equal(allowedOperatorRequest(request('/operator/api/settings','GET','bad.site:4173'),4173),false);
 assert.equal(allowedOperatorRequest(request('/operator/api/run','POST','127.0.0.1:4173','https://evil.test'),4173),false);
});
test('operator permits one in-flight run per agent, persists completion and exposes API results',async()=>{
 const store=new MemoryStore();await bootstrap(store);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dit-operator-'));const file=path.join(tmp,'operator.json');
 let release;const barrier=new Promise(r=>release=r);
 const fake=async(url,init)=>{if(String(url).endsWith('/api/tags'))return jsonResponse({models:[{name:'fast:4b'},{name:'deep:14b'}]});await barrier;return jsonResponse({message:{content:'History is repeating; no financial conclusions are warranted.'}})};
 const op=new Operator({store,env:{},port:4173,fetchImpl:fake,configFile:file});
 const save=await op.handle(request('/operator/api/settings','POST'),testSettings);assert.equal(save.status,200);assert.equal(fs.existsSync(file),true);
 const bad=await op.handle(request('/operator/api/run','POST','bad.site:4173'),{agent_id:'GHOST_001',prompt:'Research patterns'});assert.equal(bad.status,403);
 const run=await op.handle(request('/operator/api/run','POST'),{agent_id:'GHOST_001',prompt:'Research old internet archives'});assert.equal(run.status,202);
 const second=await op.handle(request('/operator/api/run','POST'),{agent_id:'GHOST_001',prompt:'Research something else'});assert.equal(second.status,409);
 release();for(let i=0;i<25 && op.running.size;i++)await wait(15);
 const rows=await store.select('agent_research_runs');assert.equal(rows.length,1);assert.equal(rows[0].status,'completed');assert.match(rows[0].answer,/History is repeating/);
 const r=await handleBackendApi(new Request('http://localhost/api/results?agent=GHOST_001'),{DIT_DEV_AUTH:'1'},{store});const body=await r.json();assert.equal(body.runs.length,1);assert.equal(body.runs[0].status,'completed');
 fs.rmSync(tmp,{recursive:true,force:true});
});
test('operator cancel records cancellation and allows later retry without permanent dead-letter state',async()=>{
 const store=new MemoryStore();await bootstrap(store);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dit-operator-cancel-'));
 const fake=async(url,init)=>{if(String(url).endsWith('/api/tags'))return jsonResponse({models:[{name:'fast:4b'}]});return new Promise((_,reject)=>{if(init.signal.aborted)return reject(Error('aborted'));init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})});};
 const op=new Operator({store,env:{},port:4173,fetchImpl:fake,configFile:path.join(tmp,'operator.json')});await op.handle(request('/operator/api/settings','POST'),testSettings);
 const a=await op.handle(request('/operator/api/run','POST'),{agent_id:'GHOST_001',prompt:'Research carefully while testing cancel'});assert.equal(a.status,202);
 for(let i=0;i<30&&!op.running.size;i++)await wait(2);
 const c=await op.handle(request('/operator/api/cancel','POST'),{agent_id:'GHOST_001'});assert.equal(c.status,200);
 for(let i=0;i<40&&op.running.size;i++)await wait(10);
 assert.equal((await store.select('agent_research_runs'))[0].status,'cancelled');
 const again=await op.handle(request('/operator/api/run','POST'),{agent_id:'GHOST_001',prompt:'Try again after a repaired connection'});assert.equal(again.status,202);
 await op.handle(request('/operator/api/cancel','POST'),{agent_id:'GHOST_001'});
 fs.rmSync(tmp,{recursive:true,force:true});
});

test('JARVIS shared mode pins one lightweight provider, serializes all identities, and uses a valid DB research stage',async()=>{
 const store=new MemoryStore();await bootstrap(store);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dit-jarvis-lite-'));
 let release;const barrier=new Promise(r=>release=r);
 const fake=async()=>{await barrier;return new Response('{"type":"answer","text":"Cautious sourced research answer."}\n{"type":"done"}\n')};
 const op=new Operator({store,env:{DIT_JARVIS_SHARED:'1'},port:4173,fetchImpl:fake,configFile:path.join(tmp,'operator.json')});
 assert.equal(op.settings.provider,'jarvis');assert.equal(op.settings.url,'http://127.0.0.1:8768');
 const custom=new Operator({store,env:{DIT_JARVIS_SHARED:'1',DIT_JARVIS_URL:'http://127.0.0.1:8769'},port:4173,fetchImpl:fake,configFile:path.join(tmp,'custom.json')});
 assert.equal(custom.settings.url,'http://127.0.0.1:8769');
 const save=await op.handle(request('/operator/api/settings','POST'),testSettings);
 assert.equal(save.status,200);assert.equal(op.settings.provider,'jarvis');
 const one=await op.handle(request('/operator/api/run','POST'),{agent_id:'GHOST_001',prompt:'Research a public source fact'});assert.equal(one.status,202);
 const agent=(await store.select('agents',{filters:[['id','eq','GHOST_001']]}))[0];assert.equal(agent.current_stage,'RESEARCH');
 const two=await op.handle(request('/operator/api/run','POST'),{agent_id:'NULL_ENTITY',prompt:'Research another public source'});assert.equal(two.status,429);
 release();for(let i=0;i<40&&op.running.size;i++)await wait(10);
 const rows=await store.select('agent_research_runs');assert.equal(rows.length,1);assert.equal(rows[0].status,'completed');
 fs.rmSync(tmp,{recursive:true,force:true});
});
