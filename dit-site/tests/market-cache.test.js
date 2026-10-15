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
