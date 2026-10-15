// Shared browser-safe research and fictional concept persistence helpers.
// Never publishes real tokens, financial claims, or unreviewed concepts.
const trim=(v,n=4000)=>String(v??'').trim().slice(0,n);
const URLS=/https?:\/\/[^\s<>"'\])}]+/g;
export function recordedSources(answer,observations=[]){
  const mentioned=new Set((String(answer||'').match(URLS)||[]).map(x=>x.replace(/[.,;!?]+$/,'')));
  return observations.filter(o=>o.url&&mentioned.has(o.url)).map(o=>({observation_id:o.id,url:o.url,title:o.title,observed_at:o.observed_at})).slice(0,8);
}
export function extractConcept(answer,agentId,sourceRefs=[]){
  if(!sourceRefs.length)return null;
  const text=String(answer||'');
  const block=text.match(/\`\`\`(?:json)?\s*(\{[\s\S]*?\})\s*\`\`\`/i)||text.match(/CONCEPT_JSON\s*:\s*(\{[\s\S]*?\})\s*$/i);
  if(!block)return null;
  let raw;try{raw=JSON.parse(block[1]);}catch{return null;}
  const name=trim(raw.name,90),ticker=trim(raw.ticker,10).toUpperCase();
  if(name.length<3||!/^[A-Z0-9]{2,10}$/.test(ticker)||trim(raw.narrative,3500).length<20||trim(raw.social_draft,1000).length<10)return null;
  const anatomy=raw.attention_anatomy||{};
  const hook=trim(raw.hook||raw.narrative,120).split(/\s+/).slice(0,14).join(' ');
  const buzzwords=Array.isArray(raw.buzzwords)?raw.buzzwords.map(x=>trim(x,24)).filter(Boolean).slice(0,4):[];
  return {
    name,ticker,hook,buzzwords,narrative:trim(raw.narrative,3500),cultural_origin:trim(raw.cultural_origin,1800),
    artwork_brief:trim(raw.artwork_brief,1400),social_draft:trim(raw.social_draft,1000),
    confidence:Number.isFinite(Number(raw.confidence))?Math.max(0,Math.min(1,Number(raw.confidence))):0.25,
    contradictory_evidence:Array.isArray(raw.contradictory_evidence)?raw.contradictory_evidence.slice(0,8).map(x=>trim(x,600)):['Independent corroboration may be incomplete.'],
    attention_anatomy:Object.fromEntries(['spread','references','evidence','synthetic_distortion','uncertainty'].map(k=>[k,trim(anatomy[k],1500)||'Not established by collected sources.'])),
    fictional:true,origin_agent:agentId
  };
}
export async function persistCompletedResearch(store,{runId,agentId,answer,observations=[],marketEvidence=[],clock=()=>new Date().toISOString()}){
  const known=marketEvidence.filter(x=>x && x.url && x.observed_at && /^https:\/\/gmgn\.ai\/sol\/token\//.test(x.url)).map(x=>({id:null,url:x.url,title:trim(x.title,160),observed_at:x.observed_at}));
  const links=recordedSources(answer,[...observations,...known]);
  await store.update('agent_research_runs',[['id','eq',runId]],{source_refs:links});
  const memory={agent_id:agentId,kind:'episodic',content:trim(answer,12000),
    summary:trim(answer,350),tags:['DIT','research'],importance:0.5,source_refs:links,run_id:runId};
  try{await store.insert('agent_memories',memory);}catch(e){if(!/duplicate/i.test(String(e.message)))throw e;}
  const concept=extractConcept(answer,agentId,links);
  if(concept){
    const existing=await store.select('fictional_concepts',{filters:[['run_id','eq',runId]],limit:1});
    if(!existing.length){
      await store.insert('fictional_concepts',{id:crypto.randomUUID(),run_id:runId,agent_id:agentId,
        status:'review',content:concept,source_refs:links,revision:1,
        history:[{at:clock(),action:'created',status:'review',by:'local_research'}]});
    }
  }
  return {source_refs:links,concept_saved:!!concept};
}
export async function publicConcepts(store,id=null){
  const filters=[['status','eq','published']];if(id)filters.push(['id','eq',id]);
  return store.select('fictional_concepts',{filters,order:['published_at','desc'],limit:id?1:60});
}
export async function reviewConcept(store,{id,revision,status,content}){
  if(!['review','published','rejected','archived'].includes(status))throw Error('Invalid review status');
  const [row]=await store.select('fictional_concepts',{filters:[['id','eq',String(id)]],limit:1});
  if(!row)throw Error('Concept does not exist');
  if(Number(revision)!==row.revision)throw Error('Concept was updated by another reviewer; reload');
  const merged={...row.content,...content};
  if(status==='published'){
    if(!row.source_refs?.length)throw Error('A concept needs linked recorded evidence');
    if(!/^[A-Z0-9]{2,10}$/.test(trim(merged.ticker,10).toUpperCase())||trim(merged.name,90).length<3||trim(merged.social_draft,1000).length<10)
      throw Error('Name, ticker-style identifier, and social draft are required');
  }
  const now=new Date().toISOString();
  const history=[...(row.history||[]),{at:now,action:'review',status,by:'local_operator'}].slice(-50);
  const updated=await store.update('fictional_concepts',[['id','eq',id],['revision','eq',row.revision]],
    {content:merged,status,revision:row.revision+1,updated_at:now,
     published_at:status==='published'?(row.published_at||now):null,history});
  if(!updated?.length)throw Error('Concurrent concept revision, please reload');
  return updated[0];
}
