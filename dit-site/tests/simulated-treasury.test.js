import test from 'node:test';
import assert from 'node:assert/strict';
import {freshStore,req,json} from './helpers.js';
import {handleApi} from '../server/api.js';
import {parseSimulatedAmount,splitSimulatedFee} from '../server/lib/simulated-treasury.js';
const secret='s'.repeat(40),env={DIT_SIMULATION_ENABLED:'1',DIT_SIMULATION_SECRET:secret};
const send=(store,body,e=env,headers={authorization:'Bearer '+secret})=>handleApi(req('/api/simulations/creator-fees',{method:'POST',headers,body:JSON.stringify(body)}),e,{store});
const example={event_id:'demo-fees-036',fee_amount_sol:'0.36'};
test('75/25 simulation is exact and contains no real transfers',async()=>{
 assert.equal(parseSimulatedAmount('0.36'),360000000);
 assert.deepEqual(splitSimulatedFee(360000000),{treasury_lamports:90000000,other_lamports:270000000});
 const store=await freshStore();
 assert.equal((await send(store,example,{})).status,403);
 assert.equal((await send(store,example,env,{authorization:'bad'})).status,401);
 assert.equal((await send(store,example)).status,200);
 assert.equal((await json(send(store,example))).body.duplicate,true);
 assert.equal((await send(store,{...example,fee_amount_sol:'1'})).status,409);
 const sim=await json(handleApi(req('/api/treasury/simulated'),env,{store}));
 assert.deepEqual(sim.body.totals,{fee_lamports:360000000,treasury_lamports:90000000,other_lamports:270000000,transferred_lamports:0});
 const real=await json(handleApi(req('/api/treasury'),env,{store}));
 assert.equal(real.body.totals.confirmed_lamports,0);
 assert.equal((await store.select('fee_receipts')).length,0);
});
test('reject non-decimal, negative and malformed fee events',async()=>{
 const s=await freshStore();
 for(const bad of [0.36,'-1','1e3','1.1234567890','0'])assert.throws(()=>parseSimulatedAmount(bad));
 assert.equal((await send(s,{event_id:'!',fee_amount_sol:'0.36'})).status,422);
});

test('distinct events accumulate while duplicate retries do not',async()=>{
 const store=await freshStore();
 await send(store,{event_id:'first',fee_amount_sol:'0.12'});
 await send(store,{event_id:'second',fee_amount_sol:'0.24'});
 await send(store,{event_id:'second',fee_amount_sol:'0.24'});
 const {body}=await json(handleApi(req('/api/treasury/simulated'),env,{store}));
 assert.equal(body.event_count,2);
 assert.deepEqual(body.totals,{fee_lamports:360000000,treasury_lamports:90000000,other_lamports:270000000,transferred_lamports:0});
});

test('concurrent reuse of an event ID with a different amount conflicts',async()=>{
 const store=await freshStore();
 const select=store.select.bind(store);let reads=0,release;
 const barrier=new Promise(resolve=>{release=resolve});
 store.select=async(table,options)=>{
  if(table==='circuit_events'&&reads++<2){if(reads===2)release();await barrier;return [];}
  return select(table,options);
 };
 const results=await Promise.all([send(store,example),send(store,{...example,fee_amount_sol:'0.12'})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal((await store.select('circuit_events')).length,1);
});
