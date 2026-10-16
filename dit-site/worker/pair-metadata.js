import {timestamp,artworkCandidates} from '../dist/market-data.js';
import {coinXFromMetadata} from '../dist/coin-twitter.js';
// Targeted pool-age lookup of EXISTING JARVIS observations, never a second scanner.
let enrichmentCursor=0;
const SOL=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export async function enrichVerifiedPairs(snapshot,{fetchImpl=fetch,now=Date.now(),signal}={}){
 const list=Array.isArray(snapshot?.signals)?snapshot.signals:[];
 const eligible=list.filter(x=>SOL.test(x.address||'')&&
   (x.pair_time_verified!==true||!x.twitter_url||!x.image_url))
   .sort((a,b)=>Number(b.kind==='trenches')-Number(a.kind==='trenches')||
     (Date.parse(b.first_observed_at||b.observed_at||'')||0)-(Date.parse(a.first_observed_at||a.observed_at||'')||0));
 const start=eligible.length?enrichmentCursor%eligible.length:0;
 const candidates=[...eligible.slice(start),...eligible.slice(0,start)].slice(0,30);
 enrichmentCursor=start+candidates.length;
 if(!candidates.length)return snapshot;
 const byAddress=new Map(candidates.map(x=>[x.address,x]));
 try{
  const guard=signal?AbortSignal.any([signal,AbortSignal.timeout(4800)]):AbortSignal.timeout(4800);
  const url='https://api.dexscreener.com/tokens/v1/solana/'+candidates.map(x=>x.address).join(',');
  const response=await fetchImpl(url,{signal:guard,headers:{accept:'application/json'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const items=await response.json();
  if(!Array.isArray(items))throw Error('Invalid pool metadata response');
  const pools=new Map();
  for(const pair of items){
   if(pair?.chainId!=='solana'||!byAddress.has(pair.baseToken?.address))continue;
   const matched=byAddress.get(pair.baseToken.address);
   // Exact contract match permits social/image metadata even if pair age was verified.
   const social=coinXFromMetadata(pair);
   if(social&&!matched.twitter_url)matched.twitter_url=social;
   const image=artworkCandidates([pair.info?.imageUrl,pair.info?.image_url,pair.info?.logoUrl],'DexScreener pair metadata');
   if(image.length){matched.image_candidates=artworkCandidates([...(matched.image_candidates||[]),...image],matched.provider);
     if(!matched.image_url)matched.image_url=matched.image_candidates[0]?.url||null;}
   const time=timestamp(pair.pairCreatedAt),ms=Date.parse(time||'');
   if(matched.pair_time_verified===true||!Number.isFinite(ms)||ms>now+60_000||ms<Date.parse('2020-01-01'))continue;
   const old=pools.get(pair.baseToken.address);
   if(!old||ms>old.ms)pools.set(pair.baseToken.address,{ms,time,pair});
  }
  for(const [address,item] of pools){
   const row=byAddress.get(address);
   // Preserve previously verified launch age; metadata enrichment cannot reset it.
   row.pair_created_at=item.time;row.pair_time_verified=true;
   row.pair_time_source='DexScreener pairCreatedAt · provider-reported';
   if(!row.created_at)row.created_at=item.time;
   const more=artworkCandidates([item.pair.info?.imageUrl,item.pair.info?.image_url,item.pair.info?.logoUrl],'DexScreener pair metadata');
   row.image_candidates=artworkCandidates([...(row.image_candidates||[]),...more],row.provider);
   if(!row.image_url)row.image_url=row.image_candidates[0]?.url||null;
  }
  return {...snapshot,source_states:{...(snapshot.source_states||{}),pair_metadata:'OK'},pair_metadata_checked_at:new Date(now).toISOString()};
 }catch(error){
  return {...snapshot,source_states:{...(snapshot.source_states||{}),pair_metadata:'UNAVAILABLE'},pair_metadata_error:String(error?.message||error).slice(0,100)};
 }
}
