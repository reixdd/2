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
