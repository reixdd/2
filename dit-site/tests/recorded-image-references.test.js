import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedSources} from '../server/lib/concepts.js';
const mint='So11111111111111111111111111111111111111112',url='https://gmgn.ai/sol/token/'+mint;
test('new research stores original exact-token image in a recorded source reference',()=>{
 const out=recordedSources('Research reference '+url,[{url,title:'GMGN research',observed_at:new Date().toISOString(),
  social_source:'coin_metadata',image_url:'https://source.example/token.png'}]);
 assert.equal(out.length,1);
 assert.equal(out[0].address,mint);
 assert.equal(out[0].source_image_url,'https://source.example/token.png');
 assert.equal(out[0].social_source,'coin_metadata');
 const bad=recordedSources('Research reference '+url,[{url,observed_at:new Date().toISOString(),
  social_source:'coin_metadata',image_url:'javascript:alert(1)'}]);
 assert.equal(bad[0].source_image_url,null);
});
