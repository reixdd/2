// Market presentation semantics. Source-observation freshness is NOT proof of a new pair.
const ms=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?t:null;};
export function categoryOfMarketSignal(row,now=Date.now(),windowMs=5*60_000){
 const launched=ms(row?.pair_created_at);
 if(launched===null||launched>now+60_000)return 'UNVERIFIED';
 return now-launched>=0&&now-launched<=windowMs?'NEW':'RECENT';
}
export function chooseVisibleSignals(signals=[],filter='new',now=Date.now()){
 const source=Array.isArray(signals)?signals:[];
 const selected=source.filter(s=>{
  if(filter==='all'||filter==='')return true;
  if(filter==='trending')return s.kind==='trending'||(s.providers||[]).some(x=>/trending/i.test(x));
  if(filter==='recent')return categoryOfMarketSignal(s,now)==='RECENT';
  return categoryOfMarketSignal(s,now)==='NEW';
 });
 return selected.sort((a,b)=>{
  const aTime=ms(filter==='new'?a.pair_created_at:a.source_observed_at||a.observed_at)||0;
  const bTime=ms(filter==='new'?b.pair_created_at:b.source_observed_at||b.observed_at)||0;
  return bTime-aTime;
 });
}
