import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const src = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8');

test('cinematic HUD layers its orbital accents behind the real agent canvas', () => {
  const stage = src('stage.js');
  assert.match(stage, /class="hud-orbit-field" aria-hidden="true"/);
  assert.match(stage, /hud-orbit-left/);
  assert.match(stage, /hud-orbit-center/);
  assert.match(stage, /hud-orbit-right/);
  assert.match(stage, /id="dit-stage-canvas"/);
  assert.ok(stage.indexOf('hud-orbit-field') < stage.indexOf('id="dit-stage-canvas"'));
});

test('HUD identity panels retain live wiring and accessible actions for all three agents', () => {
  const stage = src('stage.js');
  assert.match(stage, /AGENTS\.map\(\(a,i\) =>/);
  assert.match(stage, /data-stage-state=/);
  assert.match(stage, /data-stage-open=/);
  assert.match(stage, /data-stage-more=/);
  assert.match(stage, /data-vote=/);
  assert.match(stage, /style\.setProperty\("--label-x"/);
});

test('cinematic effects respect reduced motion and mobile layout', () => {
  const css = src('reference-v7.css');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.hud-orbit::before \{animation:none;\}/);
  assert.match(css, /@media \(max-width: 800px\)/);
  assert.match(css, /\.hud-orbit-field/);
  assert.match(css, /\.dit-stage-label\s*\{/);
});

test('only the original read-only API remains responsible for displaying real data', () => {
  const html = src('index.html');
  assert.match(html, /id="dit-stage-note">AWAITING BACKEND/);
  assert.match(html, /id="dit-activity"/);
  assert.match(html, /id="dit-treasury"/);
  assert.doesNotMatch(html, /FAKE LIVE|DEMO VOTES/);
});
