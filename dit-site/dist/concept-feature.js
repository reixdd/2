// The main Radar shows one newest genuine saved idea from each research agent.
export const AGENTS=['GHOST_001','NULL_ENTITY','ECHO.exe'];
export function featuredAgentIdeas(rows=[]){
 const seen=new Set(),out=[];
 for(const c of [...rows].sort((a,b)=>(Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0))){
  if(!AGENTS.includes(c?.agent_id)||!['review','published'].includes(c.status)||!c.content?.name||seen.has(c.agent_id))continue;
  out.push(c);seen.add(c.agent_id);
  if(out.length===AGENTS.length)break;
 }
 return out;
}
