import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { freshStore } from './helpers.js';
import { AGENTS } from '../server/lib/agents.js';
import { runCycle } from '../worker/pipeline.js';
import { openFileStore } from '../server/lib/store-file.js';
import { bootstrap } from '../worker/bootstrap.js';
import { Scheduler } from '../worker/scheduler.js';
import {createLlm} from '../worker/llm.js';
const fakeFetch=async(url)=>{
 if(url.includes('token-profiles/latest/v1'))return {ok:true,json:async()=>[{chainId:'solana',tokenAddress:'So11111111111111111111111111111111111111112',description:'New Solana joke'}, {chainId:'solana',tokenAddress:'11111111111111111111111111111111',description:'Old meme returned'}]};
 if(url.includes('/metrics/pageviews'))return {ok:true,json:async()=>({items:[{articles:[{article:'GeoCities',views:40000,rank:1}]}]})};
 if(url.includes('onthisday'))return {ok:true,json:async()=>({events:[{year:1999,text:'The computer internet network changed',pages:[{content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Internet'}}}]}]})};
 if(url.includes('dex/search'))return {ok:true,json:async()=>({pairs:[]})};
 return{ok:false,status:404,json:async()=>({})};
};
test('a real research cycle stores source observations and a durable agent memory, without inventing a concept when LLM absent',async()=>{
 const store=await freshStore();const job=await store.insert('agent_jobs',{agent_id:'GHOST_001',kind:'cycle',dedupe_key:'test-cycle'});
 const out=await runCycle({store,job,persona:AGENTS.GHOST_001,env:{},llm:{configured:false},llmAllowed:false,fetchImpl:fakeFetch,now:()=>Date.now()});
 assert.equal(out.result.outcome,'research_only');assert.ok((await store.select('observations')).length>=2);
 assert.equal((await store.select('agent_memories')).length,1);assert.equal((await store.select('token_proposals')).length,0);
 assert.equal((await store.select('agents',{filters:[['id','eq','GHOST_001']]}))[0].state,'IDLE');
});
test('local file store retains all agent votes and memories across process-style reload',async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'dit-store-'));try{
 const filename=path.join(d,'memory.json');let store=openFileStore(filename);await bootstrap(store);
 await store.insert('agent_memories',{agent_id:'NULL_ENTITY',kind:'episodic',content:'Observed a narrative with no proof',summary:'No proof, hold',tags:['lesson']});
 await store.rpc('cast_vote',{p_user:'00000000-0000-4000-8000-000000000091',p_agent:'NULL_ENTITY',p_max_changes_per_hour:5});await store.flush();
 store=openFileStore(filename);assert.equal((await store.select('agent_memories')).length,1);assert.equal((await store.select('agent_votes')).length,1);
 }finally{fs.rmSync(d,{recursive:true,force:true})}
});
test('scheduler creates deduplicated jobs across ticks without needing website visitors',async()=>{
 const store=await freshStore();const sch=new Scheduler({store,env:{},llm:createLlm({}),fetchImpl:fakeFetch,clock:()=>Date.parse('2026-10-13T12:00:00Z')});
 assert.equal(await sch.ensureJobs(),4);assert.equal(await sch.ensureJobs(),0);assert.equal((await store.select('agent_jobs')).length,4);
});

test('scheduler never requeues completed jobs in the same window (V3 dedupe regression)', async () => {
 const store=await freshStore();const clock=()=>Date.parse('2026-10-13T12:00:00Z');
 const sch=new Scheduler({store,env:{},llm:createLlm({}),fetchImpl:fakeFetch,clock});
 assert.equal(await sch.ensureJobs(),4);
 const previous=(await store.select('agent_jobs'));
 for(const job of previous) await store.update('agent_jobs',[['id','eq',job.id]],{status:'succeeded'});
 assert.equal(await sch.ensureJobs(),0);
 assert.equal((await store.select('agent_jobs')).length,4);
});
