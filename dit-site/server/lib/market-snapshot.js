// Server-side JARVIS -> hosted public market snapshot boundary.
// The browser receives public on-chain observations only; no keys, local URLs or wallet actions.
const SOL=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const num=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
const text=(v,max=100)=>String(v??'').replace(/[\r\n\t<>]/g,' ').trim().slice(0,max);
const https=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<400?u.href:null}catch{return null}};
export function sanitizeMarketSnapshot(data, now=Date.now()){
  const signals=[];
  const seen=new Set();
  for(const s of Array.isArray(data?.signals)?data.signals:[]){
    if(!SOL.test(s?.address||'')||seen.has(s.address))continue;
    seen.add(s.address);
    const stamp=Date.parse(s.observed_at||'');
    if(!Number.isFinite(stamp)||stamp>now+60_000)continue;
    signals.push({
      chain:'sol',address:s.address,name:text(s.name,90),symbol:text(s.symbol,20),
      kind:['trenches','trending','radar','tape'].includes(s.kind)?s.kind:'radar',
      provider:text(s.provider,65),observed_at:new Date(stamp).toISOString(),
      source_observed_at:Number.isFinite(Date.parse(s.source_observed_at||''))?new Date(s.source_observed_at).toISOString():null,
      received_at:Number.isFinite(Date.parse(s.received_at||''))?new Date(s.received_at).toISOString():null,
      image_url:https(s.image_url),created_at:Number.isFinite(Date.parse(s.created_at||''))?new Date(s.created_at).toISOString():null,
      volume_5m_usd:num(s.volume_5m_usd),liquidity_usd:num(s.liquidity_usd),
      buys_5m:num(s.buys_5m),sells_5m:num(s.sells_5m),market_cap_usd:num(s.market_cap_usd),
      safety:text(s.safety||'UNVERIFIED',40),paid_attention:s.paid_attention===true,
      url:'https://gmgn.ai/sol/token/'+s.address,source_status:'OBSERVED'
    });
    if(signals.length===12)break;
  }
  const source_states={};
  for(const k of ['trenches','trending','radar','tape']){
    const status=String(data?.source_states?.[k]??'UNAVAILABLE');
    source_states[k]=status==='OK'?'OK':/^HTTP \d{3}$/.test(status)?status:'UNAVAILABLE';
  }
  return {signals,source_states,observed_at:new Date(now).toISOString(),research_only:true};
}
export async function persistMarketSnapshot(store,snapshot,{now=Date.now()}={}){
  const safe=sanitizeMarketSnapshot(snapshot,now);
  // A timeout or transient empty provider response must never overwrite a valid public snapshot.
  if(!safe.signals.length)return false;
  await store.upsert('dit_market_snapshots',{id:1,signals:safe.signals,source_states:safe.source_states,
    observed_at:safe.observed_at,updated_at:new Date(now).toISOString()},{onConflict:'id'});
  return true;
}
export async function readMarketSnapshot(store,{now=Date.now(),staleAfterMs=180_000}={}){
  const [row]=await store.select('dit_market_snapshots',{filters:[['id','eq',1]],limit:1});
  if(!row)return {signals:[],source_states:{},last_checked_at:null,stale:true,
    status:'NO_SNAPSHOT',research_only:true};
  const safe=sanitizeMarketSnapshot({signals:row.signals,source_states:row.source_states},now);
  const written=Date.parse(row.updated_at||row.observed_at||'');
  const stale=!Number.isFinite(written)||now-written>staleAfterMs||now<written-60_000;
  return {...safe,last_checked_at:Number.isFinite(written)?new Date(written).toISOString():null,
    stale,status:stale?'STALE':'LIVE',research_only:true};
}
