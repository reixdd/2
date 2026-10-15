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
 assert.match(stage,/note\?\.textContent/);
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
