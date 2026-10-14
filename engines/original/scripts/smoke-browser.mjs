import { chromium } from '@playwright/test';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.validation');
fs.mkdirSync(out, { recursive: true });
let server, progress;
try { if (!(await fetch('http://127.0.0.1:8789')).ok) throw new Error('not ready'); }
catch { server = spawn(process.execPath, ['scripts/serve-public.mjs'], { cwd: root, stdio: 'inherit' });
  for (let i=0; i<50; i++) { try { if ((await fetch('http://127.0.0.1:8789')).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
}
import fs from 'node:fs';
import crypto from 'node:crypto';
const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless:true, args:[] });
const page = await browser.newPage();
page.on('crash',()=>console.log('Chromium renderer crashed'));
browser.on('disconnected',()=>console.log('Chromium disconnected'));
page.on('pageerror', (e)=>console.log('PAGE ERROR '+e.message.slice(0,200)));
let bytes=0;
// Preserve trusted HTTPS verification in Node. Forward REAL upstream artifacts,
// never inference responses. Chromium does all actual model computation.
await page.route(/^https:\/\/(?:huggingface\.co|raw\.githubusercontent\.com)\//, async route => {
  try {
    const url=route.request().url();
    const r=await fetch(url,{signal:AbortSignal.timeout(120000)});
    if (!r.ok) throw new Error('Official artifact HTTP '+r.status);
    const body=Buffer.from(await r.arrayBuffer()); bytes+=body.length;
    console.log(JSON.stringify({artifactHost:new URL(url).hostname,file:new URL(url).pathname.split('/').at(-1),bytes:body.length}));
    // Browser devtools cannot carry >100 MiB in one message. Serve REAL bytes
    // over ordinary same-origin HTTP after a small redirect, preserving CSP.
    const key = crypto.createHash('sha256').update(url).digest('hex');
    const cache = path.join(out, 'http-artifacts'); fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(path.join(cache,key),body);
    await route.fulfill({status:302,headers:{Location:`http://127.0.0.1:8789/__validation/${key}`,'Access-Control-Allow-Origin':'*'},body:''});
  } catch(e) {console.log('ARTIFACT ERROR '+e.message); await route.abort('failed');}
});
try {
  await page.goto('http://127.0.0.1:8789');
  for (const name of ['SmolLM','Qwen 2.5']) {
    const row=page.locator('.model-download').filter({hasText:name});
    const b=row.getByRole('button');
    await b.click({timeout:30000});
    await page.waitForFunction(name=>[...document.querySelectorAll('.model-download')].find(e=>e.textContent.includes(name))?.textContent.includes('Weights validated')||!!document.querySelector('.device-actions .err'),name,{timeout:240000});
    const err=await page.locator('.device-actions .err').allTextContents();
    if (err.length) throw new Error(err.join('; '));
    console.log(name+' REAL weights initialized');
  }
  for (const name of ['Qwen 2.5 · 0.5B','SmolLM 2 · 135M']) await page.locator('label.pick').filter({hasText:name}).locator('input').check();
  // Modest token cap keeps software-GPU validation practical. Both contestants
  // receive identical input and the same budget; these are recorded overrides.
  const runtimePath=fs.readdirSync(path.join(root,'client/public-dist/assets')).find(n=>/^runtime-.*\.js$/.test(n));
  progress=setInterval(async()=>{ try { console.log(JSON.stringify(await page.evaluate(async runtime=>{const m=await import('/assets/'+runtime);const a=await m.getBrowserArena();if(!window.__realBattle)return {phase:'preparing'};const b=await a.api('/battles/'+window.__realBattle);return {status:b.status,entries:b.entries.map(e=>({status:e.status,chars:e.output.length,error:e.error}))};},runtimePath))); } catch{} },15000);
  await page.evaluate(async runtime=>{ const module=await import('/assets/'+runtime); const a=await module.getBrowserArena(); const b=await a.api('/battles',{method:'POST',body:JSON.stringify({challengeId:'math.warmup',entrants:(await a.api('/contenders')).contenders.filter(c=>c.operational&&c.kind==='model').map(c=>({contenderId:c.id,overrides:{maxTokens:32}}))})}); window.__realBattle=b.battleId; await a.stream(b.battleId,()=>{}); },runtimePath);
  clearInterval(progress);

  const runtime=fs.readdirSync(path.join(root,'client/public-dist/assets')).find(n=>/^runtime-.*\.js$/.test(n));
  const record=await page.evaluate(async runtime=>{const module=await import('/assets/'+runtime);const a=await module.getBrowserArena();return a.api('/battles/'+window.__realBattle);},runtime);
  record.environment.validationTransport='Official HTTPS artifacts forwarded by Node with TLS verification; real computation on the recorded browser backend';
  fs.writeFileSync(path.join(out,'browser-real.json'),JSON.stringify(record,null,2));
  console.log(JSON.stringify({battleId:record.battleId,status:record.status,bytes,entries:record.entries.map(e=>({model:e.model,status:e.status,output:e.output,score:e.verification?.score,latency:e.latency,error:e.error}))},null,2));
  await page.getByRole('button',{name:'Battle Archive',exact:true}).click();
  await page.locator('.ledger-row').first().click();
  await page.screenshot({path:path.join(out,'browser-real.png'),fullPage:true});
  if(record.entries.some(e=>e.status!=='COMPLETED')) throw new Error('Real browser evaluation had failed entries');
} catch(e) {console.log('DEVICE VERIFICATION FAILED '+e.message.slice(0,500));process.exitCode=1;}
finally {clearInterval(progress); await browser.close(); server?.kill();}
