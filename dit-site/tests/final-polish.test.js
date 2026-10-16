import test from 'node:test';
import assert from 'node:assert/strict';
import {linkedCoinXEvidence} from '../dist/coin-twitter.js';
import {featuredAgentIdeas} from '../dist/concept-feature.js';
const mint='So11111111111111111111111111111111111111112';
test('recorded GMGN token URL resolves only the exact mint X metadata',()=>{
 assert.equal(linkedCoinXEvidence([{url:'https://gmgn.ai/sol/token/'+mint}],[{address:mint,twitter_url:'https://x.com/example'}])[0]?.url,'https://x.com/example');
 assert.equal(linkedCoinXEvidence([{url:'https://evil.example/sol/token/'+mint}],[{address:mint,twitter_url:'https://x.com/example'}]).length,0);
});
test('failed artwork loses featured priority to a working candidate',()=>{
 const row=(id,url)=>({id,agent_id:'GHOST_001',status:'review',content:{name:id,image_url:url}});
 assert.equal(featuredAgentIdeas([row('broken','https://example.org/broken.png'),row('good','https://example.org/good.png')],[],new Set(['https://example.org/broken.png']))[0].id,'good');
});
