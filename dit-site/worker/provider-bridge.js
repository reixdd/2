// Local-only provider bridge for operator-initiated research. Never import into browser/edge bundles.
// DIT owns its prompts, records and validation; JARVIS retains control of its specialist manager.
export const IDENTITIES = ['GHOST_001','NULL_ENTITY','ECHO.exe'];
export const BRIEFS = {
  GHOST_001:'Historical context and remembered internet culture. Request INVESTIGATOR, REVIEWER and SCIENTIST emphasis; distinguish observed facts and interpretations.',
  NULL_ENTITY:'Early signals and counter-evidence. Request SCOUT, QUANT_SKEPTIC and REVIEWER emphasis; flag paid attention and uncertain sources.',
  'ECHO.exe':'Viral narratives, recurring memes and independent sources. Request SOCIAL, CALLER and REVIEWER emphasis; never present promotional claims as fact.'
};
const loopback = new Set(['localhost','127.0.0.1','[::1]','::1']);
export function normalizedBase(raw, provider) {
  let u;try{u=new URL(String(raw||''))}catch{throw Error('Valid local service URL required')}
  if (u.protocol!=='http:' || !loopback.has(u.hostname) || u.username || u.password || u.search || u.hash) throw Error('Only local HTTP loopback model services are allowed');
  let pathname=u.pathname.replace(/\/+$/,'');
  if (provider==='openai-local') pathname=pathname.replace(/\/v1$/,'');
  if (pathname && pathname!=='/') throw Error('Use service origin, optionally /v1 for OpenAI-compatible endpoints');
  return u.origin;
}
export function validateSettings(raw={}){
  const provider=String(raw.provider||'ollama');
  if(!['ollama','openai-local','jarvis'].includes(provider))throw Error('Unsupported model provider');
  const defaultPort=provider==='jarvis'?8768:provider==='ollama'?11434:1234;
  const url=normalizedBase(raw.url||`http://127.0.0.1:${defaultPort}`,provider);
  const models={};for(const id of IDENTITIES){const value=raw.models?.[id]||'';if(typeof value!=='string'||value.length>120||/[\r\n]/.test(value))throw Error('Invalid model selection for '+id);models[id]=value.trim()}
  return {provider,url,models};
}
const timeoutSignal=(signal,ms)=>signal?AbortSignal.any([signal,AbortSignal.timeout(ms)]):AbortSignal.timeout(ms);
async function fetchJson(fetchImpl,url,signal){const r=await fetchImpl(url,{signal:timeoutSignal(signal,9000),headers:{accept:'application/json'}});if(!r.ok)throw Error('Service returned HTTP '+r.status);const j=await r.json();return j}
export async function discoverProvider(settings,{fetchImpl=fetch,signal}={}){
  const s=validateSettings(settings);
  const endpoint=s.provider==='ollama'?'/api/tags':s.provider==='jarvis'?'/api/models':'/v1/models';
  const j=await fetchJson(fetchImpl,s.url+endpoint,signal);
  let rows=s.provider==='ollama'?j.models:s.provider==='jarvis'?(j.models||j.available_models||j.data):j.data;
  if(!Array.isArray(rows) && s.provider==='jarvis') rows=Object.values(rows||{}).flatMap(v=>typeof v==='string'?[v]:Array.isArray(v)?v:[]);
  const models=(Array.isArray(rows)?rows:[]).map(x=>typeof x==='string'?x:x?.name||x?.id||x?.model).filter(x=>typeof x==='string'&&x.length<150);
  return {provider:s.provider,models:[...new Set(models)],healthy:true,service:s.url};
}
function boundedText(x,limit=20000){return String(x||'').slice(0,limit)}
export async function readNdjson(response,{signal,onRecord}={}){
  if(!response.ok)throw Error('JARVIS returned HTTP '+response.status);
  if(!response.body)throw Error('JARVIS stream unavailable');
  const reader=response.body.getReader(),decoder=new TextDecoder();let tail='',answer='',finished=false,count=0,actualModel=null,records=[];
  try{
    while(true){if(signal?.aborted)throw signal.reason||Error('Cancelled');const {done,value}=await reader.read();if(done)break;tail+=decoder.decode(value,{stream:true});if(tail.length>65536)throw Error('Excessive JARVIS stream buffer');
      const lines=tail.split('\n');tail=lines.pop();for(let line of lines){line=line.trim();if(!line||line.startsWith(':'))continue;if(line.startsWith('data:'))line=line.slice(5).trim();if(line==='[DONE]'){finished=true;continue;}
        let r;try{r=JSON.parse(line)}catch{continue}if(++count>500)throw Error('Excessive stream records');
        const kind=r.type||r.event||r.kind||''; onRecord?.(r);
        if(r.model)actualModel=boundedText(r.model,140);
        if(kind==='error'||r.error)throw Error(boundedText(r.message||r.text||r.error?.message||r.error,350));
        if(typeof r.delta==='string')answer+=r.delta;
        else if(kind==='answer'||kind==='final'||kind==='response')answer=boundedText(r.answer||r.text||r.content||r.message||answer);
        if(kind==='done'||kind==='complete')finished=true;
        if(records.length<30 && ['state','heartbeat','answer','done'].includes(kind))records.push({type:kind,at:Date.now()});
      }
    }
    if(tail.trim()){try{const r=JSON.parse(tail);onRecord?.(r);if(r.type==='answer')answer=boundedText(r.answer||r.text||answer);if(r.type==='done')finished=true}catch{}}
  } finally {try{await reader.cancel()}catch{}}
  return {answer:boundedText(answer),done:finished,model:actualModel,events:records};
}
export async function runResearch({settings,agentId,prompt,signal,fetchImpl=fetch,onRecord}){
 const s=validateSettings(settings);if(!IDENTITIES.includes(agentId))throw Error('Invalid agent');
 const selected=s.models[agentId];if(s.provider!=='jarvis'&&!selected)throw Error('Choose an installed model for '+agentId);
 const p=boundedText(prompt,3500).trim();if(!p||p.length<8)throw Error('Research prompt must be 8–3500 characters');
 const user=`DEAD INTERNET THEORY RESEARCH ONLY. Do not sign transactions, propose deceptive promotion or claim unverified observations as fact. Identity: ${agentId}. ${BRIEFS[agentId]}\nResearch question: ${p}\nSeparate source facts, hypotheses and uncertainty. Include source links when available.`;
 const abort=timeoutSignal(signal,75000);
 if(s.provider==='jarvis'){
    const response=await fetchImpl(s.url+'/api/chat',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify({message:user,identity_key:agentId,mode:'lite',...(selected?{model:selected}:{})}),signal:abort});
    const result=await readNdjson(response,{signal:abort,onRecord});if(!result.answer)throw Error('JARVIS returned no research answer');return {answer:result.answer,model:result.model||selected||null,provider:'jarvis',requested_specialists:BRIEFS[agentId],stream_completed:result.done};
 }
 const discovery=await discoverProvider(s,{fetchImpl,signal:abort});if(!discovery.models.includes(selected))throw Error(`Configured model ${selected} is unavailable; refresh models`);
 let response;
 if(s.provider==='ollama'){
  response=await fetchImpl(s.url+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:selected,stream:false,options:{num_predict:1400,temperature:.45},messages:[{role:'system',content:'You are an evidence-based cultural research analyst. Never assert unverified speculation as fact.'},{role:'user',content:user}]}),signal:abort});
  if(!response.ok)throw Error('Ollama returned HTTP '+response.status);const j=await response.json();const answer=boundedText(j.message?.content);if(!answer)throw Error('Ollama returned no text');return {answer,model:selected,provider:'ollama'};
 }
 response=await fetchImpl(s.url+'/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:selected,max_tokens:1400,temperature:.45,messages:[{role:'system',content:'You are an evidence-based cultural research analyst. Never assert unverified speculation as fact.'},{role:'user',content:user}]}),signal:abort});
 if(!response.ok)throw Error('Local OpenAI-compatible model returned HTTP '+response.status);const j=await response.json();const answer=boundedText(j.choices?.[0]?.message?.content);if(!answer)throw Error('Model returned no text');return {answer,model:selected,provider:'openai-local'};
}
