import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/lib/store-core.js';
import {sanitizeMarketSnapshot,persistMarketSnapshot,readMarketSnapshot} from '../server/lib/market-snapshot.js';
import {handleBackendApi} from '../server/lib/routes.js';
const now=Date.parse('2026-10-15T15:15:00Z');
const address='So11111111111111111111111111111111111111112';
const source=()=>({signals:[{address,chain:'sol',symbol:'ARCH',name:'Archive',kind:'trenches',
  observed_at:new Date(now-2000).toISOString(),source_observed_at:new Date(now-2000).toISOString(),liquidity_usd:999,volume_5m_usd:100,
  image_url:'https://assets.example.test/image.gif',model_token:'do-not-publish',
  url:'http://127.0.0.1:8768/admin'}],
  source_states:{trenches:'OK',radar:'http://127.0.0.1:8768/secret?token=abc'}});
test('shared market snapshot writes only public on-chain metadata, never local endpoints or secrets',async()=>{
 const db=new MemoryStore();
 assert.equal(await persistMarketSnapshot(db,source(),{now}),true);
 const snap=await readMarketSnapshot(db,{now:now+10_000});
 assert.equal(snap.status,'LIVE');
 assert.equal(snap.signals[0].address,address);
 assert.equal(snap.signals[0].image_url,'https://assets.example.test/image.gif');
 assert.equal(snap.source_states.radar,'UNAVAILABLE');
 assert.ok(!JSON.stringify(snap).includes('127.0.0.1'));
 assert.ok(!JSON.stringify(snap).includes('do-not-publish'));
 assert.ok(!JSON.stringify(snap).includes('token=abc'));
});
test('provider outage cannot replace last useful snapshot; stale displays are honestly labeled',async()=>{
 const db=new MemoryStore();
 await persistMarketSnapshot(db,source(),{now});
 assert.equal(await persistMarketSnapshot(db,{signals:[],source_states:{trenches:'HTTP 503'}},{now:now+30_000}),false);
 const later=await readMarketSnapshot(db,{now:now+300_000});
 assert.equal(later.signals.length,1);
 assert.equal(later.stale,true);assert.equal(later.status,'STALE');
});
test('public market route reads only the stored sanitized snapshot, with no credentials',async()=>{
 const db=new MemoryStore();
 await persistMarketSnapshot(db,{...source(),signals:[{...source().signals[0],observed_at:new Date().toISOString()}]});
 const response=await handleBackendApi(new Request('https://site.example/api/market'),{}, {store:db});
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.research_only,true);
 assert.equal(data.signals.length,1);
});
test('unsupported or empty source data stays empty instead of inventing market metrics',()=>{
 const snap=sanitizeMarketSnapshot({signals:[{address:'invalid',price:1000}],source_states:{trenches:'OK'}});
 assert.deepEqual(snap.signals,[]);
});

test('public snapshots preserve provider observation time separately from server receive time',()=>{
 const upstream=new Date(now-3000).toISOString();
 const received=new Date(now).toISOString();
 const snapshot=sanitizeMarketSnapshot({signals:[{
  address,kind:'tape',symbol:'LIVE',observed_at:upstream,source_observed_at:upstream,received_at:received,
  volume_5m_usd:710,buys_5m:12,sells_5m:4
 }]},now);
 assert.equal(snapshot.signals[0].kind,'tape');
 assert.equal(snapshot.signals[0].source_observed_at,upstream);
 assert.equal(snapshot.signals[0].received_at,received);
 assert.equal(snapshot.signals[0].buys_5m,12);
});

test('hosted snapshot preserves 40 source artwork URLs, 20 explicit gaps and pair-versus-token launch ages',()=>{
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 const pair=new Date(now-35_000).toISOString(), token=new Date(now-800_000).toISOString();
 const data=sanitizeMarketSnapshot({signals:Array.from({length:60},(_,i)=>({
  address:'123456789ABCDEFGHJKLMNPQRSTUVWXYZ'+alphabet[Math.floor(i/58)]+alphabet[i%58],
  observed_at:new Date(now-1000).toISOString(),source_observed_at:new Date(now-1000).toISOString(),
  pair_created_at:pair,token_created_at:token,first_seen_at:new Date(now).toISOString(),
  image_url:i<40?'https://cdn.example.org/art-'+i+'.png':null
 }))},now);
 assert.equal(data.signals.length,60);
 assert.equal(data.signals.filter(x=>x.image_url).length,40);
 assert.equal(data.signals.filter(x=>!x.image_url).length,20);
 assert.equal(data.signals[0].pair_created_at,pair);
 assert.equal(data.signals[0].token_created_at,token);
 assert.equal(data.signals[0].first_seen_at,new Date(now).toISOString());
});

test('hosted public market rejects a freshly persisted wrapper around five-minute-old source observations',async()=>{
 const db=new MemoryStore();
 const sourceTime=new Date(now-310_000).toISOString();
 await persistMarketSnapshot(db,{signals:[{address,symbol:'OLD',
  observed_at:sourceTime,source_observed_at:sourceTime,
  pair_created_at:new Date(now-900_000).toISOString()}]},{now});
 const result=await readMarketSnapshot(db,{now:now+1000});
 assert.equal(result.signals.length,1);
 assert.equal(result.stale,true);
 assert.equal(result.status,'STALE');
});
