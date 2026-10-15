// Pure read-only terminal formatting. Never invents model decisions or artwork.
export const AGENTS=['GHOST_001','NULL_ENTITY','ECHO.exe'];
const images={'GHOST_001':'assets/cutouts/ghost_001.png','NULL_ENTITY':'assets/cutouts/null_entity.png','ECHO.exe':'assets/cutouts/echo_exe.png'};
export const agentPortrait=id=>images[id]||null;
export const safeArtUrl=value=>{
 if(typeof value!=='string'||value.length>500)return null;
 if(/^assets\/[\w./-]+\.(?:png|jpe?g|webp|gif)$/i.test(value)&&!value.includes('..'))return value;
 try { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null }
 catch {return null}
};
export const compact=x=>String(x??'').replace(/[\r\n\t ]+/g,' ').replace(/[#*`]/g,'').trim();
export function conceptArtwork(concept, signals=[]){
 const body=concept?.content||{};
 const original=safeArtUrl(body.image_url)||safeArtUrl(body.artwork_url)||
  safeArtUrl(body.original_artwork_url)||safeArtUrl(concept?.artwork_url);
 if(original)return {url:original,label:'CONCEPT ART',kind:'concept'};
 const refs=Array.isArray(concept?.source_refs)?concept.source_refs:[];
 // Match source provenance by a real URL or contract identity, never by missing URLs
 // (undefined === undefined previously picked an unrelated token's picture).
 const matching=signals.find(s=>safeArtUrl(s?.image_url)&&refs.some(r=>{
   if(typeof r?.url==='string'&&r.url&&typeof s.url==='string'&&s.url===r.url)return true;
   const address=typeof s?.address==='string'&&s.address?s.address:(typeof s?.mint==='string'?s.mint:null);
   if(!address)return false;
   if([r?.address,r?.mint,r?.contract_address].some(value=>value===address))return true;
   if(typeof r?.url!=='string'||!r.url)return false;
   try { return new URL(r.url).pathname.split('/').includes(address); } catch { return false; }
 }));
 if(matching)return {url:safeArtUrl(matching.image_url),label:'SOURCE IMAGE · NOT CONCEPT ART',kind:'evidence'};
 return {url:null,label:'ORIGINAL CONCEPT ART PENDING',kind:'missing'};
}
export function formatActivity(event){
 if(!AGENTS.includes(event?.agent_id))return null;
 const original=compact(event.title||String(event.event_type||'').replace(/_/g,' '));
 // A dead job exhausted *that job's* retries; it does not mean future research
 // cycles are permanently disabled. Keep the real error in detail + job status.
 const title=event.event_type==='job_dead'?'JOB RETRY LIMIT REACHED — OPEN OPERATOR':original;
 if(!title)return null;
 return {id:String(event.id??event.created_at??title),agent_id:event.agent_id,
   title:title.slice(0,118),status:compact(event.event_type).slice(0,45),
   at:event.created_at||event.observed_at||event.timestamp||null,
   detail:compact(event.detail||'').slice(0,170)};
}
export function researchHook(answer){
 const raw=String(answer||'');
 const m=raw.match(/(?:^|\n)\s*HOOK:\s*(.+?)(?=\n|SOURCE:|$)/i);
 if(m)return compact(m[1]).slice(0,130);
 const at=raw.indexOf('{'),end=raw.lastIndexOf('}');
 if(at>=0&&end>at&&end-at<10000)try{return compact(JSON.parse(raw.slice(at,end+1)).hook).slice(0,130)}catch{}
 return '';
}
