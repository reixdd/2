import http from 'node:http';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {normalizeConcept,normalizeMarket,rankConcepts,validateDraft} from './model.mjs';

const ROOT=dirname(fileURLToPath(import.meta.url));
const DEFAULT_SITE='https://dead-internet-theory-network.deadinternetproject.chatgpt.site';
const HEADERS={
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
 'Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"
};
const hash=s=>createHash('sha256').update(String(s)).digest();
const equal=(a,b)=>timingSafeEqual(hash(a),hash(b));
const json=(res,status,data,more={})=>{res.writeHead(status,{...HEADERS,'Content-Type':'application/json; charset=utf-8',...more});res.end(JSON.stringify(data))};
async function bodyOf(req){let txt='';for await(const chunk of req){txt+=chunk;if(txt.length>5000)throw Error('Payload too large')}return JSON.parse(txt||'{}')}
function goodOrigin(req){const o=req.headers.origin;if(!o)return true;try{const u=new URL(o);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&Number(u.port)===req.socket.localPort}catch{return false}}
function hostOK(req){return req.headers.host===`127.0.0.1:${req.socket.localPort}`}
async function readJSON(p){try{return JSON.parse(await readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return {};throw e}}
async function writeJSON(p,v){await mkdir(dirname(p),{recursive:true});const tmp=p+'.'+randomBytes(6).toString('hex')+'.tmp';await writeFile(tmp,JSON.stringify(v,null,2),{mode:0o600});await rename(tmp,p)}
export async function getLocalPassword(storeDir=join(ROOT,'.data')){
 const env=process.env.DIT_DATACENTER_PASSWORD;
 if(env){if(env.length<12)throw Error('DIT_DATACENTER_PASSWORD must have at least 12 characters');return {password:env,first:false,fromEnv:true}}
 const file=join(storeDir,'access-code.txt');
 try{const password=(await readFile(file,'utf8')).trim();if(password.length<16)throw Error('Stored local access code too short');return {password,first:false,fromEnv:false}}
 catch(err){if(err.code!=='ENOENT')throw err}
 const password=randomBytes(18).toString('base64url');await mkdir(storeDir,{recursive:true});
 await writeFile(file,password+'\n',{mode:0o600,flag:'wx'});return {password,first:true,fromEnv:false};
}
export function createApp({password,fetchImpl=fetch,storePath=join(ROOT,'.data','drafts.json'),siteUrl=DEFAULT_SITE,cacheMs=8000}={}){
 if(!password||password.length<12)throw Error('Local password required (12+ chars)');
 const site=new URL(siteUrl);if(site.protocol!=='https:'||site.username||site.password)throw Error('Live site must use HTTPS');
 const sessions=new Map(),failed=[];let cache=null,cacheUntil=0,loading=null;
 let draftLoaded=null,drafts={};
 async function getDrafts(){if(!draftLoaded)draftLoaded=readJSON(storePath).then(v=>{drafts=v&&typeof v==='object'&&!Array.isArray(v)?v:{};return drafts});await draftLoaded;return drafts}
 async function upstream(api){
  const url=new URL(api,site.origin);const response=await fetchImpl(url.href,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!data||typeof data!=='object')throw Error('Invalid JSON response');return data;
 }
 async function sources(){
  if(cache&&Date.now()<cacheUntil)return cache;
  if(loading)return loading;
  loading=(async()=>{
   const checkedAt=new Date().toISOString();const [conceptResult,marketResult]=await Promise.allSettled([upstream('/api/concepts?limit=50'),upstream('/api/market')]);
   const cOk=conceptResult.status==='fulfilled',mOk=marketResult.status==='fulfilled';
   const c=cOk?conceptResult.value:{},m=mOk?marketResult.value:{};
   const output={checked_at:checkedAt,concepts:cOk&&Array.isArray(c.concepts)?c.concepts:[],market:mOk&&Array.isArray(m.signals)?m.signals:[],sources:{concepts:{ok:cOk,error:cOk?null:String(conceptResult.reason?.message||'Unavailable')},market:{ok:mOk&&!m.stale,stale:m.stale===true,status:m.status||null,last_checked_at:m.last_checked_at||null,error:mOk?null:String(marketResult.reason?.message||'Unavailable')}},origin:site.origin};
   cache=output;cacheUntil=Date.now()+cacheMs;return output;
  })().finally(()=>{loading=null});return loading;
 }
 function authed(req){
  const raw=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('dit_dc_session='))?.slice('dit_dc_session='.length)||'';
  for(const [token,expiry] of sessions){if(expiry<Date.now()){sessions.delete(token);continue}if(raw.length===token.length&&equal(raw,token))return true}return false;
 }
 return http.createServer(async(req,res)=>{
  try{
   if(!hostOK(req)){json(res,403,{error:'Loopback host required'});return}
   const url=new URL(req.url,'http://127.0.0.1');const pathname=url.pathname;
   if(pathname==='/'&&req.method==='GET'){
    const html=await readFile(join(ROOT,'public','index.html'));res.writeHead(200,{...HEADERS,'Content-Type':'text/html; charset=utf-8'});res.end(html);return;
   }
   if((pathname==='/app.js'||pathname==='/style.css')&&req.method==='GET'){
    const b=await readFile(join(ROOT,'public',pathname.slice(1)));res.writeHead(200,{...HEADERS,'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});res.end(b);return;
   }
   if(pathname==='/login'&&req.method==='POST'){
    if(!goodOrigin(req)){json(res,403,{error:'Invalid origin'});return}
    const now=Date.now();while(failed.length&&now-failed[0]>60000)failed.shift();if(failed.length>=8){json(res,429,{error:'Too many attempts. Wait a minute.'});return}
    const b=await bodyOf(req);if(!equal(b.password||'',password)){failed.push(now);json(res,401,{error:'Incorrect access code'});return}
    const session=randomBytes(32).toString('hex');sessions.set(session,now+8*3600000);
    json(res,200,{ok:true},{'Set-Cookie':`dit_dc_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});return;
   }
   if(!authed(req)){json(res,401,{error:'Local login required'});return}
   if(pathname==='/logout'&&req.method==='POST'){
    if(!goodOrigin(req)){json(res,403,{error:'Invalid origin'});return}
    const token=String(req.headers.cookie||'').match(/(?:^|;\s*)dit_dc_session=([0-9a-f]{64})/)?.[1];if(token)sessions.delete(token);
    json(res,200,{ok:true},{'Set-Cookie':'dit_dc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return;
   }
   if(pathname==='/api/data'&&req.method==='GET'){
    const [d,s]=await Promise.all([getDrafts(),sources()]);
    const concepts=rankConcepts(s.concepts.map(c=>normalizeConcept(c,d[String(c.id)]||{})));
    const market=s.market.map(normalizeMarket);
    json(res,200,{concepts,market,sources:s.sources,checked_at:s.checked_at,origin:s.origin});return;
   }
   const match=/^\/api\/draft\/([A-Za-z0-9_-]{1,120})$/.exec(pathname);
   if(match&&req.method==='POST'){
    if(!goodOrigin(req)){json(res,403,{error:'Invalid origin'});return}
    const s=await sources();if(!s.concepts.some(c=>String(c.id)===match[1])){json(res,404,{error:'Concept not in the current source feed'});return}
    const update=validateDraft(await bodyOf(req));const d=await getDrafts();const next={...d,[match[1]]:{...(d[match[1]]||{}),...update}};await writeJSON(storePath,next);drafts=next;
    json(res,200,{ok:true,draft:next[match[1]]});return;
   }
   json(res,404,{error:'Not found'});
  }catch(e){const bad=/Invalid|Payload|too long|must be|HTTPS|Artwork|X link|Notes|Unexpected token|JSON/i.test(e.message);json(res,bad?422:500,{error:bad?String(e.message).slice(0,180):'Request failed; see local terminal'});if(!bad)console.error('[datacenter]',e.message)}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const dir=join(ROOT,'.data'),{password,first,fromEnv}=await getLocalPassword(dir);
  const port=Number(process.env.DIT_DATACENTER_PORT||4187);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid DIT_DATACENTER_PORT');
  const siteUrl=process.env.DIT_SITE_URL||DEFAULT_SITE;
  const app=createApp({password,siteUrl});
  app.listen(port,'127.0.0.1',()=>{
   console.log(`\nDIT LOCAL DATA CENTER — http://127.0.0.1:${port}`);
   if(first)console.log('FIRST-RUN PRIVATE ACCESS CODE: '+password+'\nSaved in .data/access-code.txt. Keep it private.');
   else console.log(fromEnv?'Use DIT_DATACENTER_PASSWORD from your DIT environment.':'Your access code is stored in .data/access-code.txt.');
   console.log('Reads your public DIT APIs. No wallet actions; public site unchanged.\n');
  });app.on('error',e=>{console.error('Cannot start Data Center: '+e.message);process.exitCode=1});
 }catch(e){console.error(e.message);process.exitCode=1}
}
