// Only canonical source-backed X/Twitter links associated with an exact Solana mint.
// General articles, keyword matches, and guessed social handles are not evidence.
const SOL=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const blocked=new Set(['home','intent','share','search','explore','notifications','messages','settings','i','compose','hashtag','login','signup','tos','privacy']);
export function canonicalCoinXUrl(input){
 if(typeof input!=='string'||input.length>500)return null;
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.username||u.password||!['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(u.hostname.toLowerCase()))return null;
  const match=/^\/([A-Za-z0-9_]{1,15})(?:\/status\/(\d{5,25}))?\/?$/.exec(u.pathname);
  if(!match||blocked.has(match[1].toLowerCase()))return null;
  return 'https://x.com/'+match[1]+(match[2]?'/status/'+match[2]:'');
 }catch{return null;}
}
export function coinXFromMetadata(row){
 if(!row||typeof row!=='object')return null;
 const sources=[row,row.info,row.metadata].filter(Boolean);
 for(const meta of sources){
  const links=[...(Array.isArray(meta.socials)?meta.socials:[]),
    ...(Array.isArray(meta.links)?meta.links:[])];
  for(const l of links){
   if(!l||typeof l!=='object'||!/^(twitter|x)$/i.test(String(l.type||l.platform||l.label||'')))continue;
   const direct=canonicalCoinXUrl(l.url||l.link||l.href);
   if(direct)return direct;
   // DexScreener info.socials may provide {platform:'twitter',handle:'@name'}.
   // Only accept a handle explicitly labeled as a source-provided X social.
   const handle=String(l.handle||'').trim().replace(/^@/,'');
   if(/^[A-Za-z0-9_]{1,15}$/.test(handle)){
     const url=canonicalCoinXUrl('https://x.com/'+handle);
     if(url)return url;
   }
   const linked=canonicalCoinXUrl(l.handle);
   if(linked)return linked;
  }
  for(const key of ['twitter_url','twitterUrl','x_url','xUrl','twitter']){
   const url=canonicalCoinXUrl(meta[key]);if(url)return url;
  }
 }
 return null;
}
const getAddress=o=>o?.evidence?.token_address||o?.evidence?.mint||
 o?.metadata?.token_address||o?.token_address||o?.contract_address||
 o?.address||o?.mint;
export function linkedCoinXEvidence(observations=[],signals=[]){
 const byMint=new Map((Array.isArray(signals)?signals:[]).filter(s=>SOL.test(s?.address||'')&&
   canonicalCoinXUrl(s.twitter_url)).map(s=>[s.address,s]));
 const found=new Map();
 for(const o of Array.isArray(observations)?observations:[]){
  const address=getAddress(o);
  if(!SOL.test(address||''))continue;
  const market=byMint.get(address);
  const known=market?canonicalCoinXUrl(market.twitter_url):null;
  // Archived source observations may carry an exact-address DexScreener
  // profile link, even when the coin is no longer in the live market cache.
  const profile=String(o?.external_id||'')==='dsp:'+address;
  const archived=profile?canonicalCoinXUrl(o?.evidence?.x_url):null;
  const url=known||archived;
  if(!url||found.has(address+'|'+url))continue;
  found.set(address+'|'+url,{address,url,symbol:market?.symbol||null,
    observed_at:o?.observed_at||null,origin:known?'Coin metadata':'Recorded DexScreener profile'});
 }
 return [...found.values()].slice(0,8);
}
