import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalCoinXUrl,coinXFromMetadata,linkedCoinXEvidence} from '../dist/coin-twitter.js';
import {buildCodeWallpaper} from '../dist/terminal-motion.js';
const mint='So11111111111111111111111111111111111111112';
test('coin X references come from its own social metadata, not broad news or generated URLs',()=>{
 const p={baseToken:{address:mint},info:{socials:[{type:'twitter',url:'https://twitter.com/ExampleCoin'},{type:'telegram',url:'https://t.me/foo'}]}};
 assert.equal(coinXFromMetadata(p),'https://x.com/ExampleCoin');
 assert.equal(coinXFromMetadata({info:{socials:[]}}),null);
 assert.equal(canonicalCoinXUrl('https://x.com/intent/tweet?text=BUY'),null);
 assert.equal(canonicalCoinXUrl('https://x.com/ExampleCoin/status/1234567890123456789?utm_source=foo'),'https://x.com/ExampleCoin/status/1234567890123456789');
 assert.equal(canonicalCoinXUrl('https://x.com.evil.tld/ExampleCoin'),null);
 assert.equal(canonicalCoinXUrl('http://x.com/ExampleCoin'),null);
});
test('dossier excludes unrelated cultural observations even if the titles contain coin names',()=>{
 const observations=[
  {title:'Solana source coin',evidence:{token_address:mint},observed_at:'2026-10-15T22:00:00Z'},
  {title:'Random mainstream news',url:'https://en.wikipedia.org/wiki/ExampleCoin'},
  {title:'Unrelated X account',evidence:{token_address:'11111111111111111111111111111111',x_url:'https://x.com/wrongcoin'}}
 ];
 const signals=[{address:mint,twitter_url:'https://x.com/ExampleCoin',symbol:'EXAMPLE'}];
 const links=linkedCoinXEvidence(observations,signals);
 assert.equal(links.length,1);
 assert.equal(links[0].url,'https://x.com/ExampleCoin');
 assert.equal(links[0].address,mint);
 assert.deepEqual(linkedCoinXEvidence([{title:'News only',url:'https://x.com/RandomPerson'}],signals),[]);
});
test('coin X accounts from recorded DexScreener observations require exact source contract',()=>{
 const obs=[{external_id:'dsp:'+mint,evidence:{token_address:mint,x_url:'https://twitter.com/OfficialCoin'},title:'Real source'},
 {external_id:'dsp:other',evidence:{token_address:mint,x_url:'https://x.com/fake'},title:'Wrong source'}];
 const links=linkedCoinXEvidence(obs,[]);
 assert.deepEqual(links.map(x=>x.url),['https://x.com/OfficialCoin']);
});
test('decorative code fills both viewport sides, changes over time, and is never presented as live events',()=>{
 const left=buildCodeWallpaper('left',0,65),right=buildCodeWallpaper('right',2,65);
 assert.ok(left.split('\n').length>=65);
 assert.ok(right.split('\n').length>=65);
 assert.notEqual(left,right);
 assert.notEqual(left,buildCodeWallpaper('left',1,65));
 assert.doesNotMatch(left,/BUY|SELL|FAKE PRICE/);
});
