import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConcept, normalizeMarket, rankConcepts, validateDraft} from '../model.mjs';

test('sorts complete agent briefs before incomplete briefs',()=>{
  const rows=[
    normalizeConcept({id:'a',agent_id:'GHOST_001',content:{name:'Alpha',ticker:'AAA',narrative:'Narrative',image_url:'https://example.com/a.png'},source_refs:[{url:'https://example.com/story'}]},{}),
    normalizeConcept({id:'b',agent_id:'NULL_ENTITY',content:{name:'Bravo',ticker:'BBB',narrative:'Narrative',image_url:'https://example.com/b.png',x_url:'https://x.com/officialcoin'},source_refs:[{url:'https://example.com/story'}]},{}),
  ];
  assert.deepEqual(rankConcepts(rows).map(r=>r.id),['b','a']);
  assert.equal(rows[0].missing.includes('X link'),true);
});

test('does not mislabel source X evidence as the candidate original account',()=>{
  const row=normalizeConcept({id:'a',content:{name:'Alpha',ticker:'AAA',narrative:'Example'},source_refs:[{url:'https://x.com/source/status/1234567890123'}]},{});
  assert.equal(row.x_url,null);
  assert.equal(row.missing.includes('X link'),true);
  assert.equal(row.sources.length,1);
});

test('draft input accepts only a safe X URL, safe artwork and bounded notes',()=>{
  assert.throws(()=>validateDraft({x_url:'javascript:alert(1)'}),/X link/i);
  assert.throws(()=>validateDraft({artwork_url:'http://example.com/a.jpg'}),/artwork/i);
  assert.deepEqual(validateDraft({x_url:'https://x.com/test_name',artwork_url:'https://example.com/a.png',notes:'demo'}),{x_url:'https://x.com/test_name',artwork_url:'https://example.com/a.png',notes:'demo'});
});

test('market signals preserve source provenance and missing prices',()=>{
  const s=normalizeMarket({address:'So11111111111111111111111111111111111111112',name:'Example',symbol:'EX',provider:'GMGN',observed_at:'2026-10-16T12:00:00.000Z',twitter_url:'https://x.com/SourceX'});
  assert.equal(s.provider,'GMGN');
  assert.equal(s.price_usd,null);
  assert.equal(s.twitter_url,'https://x.com/SourceX');
});
