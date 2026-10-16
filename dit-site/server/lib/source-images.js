// Exact-contract read-only image recovery for historical agent research.
import {artworkCandidates} from '../../dist/market-data.js';
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ttl=15*60_000, cache=new Map();
export function normalizeImageMints(value){
 return [...new Set(String(value||'').split(',').map(x=>x.trim()).filter(x=>MINT.test(x)))].slice(0,20);
}
export async function lookupSourceImages(input,{fetchImpl=fetch,now=Date.now(),cacheStore=cache}={}){
 const mints=Array.isArray(input)?[...new Set(input.filter(x=>MINT.test(x)))].slice(0,20):normalizeImageMints(input);
 const out={};const missing=[];
 for(const mint of mints){const cached=cacheStore.get(mint);
  if(cached&&now-cached.at<ttl){if(cached.image)out[mint]=cached.image;}
  else missing.push(mint);
 }
 if(missing.length){
  // One bounded batch request; pair address must match the mint exactly.
  try{
   const response=await fetchImpl('https://api.dexscreener.com/tokens/v1/solana/'+missing.join(','),{
    headers:{accept:'application/json'},signal:AbortSignal.timeout(4800)});
   if(response.ok){
    const rows=await response.json();if(Array.isArray(rows))for(const p of rows){
     const mint=p?.baseToken?.address;
     if(!missing.includes(mint)||p.chainId!=='solana'||out[mint])continue;
     const [image]=artworkCandidates([p.info?.imageUrl,p.info?.image_url,p.info?.logoUrl],'DexScreener exact contract');
     if(image)out[mint]=image;
    }
   }
  }catch{}
  const stillMissing=missing.filter(m=>!out[m]);
  if(stillMissing.length)try{
   const response=await fetchImpl('https://api.geckoterminal.com/api/v2/networks/solana/tokens/multi/'+stillMissing.join(','),{
    headers:{accept:'application/json;version=20230203'},signal:AbortSignal.timeout(4800)});
   if(response.ok){
    const result=await response.json();if(Array.isArray(result?.data))for(const x of result.data){
     const mint=x?.attributes?.address||(typeof x?.id==='string'&&x.id.startsWith('solana_')?x.id.slice(7):null);
     if(!stillMissing.includes(mint)||out[mint])continue;
     const [image]=artworkCandidates([x.attributes?.image_url],'GeckoTerminal exact contract');
     if(image)out[mint]=image;
    }
   }
  }catch{}
  for(const mint of missing)cacheStore.set(mint,{at:now,image:out[mint]||null});
  if(cacheStore.size>500)for(const key of [...cacheStore.keys()].slice(0,cacheStore.size-400))cacheStore.delete(key);
 }
 return {images:Object.fromEntries(Object.entries(out).map(([mint,item])=>[mint,{url:item.url,provider:item.provider}])),source:'EXACT_CONTRACT_METADATA',disclaimer:'Images belong to referenced source tokens, not proposed agent coins.'};
}
