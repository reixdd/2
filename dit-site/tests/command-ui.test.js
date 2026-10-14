import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../dist/command.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../dist/command.css', import.meta.url), 'utf8');
const stage = fs.readFileSync(new URL('../dist/stage.js', import.meta.url), 'utf8');

test('compact command view features one agent display with embedded voting', () => {
  assert.match(html,/id="dit-stage"/);
  assert.doesNotMatch(html,/id="agent-grid"|id="dit-vote-board"|id="archive-list"/);
  assert.match(stage,/data-vote=/);
  for(const id of ['GHOST_001','NULL_ENTITY','ECHO.exe'])assert.ok(stage.includes(id));
});
test('background covers the shell with three distinct subdued agent colors', () => {
  assert.match(css,/url\('assets\/hero.webp'\)/);
  assert.match(css,/position:fixed;inset:0/);
  assert.match(css, /--ghost:#9bdde5/);
  assert.match(css, /--null:#b9a6e3/);
  assert.match(css, /--echo:#b6d6aa/);
  assert.match(stage,/uniform vec3 accent/);
  assert.doesNotMatch(stage,/0xff2020|0xff3030|0x7a0e0e/);
});
test('network panel offers proposals, on-chain verification and evidence without auto-launch', () => {
 assert.match(script,/\/api\/proposals/);
 assert.match(script,/\/api\/verify\?signature=/);
 assert.match(script,/#evidence\//);
 assert.match(script,/verifiedTradeUrl/);
 assert.doesNotMatch(script,/--broadcast|secret.key|DIT_AGENT_SECRET_KEY/);
});
