/** QA ONLY: verify real browser inference; HTTPS bytes are forwarded, never model responses. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {chromium} from '@playwright/test';
const root=path.resolve(import.meta.dirname,'..'),base=process.env.COLOSSEUM_QA_URL||'http://127.0.0.1:8792',cache=path.join(root,'.runtime-cache');
fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(path.join(root,'.validation/phase4'),{recursive:true});
const research=JSON.parse(fs.readFileSync(path.join(root,'data/model-research.json'),'utf8'));
const models=[['small-spark','onnx-community/SmolLM2-135M-Instruct-ONNX'],['qwen25-sage','onnx-community/Qwen2.5-0.5B-Instruct'],['capybara-sage','onnx-community/Qwen3-0.6B-ONNX']];
const metadata=new Map(),log=[];
async function hash(file){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex')}
for(const [,id]of models){const revision=research.find(r=>r.id===id).revision;const r=await fetch(`https://huggingface.co/api/models/${id}/revision/${revision}?blobs=true`);if(!r.ok)throw Error(`Artifact metadata HTTP ${r.status}`);metadata.set(id,{revision,files:(await r.json()).siblings});}
// Downloads write to a temporary file; interrupted bytes cannot poison the cache.
const artifactServer=http.createServer((req,res)=>{const key=new URL(req.url,'http://validation.local').pathname.slice(1);if(!/^[a-f0-9]{64}$/.test(key)||!fs.existsSync(path.join(cache,key))){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':'application/octet-stream','Access-Control-Allow-Origin':'*','Content-Length':fs.statSync(path.join(cache,key)).size});fs.createReadStream(path.join(cache,key)).pipe(res)});
await new Promise(resolve=>artifactServer.listen(8794,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
page.on('dialog',dialog=>dialog.accept());
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));page.on('crash',()=>console.log('BROWSER CRASH'));
await context.route(/^https:\/\/huggingface\.co\//,async route=>{try{
 const url=route.request().url(),u=new URL(url),match=u.pathname.match(/^\/(onnx-community\/[^/]+)\/resolve\/([^/]+)\/(.+)$/);
 if(!match||!metadata.has(match[1])||match[2]!==metadata.get(match[1]).revision)throw Error('Unexpected unpinned artifact request '+u.pathname);
 const item=metadata.get(match[1]).files.find(f=>f.rfilename===match[3]);
 if(!item){await route.fulfill({status:404,body:'Artifact not present in pinned repository.'});return}
 const key=crypto.createHash('sha256').update(url).digest('hex'),file=path.join(cache,key),expected=item.lfs?.sha256;
 if(!fs.existsSync(file)){
  // Reuse older downloaded bytes only when their hash matches this pinned artifact.
  const older='/workspace/colosseum/.validation/http-artifacts';let reused=false;
  if(expected&&fs.existsSync(older)){for(const name of fs.readdirSync(older)){const candidate=path.join(older,name);if(fs.statSync(candidate).size===item.size&&await hash(candidate)===expected){fs.linkSync(candidate,file);reused=true;break}}}
  if(!reused){const response=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('HTTPS artifact HTTP '+response.status);const partial=file+'.partial';try{await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(partial));fs.renameSync(partial,file)}catch(e){fs.rmSync(partial,{force:true});throw e}}
 }
 const actual=await hash(file);if(expected&&expected!==actual){fs.unlinkSync(file);throw Error('Pinned artifact checksum mismatch')}
 const entry={url,bytes:fs.statSync(file).size,sha256:actual,upstreamLfsChecksumVerified:!!expected};log.push(entry);console.log('ARTIFACT',match[1],match[3],entry.bytes);
 await route.fulfill({status:302,headers:{Location:`http://127.0.0.1:8794/${key}`,'Access-Control-Allow-Origin':'*'},body:''});
}catch(e){console.log('ARTIFACT ERROR',e.message);await route.abort('failed')}});
const results=[];let heartbeat;
try{
 for(const [contenderId,id]of models){
  await page.goto(base+'/contenders');await page.getByLabel('Direct model selection').selectOption(contenderId);const confirm=page.getByRole('button',{name:'Confirm model selection',exact:true});if(await confirm.count())await confirm.click();await page.getByRole('link',{name:'Prepare / enter challenge',exact:true}).click();await page.getByRole('button',{name:'Local AI execution',exact:true}).click();await page.getByRole('checkbox',{name:'I consent to download this model to my device.',exact:true}).check();await page.getByRole('button',{name:'Prepare model',exact:true}).click();
  heartbeat=setInterval(async()=>{try{console.log('PROGRESS',id,(await page.locator('.download-consent [role="status"]').innerText()).slice(0,200))}catch{}},15000);
  await page.getByRole('button',{name:'Start local battle',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Start local battle'&&!b.disabled)||/FAILED|Initialization failed|Failed to fetch/i.test(document.querySelector('.download-consent [role="status"]')?.textContent??''),{},{timeout:300000});clearInterval(heartbeat);
  if(await page.getByRole('button',{name:'Start local battle',exact:true}).isDisabled())throw Error('Preparation failed: '+await page.locator('.download-consent [role="status"]').innerText());
  console.log('INITIALIZED',id);await page.getByRole('button',{name:'Start local battle',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.encounter-status')?.textContent!=='Awaiting your challenge');
  heartbeat=setInterval(async()=>{try{console.log('GENERATING',id,(await page.locator('.encounter-status').innerText()).slice(0,150))}catch{}},15000);
  await page.waitForFunction(id=>{try{return JSON.parse(localStorage.getItem('colosseum:local-ai-evidence:v1')||'[]').some(e=>e.modelId===id)}catch{return false}},id,{timeout:300000});clearInterval(heartbeat);
  const evidence=await page.evaluate(id=>JSON.parse(localStorage.getItem('colosseum:local-ai-evidence:v1')).find(e=>e.modelId===id),id);results.push(evidence);fs.writeFileSync(path.join(root,'.validation/phase4/browser-model-results.json'),JSON.stringify({transport:'Pinned HTTPS artifacts fetched with TLS verification and forwarded over private loopback HTTP; actual computation in Chromium Web Worker',browser:await browser.version(),results,artifacts:log},null,2));console.log('RESULT',JSON.stringify({model:evidence.modelId,status:evidence.status,correct:evidence.correct,output:evidence.output,latencyMs:evidence.latencyMs,error:evidence.error}));
  if(evidence.status!=='completed')throw Error(id+' did not complete genuine generation.');
  await page.screenshot({path:path.join(root,'.validation/phase4',contenderId+'-generation.png'),fullPage:false});
 }
 fs.writeFileSync(path.join(root,'data/browser-verified-captures.json'),JSON.stringify({schemaVersion:1,note:'Actual release QA captures; owner-curated, client-controlled, not independently attested. Browser CPU results do not prove readiness on another device.',records:results},null,2));
 console.log('All configured browser models initialized and produced actual deterministically graded outputs.');
}finally{clearInterval(heartbeat);await browser.close();artifactServer.close()}
