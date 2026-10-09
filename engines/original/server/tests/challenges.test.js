import test from 'node:test';
import assert from 'node:assert/strict';
import { listChallenges, getChallenge, publicChallenge } from '../challenges/index.js';
import { extractFinal, parseIntegerAnswer, parseJsonLoose, stripThinking } from '../challenges/extract.js';

test('every challenge scores its own reference answer 100 and rejects garbage', () => {
  for (const c of listChallenges()) {
    const good = c.verify(`some working\nFINAL: ${c.referenceAnswer}`);
    if (!c.referenceIsPartial) { assert.equal(good.score, 100, c.id); assert.equal(good.passed, true, c.id); }
    const bad = c.verify('I refuse to answer');
    assert.equal(bad.score, 0, c.id);
    assert.equal(bad.passed, false, c.id);
  }
});

test('graph challenge verifies path validity, not just claimed cost', () => {
  const g = getChallenge('reason.graph');
  const lie = g.verify(`FINAL: {"cost": ${g.expected.cost}, "path": ["A","H"]}`);
  assert.equal(lie.checks[0].ok, true);
  assert.equal(lie.checks[1].ok, false);
});

test('challenges are deterministic and public view hides answers', () => {
  const again = listChallenges().map((c) => c.promptHash);
  assert.equal(new Set(again).size, again.length);
  for (const c of listChallenges()) {
    const pub = publicChallenge(c);
    assert.equal(pub.expected, undefined);
    assert.equal(pub.referenceAnswer, undefined);
    assert.equal(pub.verify, undefined);
  }
});

test('extraction ignores reasoning blocks and takes the last FINAL', () => {
  assert.equal(extractFinal('<think>FINAL: 1</think> FINAL: 2'), '2');
  assert.equal(extractFinal('FINAL: 1\nactually FINAL: 7'), '7');
  assert.equal(stripThinking('<think>never closed FINAL: 9'), '');
  assert.equal(extractFinal('no marker'), null);
  assert.equal(parseIntegerAnswer('1,234.'), 1234n);
  assert.equal(parseIntegerAnswer('about 12'), null);
  assert.deepEqual(parseJsonLoose('```json\n{"a":[1,{"b":"}"}]}\n``` trailing'), { a: [1, { b: '}' }] });
});
