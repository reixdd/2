// The main Radar prefers source-provided artwork; vector studies are fallback previews.
import {conceptArtwork} from './terminal-ui.js?v=treasury-1';
export const AGENTS=['GHOST_001','NULL_ENTITY','ECHO.exe'];
export function featuredAgentIdeas(rows=[],signals=[],failed=new Set()){
 const seen=new Set(),out=[];
 const priority=c=>{const art=conceptArtwork(c,signals);return failed.has(art.url)?0:art.kind==='concept'?2:art.kind==='evidence'?1:0;};
 for(const c of [...rows].sort((a,b)=>priority(b)-priority(a)||
   (Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0))){
  if(!AGENTS.includes(c?.agent_id)||!['review','published'].includes(c.status)||!c.content?.name||seen.has(c.agent_id))continue;
  out.push(c);seen.add(c.agent_id);
  if(out.length===AGENTS.length)break;
 }
 return out;
}
