import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentPortrait,formatActivity,conceptArtwork,safeArtUrl,researchHook} from '../dist/terminal-ui.js';

test('real agent events retain true persisted title, ID and time',()=>{
 const original={id:42,agent_id:'GHOST_001',event_type:'operator_complete',title:'GHOST_001 completed its research brief',
   detail:'Model result stored',created_at:'2026-10-15T02:00:00Z'};
 const result=formatActivity(original);
 assert.equal(result.id,'42');
 assert.equal(result.agent_id,'GHOST_001');
 assert.equal(result.title,original.title);
 assert.equal(result.at,original.created_at);
 assert.equal(formatActivity({...original,agent_id:'unknown'}),null);
 assert.equal(agentPortrait(result.agent_id),'assets/cutouts/ghost_001.png');
});
test('concept card uses exact GIF evidence image, never passes source artwork off as original',()=>{
 const gif='https://cdn.example.org/meme.gif';
 const sample={agent_id:'ECHO.exe',content:{name:'Ghostie'},source_refs:[{url:'https://gmgn.ai/sol/token/abc'}]};
 const img=conceptArtwork(sample,[{url:sample.source_refs[0].url,image_url:gif}]);
 assert.equal(img.url,gif);
 assert.equal(img.kind,'evidence');
 assert.match(img.label,/NOT CONCEPT ART/);
 const fallback=conceptArtwork(sample,[]);
 assert.equal(fallback.url,null);
 assert.equal(fallback.kind,'missing');
 assert.match(fallback.label,/CONCEPT ART PENDING/);
});
test('untrusted image protocols are rejected and model hook is short',()=>{
 assert.equal(safeArtUrl('javascript:alert(1)'),null);
 assert.equal(safeArtUrl('http://example.com/pic.gif'),null);
 assert.equal(safeArtUrl('https://example.com/animated.gif'),'https://example.com/animated.gif');
 assert.equal(researchHook('HOOK: The world logged out.\nSOURCE: https://example.com'),'The world logged out.');
});
