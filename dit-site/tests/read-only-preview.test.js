import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPublicResearchPreview} from '../server/lib/read-only-preview.js';
const host='https://dead-internet-theory-network.deadinternetproject.chatgpt.site';
test('local preview adds only public hosted concepts and activity; never mirrors worker status or treasury',async()=>{
 const requested=[];
 const proxy=createPublicResearchPreview({fetchImpl:async (url,init)=>{
  requested.push({url,init});
  if(url.includes('concepts/'))return Response.json({concept:{id:'host-1',agent_id:'GHOST_001',status:'published',content:{name:'Memes'}}});
  if(url.includes('/concepts'))return Response.json({concepts:[{id:'host-1',agent_id:'GHOST_001',status:'published',content:{name:'Memes'}}],next_before:null});
  return Response.json({events:[{id:'event-1',agent_id:'ECHO.exe',title:'Recorded event'}]});
 }});
 const base='http://127.0.0.1:4173';
 const list=await proxy.preview(base+'/api/concepts?limit=24',Response.json({concepts:[],fictional:true}));
 const d=await list.json();
 assert.equal(d.concepts.length,1);assert.equal(d.concepts[0].preview_origin,'hosted_public_read_only');
 assert.equal(d.preview_source,'local_plus_hosted_public_read_only');
 const detail=await proxy.preview(base+'/api/concepts/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',Response.json({error:'Not found'},{status:404}));
 assert.equal((await detail.json()).concept.id,'host-1');
 const activity=await proxy.preview(base+'/api/activity?limit=60',Response.json({events:[]}));
 assert.equal((await activity.json()).events[0].title,'Recorded event');
 const unchanged=Response.json({researcher:{online:false}});
 assert.equal(await proxy.preview(base+'/api/observatory',unchanged),unchanged);
 const treasury=Response.json({totals:{treasury_lamports:90000000}});
 assert.equal(await proxy.preview(base+'/api/treasury/simulated',treasury),treasury);
 assert.ok(requested.every(r=>r.url.startsWith(host+'/api/')&&r.init.method==='GET'&&r.init.credentials==='omit'));
});
test('network errors leave local database results intact',async()=>{
 const mirror=createPublicResearchPreview({fetchImpl:async()=>{throw Error('down')}});
 const original=Response.json({concepts:[{id:'local'}]});
 const result=await mirror.preview('http://127.0.0.1:4173/api/concepts?limit=24',original);
 assert.equal((await result.json()).concepts[0].id,'local');
});
