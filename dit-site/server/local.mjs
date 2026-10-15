// One-process local development server: static site + verified API + file-persisted research worker.
// Not a production deployment or a substitute for Supabase Auth/RLS.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { openFileStore } from './lib/store-file.js';
import { createStore, supabaseUrlFromEnv } from './lib/store-core.js';
import { Operator } from './operator.mjs';
import { AutonomousResearch } from './autonomous.mjs';
import { bootstrap } from '../worker/bootstrap.js';
import { Scheduler } from '../worker/scheduler.js';
import { createLlm } from '../worker/llm.js';
import { voteTotals } from './lib/votes.js';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={...process.env};
const sharedUrl=supabaseUrlFromEnv(env);
// A local DIT operator can reuse an existing JARVIS core without creating a second
// research scheduler or sending competing requests to Ollama.
if(env.DIT_JARVIS_SHARED==='1')env.DIT_START_SCHEDULER='0';
if ((sharedUrl && !env.SUPABASE_SERVICE_ROLE_KEY)||(!sharedUrl&&env.SUPABASE_SERVICE_ROLE_KEY))throw Error('Both SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required for shared storage');
const shared=!!(sharedUrl&&env.SUPABASE_SERVICE_ROLE_KEY)&&env.DIT_STORE!=='file';
env.DIT_STORE=shared?'supabase':'file'; env.DIT_DEV_AUTH=shared?'0':(env.DIT_DEV_AUTH||'1');
const store=shared?createStore(env):openFileStore(env.DIT_STORE_FILE||path.join(dir,'.data','dit-store.json'));
await bootstrap(store);await store.flush?.();
const port=Number(env.PORT||4173); if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
let localLlm,scheduler;
const configureModel=async settings=>{
  if(settings.provider==='jarvis'){env.DIT_LLM_PROVIDER='off';if(localLlm){localLlm=createLlm(env);if(scheduler)scheduler.llm=localLlm;}return}
  env.DIT_LLM_PROVIDER=settings.provider;env.OLLAMA_URL=settings.url;
  env.DIT_MODEL_GHOST=settings.models.GHOST_001||'';
  env.DIT_MODEL_NULL=settings.models.NULL_ENTITY||'';
  env.DIT_MODEL_ECHO=settings.models['ECHO.exe']||'';
  if(localLlm){localLlm=createLlm(env);await localLlm.discover();if(scheduler)scheduler.llm=localLlm;}
};
const operator=new Operator({store,env,port,configFile:path.join(dir,'.data','operator-settings.json'),onSettings:configureModel});
const autonomous=new AutonomousResearch({operator,env,log:(...args)=>console.log(...args)});
operator.autonomous=autonomous;
await configureModel(operator.settings);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.mp4':'video/mp4','.ogg':'audio/ogg','.webm':'video/webm'};
const send=(res,r,bytes)=>{res.statusCode=r.status;for(const [k,v] of r.headers)res.setHeader(k,v);if(bytes!==undefined)res.end(bytes);else r.arrayBuffer().then(b=>res.end(Buffer.from(b)),()=>res.end());};
const operatorAuthorized=req=>{const host=String(req.headers.host||'');return ['localhost:'+port,'127.0.0.1:'+port,'[::1]:'+port].includes(host) && (!req.headers.origin||['http://localhost:'+port,'http://127.0.0.1:'+port,'http://[::1]:'+port].includes(req.headers.origin));};
const streams=new Set();
const fingerprint=async()=>{const [ev]=await store.select('activity_events',{order:['id','desc'],limit:1});const ag=await store.select('agents');const t=await voteTotals(store);return JSON.stringify([ev?.id,ag.map(a=>a.state+a.last_active_at),t.total,t.leaderboard.map(l=>l.votes)])};
setInterval(async()=>{if(!streams.size)return;try{const f=await fingerprint();for(const c of streams){if(c.last!==f){c.res.write('data: changed\n\n');c.last=f}else if(Date.now()%25000<2000)c.res.write(': hb\n\n')}}catch{}},2000);
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://localhost:${port}`);
 if(url.pathname.startsWith('/operator/api/')){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>12000){res.writeHead(413);res.end();return;}chunks.push(chunk)}
  let body={};try{if(chunks.length)body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{res.writeHead(400);res.end('Invalid JSON');return}
  const r=await operator.handle({method:req.method,url,headers:req.headers},body);send(res,r);return;
 }
 if(['/operator','/operator.html','/operator.js','/operator.css'].includes(url.pathname)){if(!operatorAuthorized(req)){res.writeHead(403);res.end('Local operator only');return;}if(url.pathname==='/operator')url.pathname='/operator.html'}
 if(url.pathname==='/api/stream'&&req.method==='GET'){
  if(streams.size>=50){res.writeHead(503);res.end('Too many streams');return;}
  res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store',connection:'keep-alive','x-content-type-options':'nosniff'});res.write('retry: 5000\n\n');
  const c={res,last:null};streams.add(c);req.on('close',()=>streams.delete(c));return;
 }
 if(url.pathname.startsWith('/api/')){
  const bufs=[];let length=0;for await(const c of req){length+=c.length;if(length>65536){res.writeHead(413);res.end('Too large');return;}bufs.push(c)}
  const body=Buffer.concat(bufs);const init={method:req.method,headers:req.headers};if(!['GET','HEAD'].includes(req.method))init.body=body;
  const r=await handleApi(new Request(url,init),env,{store});send(res,r);return;
 }
 const resource=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const full=path.resolve(dir,'dist',resource);
 if(!full.startsWith(path.resolve(dir,'dist')+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type',types[path.extname(full)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');fs.createReadStream(full).pipe(res);
}catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'Server error',detail:env.NODE_ENV==='development'?e.message:undefined}));}});
server.listen(port,'127.0.0.1',()=>{console.log(`DIT local companion: http://127.0.0.1:${port}/operator · ${store.kind} store · ${env.DIT_DEV_AUTH==='1'?'TEST-ONLY identity':'Supabase Auth'}`);autonomous.start();});
// Update public read-only snapshots even with the browser closed; reuse the existing JARVIS cache.
const marketSyncTimer=shared&&env.DIT_JARVIS_SHARED==='1'
 ?setInterval(()=>operator.refreshMarket().catch(()=>{}),20_000):null;
