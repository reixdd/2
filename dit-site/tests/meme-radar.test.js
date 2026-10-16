import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredAgentIdeas,AGENTS} from '../dist/concept-feature.js';
import {conceptArtwork} from '../dist/terminal-ui.js';

test('Meme Radar features newest eligible concept per agent, not oldest concept with artwork',()=>{
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
 assert.equal(featured.find(c=>c.agent_id==='GHOST_001').id,'ghost-new');
 assert.equal(featured.find(c=>c.agent_id==='ECHO.exe').id,'echo-new');
 assert.equal(conceptArtwork(featured.find(c=>c.id==='ghost-new')).kind,'missing','missing art should not hide a new idea');
});
