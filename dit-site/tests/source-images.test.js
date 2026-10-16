import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeImageMints,lookupSourceImages} from '../server/lib/source-images.js';
const A='So11111111111111111111111111111111111111112',B='11111111111111111111111111111111',C='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefg';
test('source image lookup only accepts bounded, valid Solana mints',()=>{
 assert.deepEqual(normalizeImageMints('oops,'+A+','+A+',https://example.org'),[A]);
 assert.equal(normalizeImageMints(Array.from({length:30},(_,i)=>A).join(',')).length,1);
});
test('historical exact-mint token logo is returned but unrelated token art is ignored',async()=>{
 const calls=[],mock=async url=>{
  calls.push(url);
  if(url.includes('dexscreener.com'))return Response.json([
   {chainId:'solana',baseToken:{address:'unrelated'},info:{imageUrl:'https://example.org/wrong.png'}},
   {chainId:'solana',baseToken:{address:A},info:{imageUrl:'https://example.org/original.png'}},
   {chainId:'bsc',baseToken:{address:B},info:{imageUrl:'https://example.org/other.png'}}
  ]);
  return Response.json({data:[{attributes:{address:B,image_url:'https://example.org/verified.png'}},{attributes:{address:'not-matched',image_url:'https://example.org/incorrect.png'}}]});
 };
 const c=new Map(),first=await lookupSourceImages([A,B],{fetchImpl:mock,cacheStore:c,now:1000});
 assert.equal(first.images[A].url,'https://example.org/original.png');
 assert.equal(first.images[B].url,'https://example.org/verified.png');
 assert.equal(first.images.unrelated,undefined);
 assert.equal(calls.length,2);
 const again=await lookupSourceImages([A,B],{fetchImpl:()=>{throw Error('no extra calls')},cacheStore:c,now:2000});
 assert.deepEqual(first.images,again.images);
});
test('source tokens with no verifiable image never acquire invented artwork',async()=>{
 const answer=await lookupSourceImages([C],{fetchImpl:async url=>url.includes('dexscreener.com')?Response.json([]):Response.json({data:[]}),cacheStore:new Map()});
 assert.deepEqual(answer.images,{});
});