if(marketSyncTimer)operator.refreshMarket().catch(()=>{});

let timer=null;localLlm=createLlm(env); await localLlm.discover();console.log("[llm]",JSON.stringify(localLlm.status));
if (!localLlm.configured && localLlm.status?.provider === 'ollama') {
 console.log('[llm] Ollama is not reachable. Start Ollama or choose JARVIS in http://127.0.0.1:'+port+'/operator. Research without an LLM will skip concept generation.');
}
scheduler=new Scheduler({store,env,llm:localLlm,workerId:'local-'+process.pid,log:(...v)=>console.log('[worker]',...v)});
if(env.DIT_START_SCHEDULER!=='0'){
 const tick=async()=>{try{console.log('[worker]',JSON.stringify(await scheduler.tick()));}catch(e){console.error('[worker] tick error:',e.message);}};
 setTimeout(tick,1500);timer=setInterval(tick,Math.max(15,Number(env.DIT_TICK_SECONDS||60))*1000);
}
// Do not exit while the in-memory research and vote snapshot is still being saved.
let closing = false;
async function shutdown() {
 if (closing) return;
 closing = true;
 if (timer) clearInterval(timer);
 if (marketSyncTimer) clearInterval(marketSyncTimer);
 autonomous.stop();
 try { await store.flush?.(); }
 catch (error) {
   console.error('[storage] Final save failed:', error.message);
   console.error('[storage] Keep the .data folder, including any *.tmp recovery snapshot.');
   process.exitCode = 1;
 }
 server.close(() => process.exit(process.exitCode || 0));
}
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
