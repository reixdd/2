import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=()=>readFileSync(new URL('../dist/live-research.js',import.meta.url),'utf8');
const css=()=>readFileSync(new URL('../dist/live-research.css',import.meta.url),'utf8');
test('Meme Radar is moved above agent activity without duplicating the source section',()=>{
 assert.match(js(),/insertBefore\(conceptSection,activitySection\)/);
});
test('Live events are sourced from activity_events through public API, not canned old results',()=>{
 assert.match(js(),/api\/activity\?limit=/);
 assert.match(js(),/formatActivity/);
 assert.match(js(),/EventSource\('/);
});
test('Existing GIF/images render in square no-crop tile and survive 1-second clock ticks',()=>{
 assert.match(css(),/\.market-card-image\s*\{[^}]*aspect-ratio:\s*1(?:\s*\/\s*1)?/);
 assert.match(css(),/\.market-card-image img\s*\{[^}]*object-fit:\s*contain/);
 assert.match(js(),/MarketFeed/);
});
test('Agent activity and concept cards have sourced image portraits and compact prompt-line UI',()=>{
 assert.match(js(),/agentPortrait/);
 assert.match(js(),/conceptArtwork/);
 assert.match(css(),/\.terminal-event-copy/);
 assert.match(css(),/prefers-reduced-motion:\s*reduce/);
});
