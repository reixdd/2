import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichVerifiedPairs} from '../worker/pair-metadata.js';
const A='So11111111111111111111111111111111111111112';
const B='11111111111111111111111111111111';
const noArt=()=>({signals:[
 {address:A,kind:'tape',symbol:'ALPHA',image_url:null,image_candidates:[],pair_time_verified:false},
 {address:B,kind:'tape',symbol:'BETA',image_url:null,image_candidates:[],pair_time_verified:false}
],source_states:{tape:'OK'},research_only:true});
test('bounded GeckoTerminal fallback returns original source image ONLY for the matching contract',async()=>{
 const urls=[];
 const result=await enrichVerifiedPairs(noArt(),{fetchImpl:async url=>{
  urls.push(String(url));
  if(String(url).includes('dexscreener.com'))return Response.json([{chainId:'solana',baseToken:{address:A},info:{}}]);
  return Response.json({data:[
   {id:'solana_'+A,attributes:{address:A,image_url:'https://assets.example/original.png'}},
   {id:'solana_'+B,attributes:{address:B,image_url:'javascript:bad'}},
   {id:'solana_zzz-unrelated',attributes:{address:'zzz-unrelated',image_url:'https://assets.example/wrong.png'}}
  ]});
 }});
 assert.equal(urls.length,2);
 assert.ok(urls.every(x=>x.startsWith('https://api.dexscreener.com/')||x.startsWith('https://api.geckoterminal.com/')));
 assert.equal(result.signals[0].image_url,'https://assets.example/original.png');
 assert.equal(result.signals[0].image_candidates[0].provider,'GeckoTerminal token metadata');
 assert.equal(result.signals[1].image_url,null);
 assert.equal(result.source_states.token_image_metadata,'OK');
});
test('DexScreener outage does not prevent successful contract-matched fallback imagery',async()=>{
 const result=await enrichVerifiedPairs(noArt(),{fetchImpl:async url=>{
  if(String(url).includes('dexscreener.com'))throw Error('dex unavailable');
  return Response.json({data:[{attributes:{address:A,image_url:'https://assets.example/source.gif'}}]});
 }});
 assert.equal(result.signals[0].image_url,'https://assets.example/source.gif');
 assert.equal(result.source_states.pair_metadata,'UNAVAILABLE');
 assert.equal(result.source_states.token_image_metadata,'OK');
});
