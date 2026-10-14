// Loopback-only operator API: no signing, no public hosted endpoints.
import fs from 'node:fs';
import path from 'node:path';
import { validateSettings,discoverProvider,runResearch,IDENTITIES } from '../worker/provider-bridge.js';
import { StoreError } from './lib/store-core.js';
const out=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const tidy=x=>String(x||'').slice(0,400);
export function allowedOperatorRequest(req,port){
  const h=String(req.headers.host||'');if(!new RegExp(`^(127\\.0\\.0\\.1|localhost|\\[::1\\]):${port}$`).test(h))return false;
  if(req.headers.origin){try{const u=new URL(req.headers.origin);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.port!==String(port)||u.protocol!=='http:')return false}catch{return false}}
  return true;
}
export class Operator {
  constructor({store,env,port,fetchImpl=fetch,configFile='.data/operator-settings.json',onSettings=async()=>{}}){
    this.store=store;this.env=env;this.port=port;this.fetchImpl=fetchImpl;this.configFile=configFile;this.onSettings=onSettings;this.running=new Map();
    this.lowLoad = env.DIT_JARVIS_SHARED === '1';
    this.maxConcurrent = this.lowLoad ? Math.max(1, Math.min(3, Number(env.DIT_JARVIS_PARALLEL || 3))) : 3;
    const fallback={provider:this.lowLoad?'jarvis':'ollama',url:this.lowLoad?(env.DIT_JARVIS_URL||'http://127.0.0.1:8768'):(env.OLLAMA_URL||'http://127.0.0.1:11434'),models:{GHOST_001:env.DIT_MODEL_GHOST||'',NULL_ENTITY:env.DIT_MODEL_NULL||'','ECHO.exe':env.DIT_MODEL_ECHO||''}};
    let saved={};try{saved=JSON.parse(fs.readFileSync(configFile,'utf8'))}catch{}
    try{this.settings=validateSettings(this.lowLoad?fallback:{...fallback,...saved})}catch{this.settings=validateSettings(fallback)}
  }
  publicStatus(){return {settings:this.settings,lowLoad:this.lowLoad,maxConcurrent:this.maxConcurrent,running:[...this.running.keys()],autonomous:this.autonomous?.snapshot()||null,note:'Research only. No wallet signing or launches.'}}
  async handle(request,body={}){
    const {method,url,headers}=request;if(!allowedOperatorRequest({headers},this.port))return out({error:'Loopback operator only; Host/Origin rejected'},403);
    const p=new URL(url).pathname;
    try{
      if(p==='/operator/api/settings'&&method==='GET')return out(this.publicStatus());
      if(p==='/operator/api/settings'&&method==='POST'){
        const next=validateSettings(this.lowLoad?{...body,provider:'jarvis',url:this.env.DIT_JARVIS_URL||'http://127.0.0.1:8768',models:this.settings.models}:body);
        this.settings=next;await this.onSettings(next);fs.mkdirSync(path.dirname(this.configFile),{recursive:true});fs.writeFileSync(this.configFile,JSON.stringify(next,null,2),{mode:0o600});
        return out(this.publicStatus());
      }
      if(p==='/operator/api/autonomous'&&method==='GET')return out(this.autonomous?.snapshot()||{enabled:false});
      if(p==='/operator/api/discover'&&method==='POST')return out(await discoverProvider(validateSettings(body?.settings||this.settings),{fetchImpl:this.fetchImpl}));
      if(p==='/operator/api/run'&&method==='POST'){
        const {agent_id:id,prompt}=body;if(!IDENTITIES.includes(id))return out({error:'Invalid agent'},400);
        if(this.running.has(id))return out({error:'An operator run is already active for this agent'},409);
        if(this.running.size>=this.maxConcurrent)return out({error:'All bounded JARVIS research slots are busy; retry shortly'},429);
        const ac=new AbortController();const run=crypto.randomUUID();this.running.set(id,{id:run,ac});
        const row={id:run,agent_id:id,prompt:String(prompt||'').slice(0,3500),provider:this.settings.provider,model:this.settings.models[id]||null,status:'running',started_at:new Date().toISOString(),finished_at:null,answer:null,error:null,source_refs:[],requested_specialists:null};
        if(!row.prompt||row.prompt.length<8){this.running.delete(id);return out({error:'Research prompt too short'},400)}
        try{await this.store.insert('agent_research_runs',row);
          await this.store.update('agents',[['id','eq',id]],{state:'THINKING',current_stage:'RESEARCH',state_since:new Date().toISOString(),last_active_at:new Date().toISOString()});
          await this.store.upsert('worker_heartbeats',{worker_id:'dit-operator-local',started_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),version:'operator',info:{kind:'local_research',llm_provider:this.settings.provider,llm_configured:true,store:this.store.kind}},{onConflict:'worker_id'});
          await this.store.insert('activity_events',{agent_id:id,event_type:'operator_start',title:`${id} received a research brief`,detail:'Local operator request; pending model response.'});}catch(e){this.running.delete(id);throw e}
        // Fire and forget, but retain the AbortController and persist all outcomes.
        const finish=async()=>{
          try{const r=await runResearch({settings:this.settings,agentId:id,prompt:row.prompt,signal:ac.signal,fetchImpl:this.fetchImpl});
            await this.store.update('agent_research_runs',[['id','eq',run]],{status:'completed',answer:r.answer,model:r.model||row.model,requested_specialists:r.requested_specialists||null,finished_at:new Date().toISOString()});
            await this.store.insert('activity_events',{agent_id:id,event_type:'operator_complete',title:`${id} completed its research brief`,detail:r.answer.slice(0,240),payload:{run_id:run}});
          }catch(e){const status=ac.signal.aborted?'cancelled':'failed';await this.store.update('agent_research_runs',[['id','eq',run]],{status,error:tidy(e.message),finished_at:new Date().toISOString()}).catch(()=>{});await this.store.insert('activity_events',{agent_id:id,event_type:'operator_'+status,title:`${id} research ${status}`,detail:tidy(e.message),payload:{run_id:run},severity:status==='failed'?'error':'info'}).catch(()=>{});}
          finally{await this.store.update('agents',[['id','eq',id]],{state:'IDLE',current_stage:null,last_active_at:new Date().toISOString()}).catch(()=>{});if(this.running.get(id)?.id===run)this.running.delete(id)}
        };void finish();return out({id:run,status:'running'},202);
      }
      if(p==='/operator/api/cancel'&&method==='POST'){const r=this.running.get(body.agent_id);if(!r)return out({error:'No active run'},404);r.ac.abort(Error('Cancelled by operator'));return out({cancelled:true,id:r.id})}
      return out({error:'Not found'},404);
    }catch(e){return out({error:tidy(e.message)},e instanceof StoreError?503:400)}
  }
}
