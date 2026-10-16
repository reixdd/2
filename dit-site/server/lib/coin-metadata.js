import {sourceMint,coinXFromMetadata} from '../../dist/coin-twitter.js';
import {safeArtUrl} from '../../dist/terminal-ui.js';
const cache=new Map();
const mintOf=r=>sourceMint(r?.url)||r?.address||r?.mint||r?.evidence?.token_address;
const valid=x=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x||'');
// Bounded, cached metadata for recorded contracts only; no token search or guessed socials.
export async function enrichConceptSources(concepts,{fetchImpl=fetch,now=Date.now()}={}){
 const addresses=[...new Set(concepts.flatMap(c=>(c.source_refs||[]).map(mintOf)).filter(valid))];
 const missing=addresses.filter(a=>!cache.has(a)||now-cache.get(a).at>300000).slice(0,30);
 if(missing.length)try{
  const response=await fetchImpl('https://api.dexscreener.com/tokens/v1/solana/'+missing.join(','),{signal:AbortSignal.timeout(3500),headers:{accept:'application/json'}});
  if(response.ok){const pairs=await response.json();if(Array.isArray(pairs)){
   for(const a of missing)cache.set(a,{at:now});
   for(const p of pairs){const address=p?.baseToken?.address;if(p.chainId!=='solana'||!missing.includes(address))continue;
    const old=cache.get(address);cache.set(address,{at:now,image:old.image||safeArtUrl(p.info?.imageUrl),twitter:old.twitter||coinXFromMetadata(p)});
   }
   while(cache.size>512)cache.delete(cache.keys().next().value);
  }}
 }catch{/* Retain the idea and known source data during provider outages. */}
 return concepts.map(c=>({...c,source_refs:(c.source_refs||[]).map(r=>{const address=mintOf(r),meta=cache.get(address);return meta?{...r,address,source_image_url:meta.image||null,twitter_url:meta.twitter||null,social_source:'dexscreener_contract_metadata'}:r;})}));
}
