import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectJarvisMarkets,normalizeMarketResponses,marketPromptEvidence} from '../worker/market-bridge.js';
const address='So11111111111111111111111111111111111111112';
test('GMGN trenches new_creation entries are read-only and validated',()=>{
 const data=normalizeMarketResponses({trenches:{ok:true,data:{data:{new_creation:[{address,name:'Internet Sloth',symbol:'SLOTH',volume_5m:125,liquidity:1000},{address:'invalid',symbol:'FAKE'}]}}}}, {now:Date.UTC(2026,9,14)});
 assert.equal(data.signals.length,1);assert.equal(data.signals[0].volume_5m_usd,125);
 assert.equal(data.signals[0].address,address);assert.equal(data.signals[0].freshness,'FRESH');
 assert.equal(marketPromptEvidence(data.signals).length,1);
});
test('offline provider and no market means no unsupported claims',async()=>{
 const data=await collectJarvisMarkets({now:Date.UTC(2026,9,14),fetchImpl:async()=>Response.json({ok:false,state:'NO_KEY',error:'Unavailable'})});
 assert.equal(data.signals.length,0);assert.equal(data.source_states.trenches,'Unavailable');
});
test('no public/remote URLs through private market bridge',async()=>{
 await assert.rejects(collectJarvisMarkets({baseUrl:'https://api.example.org'}),/loopback/);
});
test('stale JARVIS watched history cannot be presented as a fresh new pair',()=>{
 const data=normalizeMarketResponses({radar:{ok:true,data:{items:[{identity_key:'sol:'+address+':-',address,live_eligible:false,symbol:'OLD'}]}}},{now:Date.UTC(2026,9,14)});
 assert.equal(data.signals.length,0);
});

test('real token imagery is preserved while unsafe URLs are discarded',()=>{
 const address='So11111111111111111111111111111111111111112';
 const data=normalizeMarketResponses({trenches:{ok:true,data:{data:{new_creation:[
  {address,symbol:'PHOTO',logo:'https://cdn.dexscreener.com/token.png'},
  {address:'11111111111111111111111111111111',symbol:'BAD',logo:'javascript:alert(1)'}
 ]}}}},{now:Date.UTC(2026,9,14)});
 assert.equal(data.signals.find(x=>x.symbol==='PHOTO')?.image_url,'https://cdn.dexscreener.com/token.png');
 assert.equal(data.signals.find(x=>x.symbol==='BAD')?.image_url,null);
});

test('JARVIS cross-check fills missing GMGN 5-minute buy/sell and volume metrics by contract',()=>{
 const address='So11111111111111111111111111111111111111112', now=Date.UTC(2026,9,15);
 const data=normalizeMarketResponses({
   trenches:{ok:true,data:{data:{new_creation:[{address,symbol:'MEME',name:'Meme',logo:'https://example.com/token.gif'}]}}},
   radar:{ok:true,data:{items:[{address,chain:'sol',symbol:'MEME',liquidity:1200,volume_5m:250,buys_5m:19,sells_5m:7,live_eligible:true}]}}
 },{now});
 assert.equal(data.signals.length,1);
 const row=data.signals[0];
 assert.equal(row.volume_5m_usd,250);
 assert.equal(row.buys_5m,19);
 assert.equal(row.sells_5m,7);
 assert.equal(row.image_url,'https://example.com/token.gif');
 assert.equal(row.liquidity_usd,1200);
 assert.equal(row.providers.length,2);
});

test('JARVIS tape events populate live pair cards with original observation time and five-minute metrics',()=>{
 const now=Date.UTC(2026,9,15,18,30,0);
 const data=normalizeMarketResponses({tape:{ok:true,data:{items:[{
  event_id:'real-event-01',chain:'sol',contract:address,
  observed_at:(now-2500)/1000,
  symbol:'TAPE',name:'Tape token',volume_5m:1275,buys_5m:22,sells_5m:8,
  market_cap:95000,liquidity:11000
 }]}}},{now});
 assert.equal(data.signals.length,1);
 assert.equal(data.signals[0].address,address);
 assert.equal(data.signals[0].volume_5m_usd,1275);
 assert.equal(data.signals[0].buys_5m,22);
 assert.equal(data.signals[0].sells_5m,8);
 assert.equal(data.signals[0].source_observed_at,new Date(now-2500).toISOString());
});
test('normalization does not invent an upstream observation timestamp for undated results',()=>{
 const now=Date.UTC(2026,9,15,18,30,0);
 const data=normalizeMarketResponses({trenches:{ok:true,data:{data:{new_creation:[{address,symbol:'UNKNOWN'}]}}}},{now});
 assert.equal(data.signals[0].source_observed_at,null);
 assert.equal(data.signals[0].received_at,new Date(now).toISOString());
});
test('one fast tape collection does not invoke upstream GMGN discovery routes',async()=>{
 const called=[],now=Date.UTC(2026,9,15,18,30,0);
 await collectJarvisMarkets({now,tapeOnly:true,fetchImpl:async url=>{
   called.push(url);
   return Response.json({items:[]});
 }});
 assert.equal(called.length,1);
 assert.match(called[0],/\/api\/tape\?limit=/);
});
