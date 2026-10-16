import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredAgentIdeas,AGENTS} from '../dist/concept-feature.js';
import {conceptArtwork} from '../dist/terminal-ui.js';

test('Meme Radar showcases older illustrated concepts before new text-only ideas',()=>{
 const rows=[
  {id:'ghost-old',agent_id:'GHOST_001',status:'published',created_at:'2026-10-01T10:00:00Z',content:{name:'Older Ghost',image_url:'https://example.org/old.png'}},
  {id:'ghost-new',agent_id:'GHOST_001',status:'review',created_at:'2026-10-15T10:00:00Z',content:{name:'New Ghost'}},
  {id:'null-new',agent_id:'NULL_ENTITY',status:'published',created_at:'2026-10-15T11:00:00Z',content:{name:'Null Idea'}},
  {id:'echo-new',agent_id:'ECHO.exe',status:'review',created_at:'2026-10-15T12:00:00Z',content:{name:'Echo Idea'}},
  {id:'invalid-newer',agent_id:'ECHO.exe',status:'rejected',created_at:'2026-10-16T10:00:00Z',content:{name:'Rejected'}},
 ];
 const featured=featuredAgentIdeas(rows);
 assert.equal(featured.length,3);
 assert.deepEqual(new Set(featured.map(c=>c.agent_id)),new Set(AGENTS));
 assert.equal(featured.find(c=>c.agent_id==='GHOST_001').id,'ghost-old');
 assert.equal(featured.find(c=>c.agent_id==='ECHO.exe').id,'echo-new');
 assert.equal(conceptArtwork(featured.find(c=>c.id==='ghost-old')).kind,'concept','saved illustration outranks vector-only concept');
});

test('original source meme photo wins over generated illustration; failed source falls back gracefully',()=>{
 const addr='So11111111111111111111111111111111111111112';
 const url='https://source.example/original-meme.png';
 const signals=[{address:addr,url:'https://gmgn.ai/sol/token/'+addr,image_url:url}];
 const source={id:'source',agent_id:'GHOST_001',status:'review',created_at:'2026-09-01T00:00:00Z',
  source_refs:[{address:addr}],content:{name:'Original meme',image_url:'https://images.example/concept-art.png'}};
 const drawn={id:'drawn',agent_id:'GHOST_001',status:'review',created_at:'2026-10-14T00:00:00Z',
  content:{name:'Illustration',image_url:'https://images.example/art-two.png'}};
 const newest={id:'new',agent_id:'GHOST_001',status:'review',created_at:'2026-10-16T00:00:00Z',
  content:{name:'Newest text-only'}};
 assert.equal(conceptArtwork(source,signals).kind,'evidence');
 assert.equal(featuredAgentIdeas([source,drawn,newest],signals)[0].id,'source');
 assert.equal(conceptArtwork(source,signals,new Set([url])).kind,'concept');
 assert.equal(featuredAgentIdeas([source,drawn,newest],signals,new Set([url]))[0].id,'drawn');
 assert.equal(conceptArtwork(source,signals,new Set([url,'https://images.example/concept-art.png'])).kind,'missing');
});
