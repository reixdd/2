import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Operator} from '../server/operator.mjs';

test('second-by-second dashboard queries use a bounded single-flight JARVIS cache',async()=>{
 const address='So11111111111111111111111111111111111111112';
 let calls=0;
 const operator=new Operator({store:{},env:{DIT_JARVIS_URL:'http://127.0.0.1:8768'},port:4173,
   configFile:'/tmp/dit-nonexistent-market-settings.json',
   fetchImpl:async url=>{
     calls++;
     if(String(url).includes('trenches'))return Response.json({ok:true,data:{new_creation:[{address,name:'Meme',symbol:'MEME'}]}});
     return Response.json({items:[]});
   }});
 const req={method:'GET',url:'http://127.0.0.1:4173/operator/api/market',headers:{host:'127.0.0.1:4173'}};
 const before=await (await operator.handle(req)).json();
 assert.equal(before.research_only,true);
 await operator.refreshMarket();
 const results=await Promise.all(Array.from({length:10},()=>operator.handle(req).then(r=>r.json())));
 assert.equal(calls,4,'initial source load reads three discovery routes plus one tape route');
 assert.equal(results[0].signals[0].address,address);
 assert.equal(results.every(x=>x.signals.length===1),true);
});

test('after the 20s discovery snapshot, a new 1s market tick reads tape only',async()=>{
 const requested=[];
 const operator=new Operator({store:{},env:{DIT_JARVIS_URL:'http://127.0.0.1:8768'},port:4173,
  configFile:'/tmp/dit-nonexistent-market-settings.json',
  fetchImpl:async url=>{requested.push(String(url));return Response.json({items:[]});}});
 await operator.refreshMarket();
 const first=requested.length;
 operator.marketAt=Date.now()-1500;
 await operator.refreshMarket();
 assert.equal(requested.length,first+1,'only one additional request for fast updates');
 assert.match(requested.at(-1),/\/api\/tape\?limit=/);
});

test('dashboard does not report a just-refreshed wrapper as live when actual source observation is old',()=>{
 const operator=new Operator({store:{},env:{},port:4173,configFile:'/tmp/dit-nonexistent-market-settings.json'});
 const ago=new Date(Date.now()-4*60_000).toISOString();
 operator.marketAt=Date.now();
 operator.marketSnapshot={observed_at:new Date().toISOString(),signals:[{
  address:'So11111111111111111111111111111111111111112',source_observed_at:ago,observed_at:ago
 }]};
 const status=operator.marketStatus();
 assert.equal(status.stale,true,'fresh HTTP wrapper is not proof of fresh market observations');
});

test('timestamped tape metrics supersede earlier undated discovery metrics for the same contract',async()=>{
 const address='So11111111111111111111111111111111111111112';
 let tapeReady=false;
 const op=new Operator({store:{},env:{DIT_JARVIS_URL:'http://127.0.0.1:8768'},port:4173,
  configFile:'/tmp/dit-nonexistent-market-settings.json',
  fetchImpl:async url=>{
   if(String(url).includes('trenches'))return Response.json({ok:true,data:{new_creation:[{
    address,symbol:'PAIR',volume_5m:10,buys_5m:2,sells_5m:1
   }]}});
   if(String(url).includes('/api/tape')&&tapeReady)return Response.json({items:[{
    chain:'sol',contract:address,event_id:'e-updated',observed_at:Date.now()/1000-2,
    volume_5m:200,buys_5m:30,sells_5m:12
   }]});
   return Response.json({items:[]});
  }});
 await op.refreshMarket();
 assert.equal(op.marketStatus().signals[0].volume_5m_usd,10);
 tapeReady=true;op.marketAt=Date.now()-1500;
 await op.refreshMarket();
 assert.equal(op.marketStatus().signals[0].volume_5m_usd,200);
 assert.equal(op.marketStatus().signals[0].buys_5m,30);
 assert.equal(op.marketStatus().signals[0].sells_5m,12);
});
