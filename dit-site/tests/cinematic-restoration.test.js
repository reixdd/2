import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conceptArtwork} from '../dist/terminal-ui.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('active terminal mounts the original cinematic WebGL stage without replacing market controls',()=>{
 const home=read('../dist/index.html');
 const room=read('../dist/control-room.js'),live=read('../dist/live-research.js'),css=read('../dist/control-room.css');
 assert.match(room,/id="dit-stage"/);
 assert.match(live,/import\(['"]\.\/stage\.js['"]\)/);
 assert.match(css,/hero\.webp/);
 assert.match(css,/\[data-renderer="webgl"\]/);
 for(const s of ['dit-live-evidence-section','dit-live-concept-section','dit-live-transmission-section'])assert.ok(home.includes(s));
 for(const s of ['volume_5m_usd','buys_5m','sells_5m','marketStructureKey'])assert.ok(live.includes(s));
});

test('archived Three.js renderer supports background-only mode and does not require old dossier labels',()=>{
 const stage=read('../dist/stage.js');
 assert.match(stage,/const ambient\s*=\s*host\.dataset\.mode\s*===\s*['"]ambient['"]/);
 assert.match(stage,/(?:note\?\.textContent|if\(note\)\s*note\.textContent)/);
 assert.match(stage,/it\.label\?\.style/);
 assert.match(stage,/createQualityController/);
});

test('Meme Radar resolves actual observed token artwork by contract address',()=>{
 const address='So11111111111111111111111111111111111111112';
 const c={agent_id:'ECHO.exe',source_refs:[{address}],content:{name:'Example'}};
 const art=conceptArtwork(c,[{address:'OtherMint111111111111111111111111111111111',image_url:'https://images.example.org/wrong.webp'},{address,image_url:'https://images.example.org/actual.webp'}]);
 assert.equal(art.url,'https://images.example.org/actual.webp');
 assert.equal(art.kind,'evidence');
 assert.match(art.label,/NOT CONCEPT ART/);
});

test('Meme Radar keeps an honest broken-image fallback without substituting agent images',()=>{
 const live=read('../dist/live-research.js');
 assert.match(live,/terminal-art-fallback/);
 assert.match(live,/addEventListener\(['"]error['"]/);
 assert.equal(conceptArtwork({agent_id:'GHOST_001',source_refs:[],content:{}},[]).url,null);
});


test('concept-reference command deck keeps real state in a compact left rail and centered agent stage',()=>{
 const room=read('../dist/control-room.js');
 const css=read('../dist/control-room.css');
 assert.match(room,/dit-ops-rail/);
 assert.match(room,/dit-room-live/);
 assert.match(room,/dit-room-agent-strip/);
 assert.match(css,/\.dit-entity-stage\s*>\s*#dit-stage/);
 assert.match(css,/\.dit-room\s*\{/);
});
test('laggy WebGL automatically yields to the anchored HD portrait fallback',async()=>{
 const {createFrameGuard}=await import('../dist/stage-quality.js');
 const guard=createFrameGuard(120,3);
 assert.equal(guard.sample(40),false);
 assert.equal(guard.sample(962),false);
 assert.equal(guard.sample(700),false);
 assert.equal(guard.sample(600),true);
 const stage=read('../dist/stage.js');
 assert.match(stage,/guard\.sample\(/);
 assert.match(stage,/dataset\.performance\s*=\s*'slow'/);
 assert.match(stage,/ambient\s*\?\s*false\s*:\s*!small/);
});
test('the visible market UI never calls delayed source observations stale or passes them off as live',()=>{
 const room=read('../dist/control-room.js');
 const research=read('../dist/live-research.js');
 assert.doesNotMatch(room,/'STALE'/);
 assert.doesNotMatch(research,/STALE —/);
 assert.match(research,/LAST VERIFIED/);
 assert.match(room,/LAST VERIFIED/);
 for(const field of ['volume_5m_usd','buys_5m','sells_5m','marketStructureKey'])assert.match(research,new RegExp(field));
});

test('performance fallback removes the GPU canvas instead of leaving a duplicate portrait',()=>{
 const css=read('../dist/control-room.css');
 const stage=read('../dist/stage.js');
 assert.match(css,/#dit-stage-canvas\[hidden\]\s*\{\s*display:none!important/);
 assert.match(stage,/canvas\.hidden\s*=\s*true/);
});
test('reference-style HUD has real actions, verified accounting and a live event ribbon',()=>{
 const room=read('../dist/control-room.js');
 const live=read('../dist/live-research.js');
 for(const k of ['dit-nav-network','dit-nav-transmissions','dit-nav-system','dit-appearance','dit-gfx-toggle','dit-hud-expand','dit-treasury','dit-transmission-ribbon'])assert.match(room,new RegExp(k));
 assert.match(live,/\/api\/treasury/);
 assert.match(room,/data-room-agent/);
 assert.match(room,/updateControlRoom/);
 assert.match(room,/dit-hud-system/);
});
test('agent visuals use independent blue, violet and green accents and constrained width',()=>{
 const css=read('../dist/control-room.css');
 assert.match(css,/#6bbdff/);
 assert.match(css,/#ce86ff/);
 assert.match(css,/#86edb4/);
 assert.match(css,/max-width:\s*min\(90vw,1720px\)/);
});
test('terminal retains backend failure evidence and handles exhausted cycle attempts explicitly',()=>{
 const room=read('../dist/control-room.js');
 assert.match(room,/job_dead/);
 assert.match(room,/failure/);
 assert.match(room,/OPEN OPERATOR/);
 const sch=read('../worker/scheduler.js');
 assert.match(sch,/maxAttempts/);
});

test('reference VOTE controls use authenticated backend vote endpoint, not a dead placeholder',()=>{
 const room=read('../dist/control-room.js');
 const live=read('../dist/live-research.js');
 assert.match(room,/data-vote/);
 assert.match(live,/\/api\/vote/);
 assert.match(live,/dit:vote-identity/);
 assert.match(live,/authorization:\s*['"]Bearer ['"]/);
 assert.match(live,/identity-email/);
});

test('New Pairs never substitutes general cultural research observations for token cards',()=>{
 const live=read('../dist/live-research.js');
 assert.doesNotMatch(live,/\$\('dit-live-evidence'\)\.innerHTML=rows\.length/);
 assert.match(live,/MARKET SOURCE UNAVAILABLE/);
 assert.match(live,/source_states/);
 assert.match(live,/source_observed_at/);
});
test('front page actual token cards have missing-image and pair-age states',()=>{
 const live=read('../dist/live-research.js');
 assert.match(live,/market-card-image/);
 assert.match(live,/market-image-error/);
 assert.match(live,/data-stat="mc"/);
 assert.match(live,/data-stat="age"/);
});

test('transmissions are a compact telemetry ribbon and obsolete gold CSS patch is removed',()=>{
 const css=read('../dist/control-room.css');
 const js=read('../dist/control-room.js');
 assert.doesNotMatch(css,/CINEMATIC COMMAND DECK v2/);
 assert.match(css,/\.dit-transmission-ribbon/);
 assert.match(css,/\.dit-transmission-ribbon\s+time/);
 assert.match(js,/document\.createElement\('time'\)/);
 assert.match(js,/button\.dataset\.liveEvent/);
});

test('HD cutouts and the animated city load without expensive WebGL until GFX is requested',()=>{
 const room=read('../dist/control-room.js'),live=read('../dist/live-research.js');
 assert.match(room,/classList\.add\('dit-functional-stage','dit-gfx-off'\)/);
 assert.match(room,/id="dit-gfx-toggle" aria-pressed="false">GFX OFF/);
 assert.match(live,/dit:gfx/);
 assert.match(live,/if\(e\.detail\?\.enabled\)/);
});

test('spectral phosphor is the coherent structural palette without old pink overlays or Echo ring',()=>{
 const css=read('../dist/control-room.css'),live=read('../dist/live-research.css');
 for(const hex of ['#030606','#192522','#A4BDB1','#E8FFB7','#6D7771'])
   assert.match(css,new RegExp(hex,'i'));
 assert.doesNotMatch(css,/#(?:ec6cff|cb8eff|df87fd|d58be5|e390ff)/i);
 assert.match(css,/\.dit-entity-ring\{display:none/);
 assert.match(live,/--dit-mint:\s*#E8FFB7/i);
});
test('premium skip-to-market control remains accessible and keyboard-focus visible',()=>{
 const css=read('../dist/control-room.css'),html=read('../dist/index.html');
 assert.match(html,/class="dit-skip"/);
 assert.match(css,/\.dit-skip:focus-visible/);
});
