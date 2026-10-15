// Current DIT terminal browser acceptance. The archived V7 smoke suite is separate.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chrome=process.env.CHROMIUM_PATH||'/usr/bin/google-chrome';
if(!existsSync(chrome))throw Error('Set CHROMIUM_PATH to an installed Chrome/Chromium executable');
const scratch=await mkdtemp(path.join(os.tmpdir(),'dit-command-acceptance-'));
const output=path.join(root,'.qa');
await mkdir(output,{recursive:true});
const port=await new Promise((resolve,reject)=>{
 const server=createServer();
 server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});
});
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server/local.mjs'],{
 cwd:root,
 env:{...process.env,PORT:String(port),DIT_STORE:'file',
  DIT_STORE_FILE:path.join(scratch,'state.json'),DIT_AUTONOMOUS:'0',
  DIT_START_SCHEDULER:'0',DIT_LLM_PROVIDER:'off',DIT_DEV_AUTH:'1'},
 stdio:['ignore','pipe','pipe']
});
let log='';
child.stdout.on('data',data=>log+=String(data).slice(-1500));
child.stderr.on('data',data=>log+=String(data).slice(-1500));
let browser;
try{
 let ready=false;
 for(let i=0;i<50;i++){
  if(child.exitCode!==null)throw Error('DIT server exited unexpectedly: '+log);
  try{const result=await fetch(base+'/api/config');if(result.ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,300));
 }
 assert.ok(ready,'Local DIT server must respond on localhost: '+log);
 browser=await chromium.launch({executablePath:chrome,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('.dit-room').waitFor({timeout:25000});
 await page.locator('.market-source-warning').waitFor({timeout:20000});
 assert.equal(await page.locator('#dit-live-evidence .live-row').count(),0,'source research headlines cannot impersonate market pairs');
 assert.equal(await page.locator('.dit-entity').count(),3,'three original HD character controls');
 await page.locator('.terminal-code-bg--left').waitFor({timeout:15000});
 await page.locator('.terminal-code-bg--right').waitFor({timeout:15000});
 const sideRails=await page.locator('.terminal-code-bg').evaluateAll(nodes=>nodes.map(n=>({
  rows:n.textContent.split('\n').length,top:n.getBoundingClientRect().top,
  bottom:n.getBoundingClientRect().bottom,color:getComputedStyle(n).color
 })));
 assert.equal(sideRails.length,2,'left and right full-height terminal wallpapers');
 for(const rail of sideRails){assert.ok(rail.rows>=50);assert.ok(rail.top<=0&&rail.bottom>=899);}

 assert.equal(await page.locator('#dit-room-pairs').count(),1);
 assert.equal(await page.locator('#dit-treasury-target').count(),1);
 assert.equal(await page.locator('#dit-gfx-toggle').getAttribute('aria-pressed'),'false','HD art is the default');
 assert.equal(await page.locator('#dit-stage-canvas').count(),0,'no expensive canvas initialized by default');
 await page.locator('#dit-gfx-toggle').click();
 assert.equal(await page.locator('#dit-gfx-toggle').getAttribute('aria-pressed'),'true');
 await page.locator('#dit-stage[data-renderer]').waitFor({timeout:30000});
 const mode=await page.locator('#dit-stage').getAttribute('data-renderer');
 assert.ok(['webgl','fallback'].includes(mode),'optional renderer reports GPU or fallback');
 if(mode==='fallback'){
  const canvasDisplay=await page.locator('#dit-stage-canvas').evaluate(el=>getComputedStyle(el).display);
  assert.equal(canvasDisplay,'none','no frozen duplicate shader');
 }else{
  const opacity=await page.locator('.dit-entity-art').first().evaluate(el=>getComputedStyle(el).opacity);
  assert.equal(Number(opacity),1,'native portraits remain grounded while WebGL renders atmosphere only');
 }
 await page.locator('#dit-gfx-toggle').click();
 assert.equal(await page.locator('#dit-gfx-toggle').getAttribute('aria-pressed'),'false');
 await page.locator('#dit-nav-system').click();
 assert.equal(await page.locator('#dit-hud-system').isVisible(),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#dit-hud-system').isVisible(),false);
 await page.locator('#dit-appearance').click();
 assert.equal(await page.locator('#dit-appearance').getAttribute('aria-pressed'),'true');
 const contract='So11111111111111111111111111111111111111112';
 await page.route('**/api/agents/GHOST_001',route=>route.fulfill({json:{
  activity:[],research_runs:[],observations:[
   {title:'Unrelated mainstream source',url:'https://example.org/random-story',observed_at:new Date().toISOString()},
   {external_id:'dsp:'+contract,evidence:{token_address:contract,x_url:'https://twitter.com/OriginalCoin'},observed_at:new Date().toISOString()}
  ]
 }}));
 await page.locator('[data-room-agent="GHOST_001"]').first().click();
 assert.equal(await page.locator('#dit-live-dialog').isVisible(),true,'interactive real dossier');
 assert.equal(await page.locator('#dit-live-modal-body a[href="https://x.com/OriginalCoin"]').count(),1,
   'exact-contract source-associated X handle appears as a working safe link');
 assert.equal(await page.locator('#dit-live-modal-body a[href="https://example.org/random-story"]').count(),0,
   'unrelated cultural articles excluded from supporting evidence');

 await page.locator('#dit-live-close').click();
 await page.locator('.dit-entity[data-id="GHOST_001"] [data-vote]').click();
 await page.locator('#identity-email').waitFor({timeout:5000});
 await page.locator('#dit-live-close').click();
 await page.locator('#dit-nav-transmissions').click();
 assert.equal(await page.locator('#dit-live-transmission-section').isVisible(),true);
 await page.locator('#dit-nav-network').click();
 assert.equal(await page.locator('#dit-live-evidence-section').isVisible(),true);
 await page.screenshot({path:path.join(output,'command-deck-1440.png'),fullPage:false});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(output,'command-deck-mobile.png'),fullPage:false});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 if(overflow>5){const offenders=await page.evaluate(()=>[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName.toLowerCase(),id:el.id,cls:String(el.className).slice(0,70),right:Math.round(r.right),width:Math.round(r.width),left:Math.round(r.left)}}).filter(x=>x.right>innerWidth+5&&x.width>0).sort((a,b)=>b.right-a.right).slice(0,12));console.log('[mobile overflow culprits]',JSON.stringify(offenders));}
 assert.ok(overflow<=5,'no unexpected horizontal overflow at mobile viewport: '+overflow);

 // Populated browser test: an actual decoded PNG, not a text-only metadata assertion.
 await page.setViewportSize({width:1440,height:900});
 let marketReplies=0,imageRequests=0;
 const imageUrl='https://cdn.example.org/market-art.png';
 const newlyLaunched=new Date(Date.now()-30_000).toISOString();
 const olderPair=new Date(Date.now()-900_000).toISOString();
 const addressNew='So11111111111111111111111111111111111111112';
 const addressOld='11111111111111111111111111111111';
 await page.route('https://cdn.example.org/market-art.png',async route=>{
   imageRequests++;
   await route.fulfill({status:200,contentType:'image/png',
     body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZlGxx8AAAAASUVORK5CYII=','base64')});
 });
 await page.route('**/operator/api/market',async route=>{
   marketReplies++;
   const seen=new Date(Date.now()-1000).toISOString();
   const signals=[
     {address:addressNew,chain:'sol',symbol:'ART',name:'Artwork verified',
      kind:'trenches',provider:'GMGN via JARVIS',pair_created_at:newlyLaunched,pair_time_verified:true,
      observed_at:seen,source_observed_at:seen,image_url:marketReplies===1?imageUrl:null,
      volume_5m_usd:1200,buys_5m:15,sells_5m:4,twitter_url:'https://x.com/OriginalCoin',url:'https://gmgn.ai/sol/token/'+addressNew},
     {address:addressOld,chain:'sol',symbol:'OLD',name:'Older active market',
      kind:'tape',provider:'JARVIS',pair_created_at:olderPair,pair_time_verified:true,
      observed_at:seen,source_observed_at:seen,image_url:null,
      volume_5m_usd:250,buys_5m:5,sells_5m:3,url:'https://gmgn.ai/sol/token/'+addressOld}
   ];
   await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({signals,source_states:{tape:'OK',trenches:'OK'},stale:false,
       last_checked_at:seen,status:'LIVE'})});
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#dit-live-filter').selectOption('new');
 await page.locator('.market-card-image img').waitFor({timeout:18000});
 await page.waitForFunction(()=>document.querySelector('.market-card-image img')?.naturalWidth>0,null,{timeout:10000});
 assert.equal(await page.locator('.market-card').count(),1,'NEW only shows verified recent pair launches');
 assert.equal(await page.locator('.market-x-link[href="https://x.com/OriginalCoin"]').count(),1,
   'observed token X link is source-provided and clickable');
 await page.evaluate(()=>{window.__verifiedArtNode=document.querySelector('.market-card-image img')});
 await page.waitForTimeout(4200);
 assert.ok(marketReplies>=3,'several populated market updates reached the browser');
 assert.equal(await page.evaluate(()=>window.__verifiedArtNode===document.querySelector('.market-card-image img')),true,
   'decoded image node is preserved across updates that omit metadata');
 assert.equal(imageRequests,1,'successfully loaded artwork is not re-downloaded at each poll');
 await page.locator('#dit-live-filter').selectOption('all');
 assert.equal(await page.locator('.market-card').count(),2,'ALL shows older observed tokens alongside real new pairs');
 await page.locator('#dit-live-filter').selectOption('new');
 assert.equal(await page.locator('.market-card').count(),1,'old actively traded token is not newly created');
 await page.screenshot({path:path.join(output,'populated-market-with-artwork.png'),fullPage:false});

 // Final Radar acceptance: three authentic agent ideas with actual decoded SVG illustrations.
 await page.route(url=>url.pathname==='/api/concepts'&&url.searchParams.get('limit')==='24',route=>route.fulfill({json:{
  concepts:[
   ...['GHOST_001','NULL_ENTITY','ECHO.exe'].map((agent_id,i)=>({
    id:'featured-'+i,agent_id,status:'review',created_at:new Date(Date.now()-i*1000).toISOString(),
    content:{name:['GHOST01','VOIDPAY','DEADNET'][i],ticker:['GSTM','VPAY','DNET'][i],
     artwork_brief:['glowing hooded ghost','void bank account','broken internet signal'][i],
     ...(i===0?{image_url:imageUrl}:{}),hook:'Agent research concept'}
   })),
   {id:'older',agent_id:'GHOST_001',status:'review',created_at:new Date(Date.now()-20000).toISOString(),
    content:{name:'ARCHIVED GHOST',ticker:'OLD'}}
  ],next_before:null
 }}));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-dit-tab="radar"]').click();
 try{await page.locator('.terminal-concept-card').first().waitFor({timeout:10000});}
 catch(error){
  console.log('[RADAR acceptance diagnostics]',JSON.stringify(await page.evaluate(()=>({
   location:location.href,tab:document.querySelector('#dit-live-concept-section')?.hidden,
   cardCount:document.querySelectorAll('.terminal-concept-card').length,
   html:document.querySelector('#dit-live-concepts')?.innerHTML.slice(0,350)
  }))));
  console.log('[RADAR page errors]',JSON.stringify(errors));
  throw error;
 }
 assert.equal(await page.locator('.terminal-concept-card').count(),3,'one featured recorded idea per research agent');
 await page.waitForFunction(()=>[...document.querySelectorAll('.terminal-concept-image img')].length===3&&
  [...document.querySelectorAll('.terminal-concept-image img')].every(img=>img.complete&&img.naturalWidth>0),null,{timeout:12000});
 assert.equal(await page.locator('.terminal-concept-image img[src^="data:image/svg+xml"]').count(),2,
  'two concepts without real artwork display decoded vector fallbacks');
 assert.equal(await page.locator('.terminal-concept-image img[src^="https://cdn.example.org/market-art.png"]').count(),1,
  'the provided original art displays ahead of a synthetic vector study');
 await page.locator('#dit-live-concept-section').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(output,'curated-agent-radar.png'),fullPage:false});
 await page.getByText('BROWSE IDEA ARCHIVE',{exact:true}).click();
 assert.equal(await page.locator('.terminal-concept-card').count(),4,'history loads only after explicit archive click');

 assert.deepEqual(errors,[],'no page-level script errors');
 console.log('[command-deck] Browser acceptance PASSED; renderer='+mode);
}finally{
 await browser?.close();
 child.kill();
 await rm(scratch,{recursive:true,force:true});
}
