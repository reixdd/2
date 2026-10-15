// Shared market semantics. These fields never infer launches from observation timestamps.
export const METRICS=['volume_5m_usd','liquidity_usd','buys_5m','sells_5m','market_cap_usd'];
export function timestamp(value){if(value==null||value==='')return null;const n=Number(value),numeric=typeof value==='number'||/^\d+(\.\d+)?$/.test(value);const ms=numeric?(n<1e11?n*1000:n):Date.parse(value);return Number.isFinite(ms)&&ms>0&&ms<8.64e15?new Date(ms).toISOString():null;}
export function artworkUrl(raw){if(typeof raw!=='string'||raw.length>1500)return null;let value=raw;if(/^ipfs:\/\//i.test(value)){const suffix=value.slice(7).replace(/^ipfs\//,''),[cid,...path]=suffix.split('/');if(!/^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{30,100})$/.test(cid)||!path.every(x=>/^[A-Za-z0-9._-]{1,120}$/.test(x)&&x!=='..'))return null;value='https://ipfs.io/ipfs/'+suffix;}if(/^ar:\/\//i.test(value))value='https://arweave.net/'+value.slice(5);try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
export function artworkCandidates(values,provider='source'){const seen=new Set();return values.flatMap(v=>{const url=artworkUrl(typeof v==='object'?v?.url:v);if(!url||seen.has(url))return [];seen.add(url);return [{url,provider:typeof v?.provider==='string'?v.provider:provider}]}).slice(0,12);}
export function mergeMarketRows(old,row){if(!old)return {...row};const joined={...old,providers:[...new Set([...(old.providers||[]),...(row.providers||[])])],kinds:[...new Set([...(old.kinds||[old.kind]),...(row.kinds||[row.kind])])],metric_sources:{...old.metric_sources}};
 const newer=(Date.parse(row.source_observed_at||row.provider_response_at||'')||0)>(Date.parse(old.source_observed_at||old.provider_response_at||'')||0);
 for(const key of ['name','symbol','safety','url','pair_created_at','token_created_at','created_at','pair_time_source','twitter_url'])if(!joined[key]&&row[key])joined[key]=row[key];
 joined.pair_time_verified=!!joined.pair_created_at&&(old.pair_time_verified===true||row.pair_time_verified===true);
 joined.first_observed_at=old.first_observed_at||old.received_at||row.first_observed_at;
 joined.received_at=row.received_at||old.received_at;
 if(newer){joined.source_observed_at=row.source_observed_at;joined.provider_response_at=row.provider_response_at;joined.observed_at=row.observed_at;joined.freshness=row.freshness;}
 for(const key of METRICS){const next=row.metric_sources?.[key],prev=joined.metric_sources[key];const nextTime=Date.parse(next?.observed_at||'')||0,prevTime=Date.parse(prev?.observed_at||'')||0;
  if(row[key]!=null&&(joined[key]==null||nextTime>prevTime||(nextTime===prevTime&&row.kind==='tape'))){joined[key]=row[key];joined.metric_sources[key]=next||{provider:row.provider,observed_at:row.source_observed_at||null};}}
 joined.image_candidates=artworkCandidates([...(row.image_candidates||[row.image_url]),...(old.image_candidates||[old.image_url])].filter(Boolean));
 joined.image_url=old.image_url||row.image_url||joined.image_candidates[0]?.url||null;
 return joined;}
export function matchesMarketFilter(row,filter,now=Date.now(),newWindowMs=300000){const at=Date.parse(row.pair_created_at||''),age=now-at;const verified=row.pair_time_verified===true&&Number.isFinite(at)&&age>=0;
 if(filter==='new')return verified&&age<=newWindowMs;
 if(filter==='recent'){const observed=Date.parse(row.source_observed_at||row.provider_response_at||'');return Number.isFinite(observed)&&now-observed>=-60000&&now-observed<=86400000;}
 if(filter==='trending')return (row.kinds||[row.kind]).includes('trending');
 return true;}
