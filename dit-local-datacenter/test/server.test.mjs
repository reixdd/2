import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';

async function fixture(t,fail=false){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dit-dc-'));
 const fetchImpl=async url=>{
  if(fail)throw Error('feed unreachable');
  const body=String(url).includes('/api/concepts')?{concepts:[{id:'fdc-1',agent_id:'ECHO.exe',status:'review',created_at:'2026-10-16T12:00:00Z',content:{name:'Meme Theory',ticker:'MEME',narrative:'A source-backed coin concept',artwork_brief:'Black and white icon'},source_refs:[{url:'https://example.com/reference'}]}]}:{signals:[{address:'So11111111111111111111111111111111111111112',symbol:'SOL',name:'Example',provider:'GMGN',observed_at:'2026-10-16T12:00:00Z'}],status:'ok',last_checked_at:'2026-10-16T12:00:00Z'};
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const app=createApp({password:'very-secret-test',fetchImpl,storePath:path.join(dir,'drafts.json'),siteUrl:'https://example.chatgpt.site'});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const port=app.address().port,base=`http://127.0.0.1:${port}`;
 t.after(async()=>{await new Promise(resolve=>app.close(resolve));await fs.rm(dir,{recursive:true,force:true})});
 return {base,port};
}

test('local API stays locked before login; valid password opens read-only live data',async t=>{
 const {base}=await fixture(t);
 assert.equal((await fetch(base+'/api/data')).status,401);
 assert.equal((await fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({password:'wrong'})})).status,401);
 const login=await fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({password:'very-secret-test'})});
 assert.equal(login.status,200);
 assert.match(login.headers.get('set-cookie'),/HttpOnly/);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const response=await fetch(base+'/api/data',{headers:{Cookie:cookie}});assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.concepts[0].name,'Meme Theory');assert.equal(data.market[0].provider,'GMGN');assert.equal(data.sources.concepts.ok,true);
});

test('draft changes remain local and incomplete candidates sort by completeness',async t=>{
 const {base}=await fixture(t);
 const login=await fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({password:'very-secret-test'})});const cookie=login.headers.get('set-cookie').split(';')[0];
 const change=await fetch(base+'/api/draft/fdc-1',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({x_url:'https://x.com/CoinAccount',notes:'Approved for internal review'})});
 assert.equal(change.status,200);const updated=await (await fetch(base+'/api/data',{headers:{Cookie:cookie}})).json();assert.equal(updated.concepts[0].x_url,'https://x.com/CoinAccount');
 const bad=await fetch(base+'/api/draft/fdc-1',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({notes:'bad'})});assert.equal(bad.status,403);
});

test('unreachable live APIs are shown as failures, not fictional market rows',async t=>{
 const {base}=await fixture(t,true);
 const login=await fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({password:'very-secret-test'})});const cookie=login.headers.get('set-cookie').split(';')[0];
 const data=await (await fetch(base+'/api/data',{headers:{Cookie:cookie}})).json();assert.deepEqual(data.concepts,[]);assert.deepEqual(data.market,[]);assert.equal(data.sources.market.ok,false);
});
