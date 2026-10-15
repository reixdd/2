import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichVerifiedPairs} from '../worker/pair-metadata.js';
import {featuredAgentIdeas} from '../dist/concept-feature.js';
import {conceptStudyArtwork} from '../dist/concept-art.js';
const A='So11111111111111111111111111111111111111112',B='11111111111111111111111111111111';
const at=Date.parse('2026-10-15T22:00:00Z');
test('source-backed pool creation qualifies new pair, not a newly traded old pool',async()=>{
 let calls=0;const item=address=>({address,chain:'sol',pair_created_at:null,pair_time_verified:false});
 const out=await enrichVerifiedPairs({signals:[item(A),item(B)],source_states:{}},{now:at,fetchImpl:async url=>{
  calls++;assert.match(url,/api\.dexscreener\.com\/tokens\/v1\/solana\//);
  return Response.json([{chainId:'solana',baseToken:{address:A},pairCreatedAt:at-60000,info:{imageUrl:'https://source.test/art.png'}},{chainId:'solana',baseToken:{address:B},pairCreatedAt:at-7200000}]);
 }});
 assert.equal(calls,1);assert.equal(out.signals[0].pair_time_verified,true);
 assert.equal(out.signals[0].pair_created_at,new Date(at-60000).toISOString());
 assert.equal(out.signals[1].pair_created_at,new Date(at-7200000).toISOString());
 assert.ok(out.signals[0].image_candidates.some(x=>x.url==='https://source.test/art.png'));
});
test('no spoofed address or future pool timestamp becomes NEW',async()=>{
 const out=await enrichVerifiedPairs({signals:[{address:A,chain:'sol',pair_time_verified:false,pair_created_at:null}],source_states:{}},
 {now:at,fetchImpl:async()=>Response.json([{chainId:'solana',baseToken:{address:B},pairCreatedAt:at-1000},{chainId:'solana',baseToken:{address:A},pairCreatedAt:at+600000}])});
 assert.equal(out.signals[0].pair_created_at,null);
});
test('main Radar features newest unique actual idea per agent, not 200 cards',()=>{
 const ideas=[
  {id:'g',agent_id:'GHOST_001',status:'review',created_at:'2026-10-15T22:00:00Z',content:{name:'GHOST'}},
  {id:'g-old',agent_id:'GHOST_001',status:'review',created_at:'2026-10-15T21:00:00Z',content:{name:'OLDER GHOST'}},
  {id:'n',agent_id:'NULL_ENTITY',status:'review',created_at:'2026-10-15T20:00:00Z',content:{name:'VOIDPAY'}},
  {id:'e',agent_id:'ECHO.exe',status:'review',created_at:'2026-10-15T19:00:00Z',content:{name:'DEADNET'}},
  {id:'fake',agent_id:'UNKNOWN',status:'review',created_at:'2026-10-15T23:00:00Z',content:{name:'NOPE'}}];
 assert.deepEqual(featuredAgentIdeas(ideas).map(x=>x.id),['g','n','e']);
});
test('every illustrated study is image data with unique artwork and safely escaped concept metadata',()=>{
 const a=conceptStudyArtwork({agent_id:'GHOST_001',content:{name:'Ghost <script>',ticker:'GHOST',artwork_brief:'ghost with glowing eyes'}}),
       b=conceptStudyArtwork({agent_id:'NULL_ENTITY',content:{name:'VOIDPAY',ticker:'VPAY',artwork_brief:'void bank'}});
 assert.match(a,/^data:image\/svg\+xml/);assert.match(decodeURIComponent(a.split(',')[1]),/<path/);
 assert.doesNotMatch(decodeURIComponent(a.split(',')[1]),/<script>/);assert.notEqual(a,b);
});
