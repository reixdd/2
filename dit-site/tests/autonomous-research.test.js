import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AutonomousResearch} from '../server/autonomous.mjs';
const GB=1024**3;
const build=(options={})=>{
 const active=new Map(), submissions=[];
 const operator={
   port:4173,maxConcurrent:3,running:active,
   store:{async select(){return [{title:'Real market signal',url:'https://gmgn.ai/sol/token/So11111111111111111111111111111111111111112'}]},async update(table,filters,patch){const id=filters[0][2];return [{agent_id:id,revision:1,...patch}]},async upsert(){return {}}},
   async handle(req,body){
     assert.equal(req.headers.host,'127.0.0.1:4173');
     submissions.push(body);
     active.set(body.agent_id,body);
     return Response.json({id:'run-'+body.agent_id},{status:202});
   }
 };
 const scheduler=new AutonomousResearch({
   operator,
   env:{DIT_AUTONOMOUS:'1',DIT_AUTONOMOUS_INTERVAL_MINUTES:'20',...options.env},
   clock:()=>options.clock??1000000,
   freeRam:()=>options.freeRam??20*GB,
   fetchImpl:async url=>{
     if(String(url).endsWith('/api/ps'))return Response.json({models:options.loadedModels||[]});
     if(options.noMarket)return Response.json({ok:false,state:'UNAVAILABLE'});
     if(String(url).includes('gmgn'))return Response.json({ok:true,data:{new_creation:[{address:'So11111111111111111111111111111111111111112',symbol:'MEME',name:'Memetic'}]}});
     return Response.json({items:[]});
   },
   log:()=>{}
 });
 return {operator,scheduler,submissions};
};
test('all three autonomous identities initiate independent JARVIS runs concurrently',async()=>{
 const {operator,scheduler,submissions}=build();
 await scheduler.tick();
 assert.deepEqual(submissions.map(x=>x.agent_id),['GHOST_001','NULL_ENTITY','ECHO.exe']);
 assert.equal(operator.running.size,3);
 assert.match(submissions[0].prompt,/forgotten internet meme/);
 assert.match(submissions[1].prompt,/new-pair and trending Solana/);
 assert.match(submissions[2].prompt,/X-style joke/);
 assert.match(submissions[1].prompt,/untrusted data/);
 assert.equal(scheduler.snapshot().agents.length,3);
 await scheduler.tick();
 assert.equal(submissions.length,3,'same cycle must not duplicate jobs');
});
test('market API unavailable means zero automatic AI concept requests',async()=>{
 const {scheduler,submissions}=build({noMarket:true});
 await scheduler.tick();
 assert.equal(submissions.length,0);
 assert.ok(scheduler.snapshot().agents.every(x=>x.status==='waiting_for_market'));
});
test('low available RAM pauses all three identities rather than exhausting the PC',async()=>{
 const {scheduler,submissions}=build({freeRam:2*GB});
 await scheduler.tick();
 assert.equal(submissions.length,0);
 assert.match(scheduler.snapshot().pausedReason,/free system memory/);
});
test('high loaded VRAM defers model requests',async()=>{
 const {scheduler,submissions}=build({loadedModels:[{size_vram:15*GB}]});
 await scheduler.tick();
 assert.equal(submissions.length,0);
 assert.match(scheduler.snapshot().pausedReason,/GPU models/);
});
test('automatic model requests are opt-in; no autonomous jobs by default',async()=>{
 const {scheduler,submissions}=build({env:{DIT_AUTONOMOUS:'0'}});
 await scheduler.tick();
 assert.equal(submissions.length,0);
});

test('retry on a failed autonomous run uses per-agent bounded backoff and success resets it',async()=>{
 let now=10_000_000;
 const {operator,scheduler}=build({clock:now});
 const initial={enabled:true,interval_minutes:20,status:'running',attempts:0,last_run_id:'first-run',next_due_at:new Date(now).toISOString()};
 scheduler.initialized=true;
 scheduler.schedules={
   GHOST_001:{...initial,agent_id:'GHOST_001'},
   NULL_ENTITY:{...initial,agent_id:'NULL_ENTITY',last_run_id:'other'},
   'ECHO.exe':{...initial,agent_id:'ECHO.exe',last_run_id:'echo'}
 };
 operator.store.update=async (_table, filters, patch)=>{
   const id=filters.find(([col])=>col==='agent_id')[2];
   scheduler.schedules[id]={...scheduler.schedules[id],...patch};
   return [scheduler.schedules[id]];
 };
 await scheduler.onFinished('GHOST_001','first-run',{status:'failed',error:'JARVIS stream closed'});
 assert.equal(scheduler.schedules.GHOST_001.status,'retry_wait');
 assert.equal(scheduler.schedules.GHOST_001.attempts,1);
 assert.equal(scheduler.nextAt.GHOST_001,now+120000);
 assert.equal(scheduler.schedules.NULL_ENTITY.status,'running');
 await scheduler.onFinished('GHOST_001','old-run',{status:'completed'});
 assert.equal(scheduler.schedules.GHOST_001.status,'retry_wait','stale completion is ignored');
 scheduler.schedules.GHOST_001.last_run_id='second-run';
 await scheduler.onFinished('GHOST_001','second-run',{status:'failed',error:'model overloaded'});
 assert.equal(scheduler.schedules.GHOST_001.attempts,2);
 assert.equal(scheduler.nextAt.GHOST_001,now+240000);
 scheduler.schedules.GHOST_001.last_run_id='third-run';
 await scheduler.onFinished('GHOST_001','third-run',{status:'completed'});
 assert.equal(scheduler.schedules.GHOST_001.status,'waiting');
 assert.equal(scheduler.schedules.GHOST_001.attempts,0);
 assert.equal(scheduler.nextAt.GHOST_001,now+20*60000);
});
