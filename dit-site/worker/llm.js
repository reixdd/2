// DIT model router — independent of JARVIS's Python runtime, compatible with its Ollama endpoint.
// Secrets and private/local model endpoints never reach the browser or the public Worker bundle.
export class LlmUnavailable extends Error { constructor(m = 'LLM provider not configured') { super(m); this.code = 'llm_unconfigured'; } }
export function extractJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('model reply contained no JSON object');
  return JSON.parse(text.slice(a, b + 1));
}
const excluded = /embed|embedding|nomic|bge|llava|vision|(?:^|[-:])vl(?:$|[-:])/i;
const sizeB = x => {
  const raw = x.details?.parameter_size || x.name || '';
  const m = String(raw).match(/([\d.]+)\s*B\b/i);
  return m ? +m[1] : (Number(x.size) || 0) / 1e9;
};
export function selectOllamaModels(rows = []) {
  const usable = rows.filter(r => r && typeof r.name === 'string' && !excluded.test(r.name)).sort((a,b)=>sizeB(a)-sizeB(b));
  return { fast: (usable.find(r=>sizeB(r)>=3)||usable[0])?.name || null, deep: usable.at(-1)?.name || null, names: usable.map(r=>r.name) };
}
const abortSignal = (signal, ms) => signal ? AbortSignal.any([signal,AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
const baseUrl = raw => {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Invalid LLM URL');
  return url;
};
export function createLlm(env = {}, fetchImpl = (...args)=>fetch(...args)) {
  const provider = String(env.DIT_LLM_PROVIDER || 'auto').toLowerCase();
  if (provider === 'off') return { configured:false, provider:'off', model:null, async discover(){}, async complete(){throw new LlmUnavailable()}, costMicros:()=>null };
  const url = baseUrl(env.OLLAMA_URL || 'http://127.0.0.1:11434');
  const isLocal = ['127.0.0.1','localhost','::1','[::1]'].includes(url.hostname);
  if (!isLocal && env.DIT_ALLOW_REMOTE_LLM !== '1') throw Error('Non-loopback LLM endpoint requires DIT_ALLOW_REMOTE_LLM=1');
  const apiBase = url.href.replace(/\/$/,'').replace(/\/v1$/,'');
  const state = { model:null, fast:null, deep:null, models:[], configured:provider==='ollama', provider:provider==='openai-local'?'openai-local':'ollama', lastError:null, lastCheckedAt:null };
  const pin = Number(env.LLM_PRICE_IN_USD_PER_MTOK), pout = Number(env.LLM_PRICE_OUT_USD_PER_MTOK);
  const anthropic = async ({system,user,temperature,maxTokens,signal}) => {
    const resp = await fetchImpl('https://api.anthropic.com/v1/messages',{method:'POST',signal:abortSignal(signal,60000),headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:env.LLM_MODEL||'claude-haiku-4-5',max_tokens:maxTokens,temperature,system,messages:[{role:'user',content:user}]})});
    if(!resp.ok)throw Error('Anthropic returned '+resp.status);
    const j=await resp.json();return {text:(j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join(''),usage:{in:j.usage?.input_tokens||0,out:j.usage?.output_tokens||0}};
  };
  return {
    get configured(){return state.configured},get provider(){return state.provider},get model(){return state.model},
    get models(){return [...state.models]},get status(){return {provider:state.provider,configured:state.configured,fast:state.fast,deep:state.deep,availableModels:[...state.models],lastError:state.lastError,lastCheckedAt:state.lastCheckedAt}},
    async discover(){
      if (provider==='anthropic') {state.configured=!!env.ANTHROPIC_API_KEY;state.provider='anthropic';state.model=state.configured?(env.LLM_MODEL||'claude-haiku-4-5'):null;return this.status;}
      try {
        const r=await fetchImpl(`${apiBase}${provider==='openai-local'?'/v1/models':'/api/tags'}`,{signal:AbortSignal.timeout(3500)});
        if(!r.ok)throw Error('Ollama discovery returned '+r.status);
        const d=await r.json();const s=provider==='openai-local'?{names:(d.data||[]).map(m=>m.id).filter(Boolean),fast:(d.data||[])[0]?.id,deep:(d.data||[]).at(-1)?.id}:selectOllamaModels(d.models||[]);
        state.models=s.names;state.fast=s.fast;state.deep=s.deep;state.model=env.DIT_MODEL_DEFAULT||s.fast;
        state.configured=!!state.model;state.provider=provider==='openai-local'?'openai-local':'ollama';state.lastError=state.configured?null:'No text models installed';
      } catch(e) {
        state.lastError=String(e.message).slice(0,180);state.configured=false;state.model=null;
        if(provider==='auto'&&env.ANTHROPIC_API_KEY){state.provider='anthropic';state.configured=true;state.model=env.LLM_MODEL||'claude-haiku-4-5';state.lastError=null;}
      }
      state.lastCheckedAt=new Date().toISOString();return this.status;
    },
    async complete({system,user,agentId,temperature=.65,maxTokens=900,signal}) {
      if(!state.configured) throw new LlmUnavailable(state.lastError || 'No configured LLM. Start Ollama or configure Anthropic.');
      if(state.provider==='anthropic')return anthropic({system,user,temperature,maxTokens,signal});
      const preferred=agentId==='GHOST_001'?env.DIT_MODEL_GHOST:agentId==='NULL_ENTITY'?env.DIT_MODEL_NULL:agentId==='ECHO.exe'?env.DIT_MODEL_ECHO:null;
      // Never silently send prompts to an unknown model name that isn't installed.
      const model=preferred?(state.models.includes(preferred)?preferred:null):(agentId==='NULL_ENTITY'?state.deep:state.fast)||state.model;
      if(!model)throw new LlmUnavailable('Selected model for '+agentId+' is not installed; refresh model configuration.');
      const openai=state.provider==='openai-local';
      const r=await fetchImpl(`${apiBase}${openai?'/v1/chat/completions':'/api/chat'}`,{method:'POST',signal:abortSignal(signal,90000),headers:{'content-type':'application/json'},body:JSON.stringify(openai?{model,temperature,max_tokens:Math.min(1800,maxTokens),messages:[{role:'system',content:system},{role:'user',content:user}],response_format:{type:'json_object'}}:{model,stream:false,messages:[{role:'system',content:system},{role:'user',content:user}],options:{temperature,num_predict:Math.min(1800,maxTokens)},format:'json'})});
      if(!r.ok)throw Error('Local model '+model+' returned '+r.status);
      const j=await r.json();const result=openai?j.choices?.[0]?.message?.content:j.message?.content;
      if(typeof result!=='string'||!result.trim())throw Error('Local model returned no text');
      return {text:result,usage:{in:openai?(j.usage?.prompt_tokens||0):(j.prompt_eval_count||0),out:openai?(j.usage?.completion_tokens||0):(j.eval_count||0)}};
    },
    costMicros:u=>['ollama','openai-local'].includes(state.provider)?0:(Number.isFinite(pin)&&Number.isFinite(pout)&&pin>=0&&pout>=0?Math.round(u.in*pin+u.out*pout):null)
  };
}
