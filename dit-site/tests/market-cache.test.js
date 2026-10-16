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
 assert.equal(calls,5,'discovery reads three JARVIS routes, tape, and one bounded pair-metadata lookup');
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

test('60 market refresh cycles preserve 40 real source-artwork URLs and verified launch timestamps',async()=>{
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 const addresses=Array.from({length:60},(_,i)=>'123456789ABCDEFGHJKLMNPQRSTUVWXYZ'+alphabet[Math.floor(i/58)]+alphabet[i%58]);
 const launch=new Date(Date.now()-42_000).toISOString();
 let tick=0;
 const op=new Operator({store:{},env:{DIT_JARVIS_URL:'http://127.0.0.1:8768'},port:4173,
 configFile:'/tmp/dit-nonexistent-market-settings.json',
 fetchImpl:async url=>{
  if(String(url).includes('trenches'))return Response.json({data:{new_creation:addresses.map((address,i)=>({
   address,symbol:'COIN'+i,pair_created_at:launch,
   image_url:i<40?'https://cdn.example.org/token-'+i+'.png':null
  }))}});
  if(String(url).includes('/api/tape'))return Response.json({items:addresses.map((address,i)=>({
   address,chain:'sol',observed_at:(Date.now()-500)/1000,
   volume_5m:i+tick,buys_5m:tick+1,sells_5m:tick
  }))});
  return Response.json({items:[]});
 }});
 await op.refreshMarket();
 const initial=Object.fromEntries(op.marketStatus().signals.map(x=>[x.address,x]));
 assert.equal(Object.keys(initial).length,60);
 for(tick=1;tick<=60;tick++){
   op.marketAt=Date.now()-1500;
   if(tick%10===0)op.discoveryAt=Date.now()-25000;
   await op.refreshMarket();
 }
 const final=op.marketStatus().signals;
 assert.equal(final.length,60);
 assert.equal(final.filter(x=>x.image_url?.startsWith('https://cdn.example.org/')).length,40);
 assert.equal(final.filter(x=>x.image_url===null).length,20);
 for(const token of final){
   assert.equal(token.pair_created_at,launch);
   assert.equal(token.first_seen_at,initial[token.address].first_seen_at);
 }
});

test('an undated GMGN response is never marked as a verified live source solely because it was fetched now',()=>{
 const op=new Operator({store:{},env:{},port:4173,configFile:'/tmp/dit-nonexistent-market-settings.json'});
 op.marketAt=Date.now();
 op.marketSnapshot={signals:[{address:'So11111111111111111111111111111111111111112',
   observed_at:new Date().toISOString(),source_observed_at:null}]};
 assert.equal(op.marketStatus().stale,true);
});
