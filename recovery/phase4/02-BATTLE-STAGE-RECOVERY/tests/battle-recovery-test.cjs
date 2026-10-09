/* Standalone check for NEW companion lib/battle.ts; requires compiled JS only. */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const b = require('./.compiled-battle/battle.js');
const recorded = {
  mode:'recorded', contenderId:'amber-emissary', challengeTitle:'The Supply Seal',
  prompt:'Raw amount?', answer:'297 tokens', checker:'deterministic', correct:true,
  model:'fixture-A', recordedAt:'2026-10-01T12:00:00Z', evidenceHref:'/evidence/fixture',
};
test('authentic-looking recorded shape passes structural checks',()=>assert.equal(b.validateBattleRecord(recorded).ok,true));
test('visitor-started result cannot be labelled recorded',()=>assert.equal(b.validateBattleRecord({...recorded,startedByVisitor:true}).ok,false));
test('recording without evidence link refused',()=>assert.equal(b.validateBattleRecord({...recorded,evidenceHref:undefined}).ok,false));
test('practice cannot carry a model identity',()=>assert.equal(b.validateBattleRecord({...recorded,mode:'practice'}).ok,false));
test('practice may be a player-only exercise',()=>assert.equal(b.validateBattleRecord({mode:'practice',contenderId:'amber-emissary',challengeTitle:'Tutorial',prompt:'Check?',answer:'Yes',checker:'deterministic',correct:true}).ok,true));
test('local-ai requires confirmed explicit user start',()=>{
 const local = {...recorded,mode:'local-ai',recordedAt:undefined,evidenceHref:undefined};
 assert.equal(b.validateBattleRecord(local).ok,false);
 assert.equal(b.validateBattleRecord({...local,startedByVisitor:true}).ok,true);
});
test('unsafe evidence href rejected',()=>assert.equal(b.validateBattleRecord({...recorded,evidenceHref:'javascript:alert(1)'}).ok,false));
test('checker outcomes are not fabricated',()=>{
 assert.equal(b.outcomeOf(recorded),'correct');
 assert.equal(b.outcomeOf({...recorded,correct:false}),'incorrect');
 assert.equal(b.outcomeOf({...recorded,correct:null}),'unchecked');
});
test('answer disclosure is a prefix of original answer',()=>{
 const full='Here is a real model answer.'; const middle=b.revealedText(full,200,600);
 assert.ok(full.startsWith(middle)); assert.ok(middle.length<full.length); assert.equal(b.revealedText(full,600,600),full);
});
test('reduced motion switches off theatrical timing',()=>{
 assert.equal(b.revealDuration('answer',true),0);
 assert.ok(b.battleBeats(recorded,true).every(x=>x.ms===0));
 assert.equal(b.revealedText('real answer', 0, 0), 'real answer');
});
