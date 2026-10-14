import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AutonomousResearch} from '../server/autonomous.mjs';
const GB=1024**3;
const build=(options={})=>{
 const active=new Map(), submissions=[];
 const operator={
   port:4173,maxConcurrent:3,running:active,
   store:{async select(){return [{title:'Real archived observation',url:'https://example.org/evidence'}]}},
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
   fetchImpl:async()=>Response.json({models:options.loadedModels||[]}),
   log:()=>{}
 });
 return {operator,scheduler,submissions};
};
test('all three autonomous identities initiate independent JARVIS runs concurrently',async()=>{
 const {operator,scheduler,submissions}=build();
 await scheduler.tick();
 assert.deepEqual(submissions.map(x=>x.agent_id),['GHOST_001','NULL_ENTITY','ECHO.exe']);
 assert.equal(operator.running.size,3);
 assert.match(submissions[0].prompt,/historical meme cycles/);
 assert.match(submissions[1].prompt,/descriptive market narratives/);
 assert.match(submissions[2].prompt,/social post draft/);
 assert.match(submissions[1].prompt,/untrusted external titles/);
 assert.equal(scheduler.snapshot().agents.length,3);
 await scheduler.tick();
 assert.equal(submissions.length,3,'same cycle must not duplicate jobs');
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
