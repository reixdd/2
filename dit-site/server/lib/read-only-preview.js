// Optional localhost-only READ-ONLY preview of already-public hosted research.
// No credentials, cookies, mutation, or direct browser cross-origin access.
const HOST='https://dead-internet-theory-network.deadinternetproject.chatgpt.site';
const allowed=/^\/api\/(?:concepts(?:\/[0-9a-f-]{36})?|activity)$/i;
export function createPublicResearchPreview({fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map();
 async function remote(requestUrl){
  const u=new URL(requestUrl);
  if(!allowed.test(u.pathname))return null;
  const url=new URL(HOST+u.pathname);
  const limit=Number(u.searchParams.get('limit'));
  if(Number.isInteger(limit)&&limit>=1)url.searchParams.set('limit',String(Math.min(50,limit)));
  const before=u.searchParams.get('before');
  if(before&&Number.isFinite(Date.parse(before)))url.searchParams.set('before',new Date(before).toISOString());
  const key=url.href,prior=cache.get(key);
  if(prior&&now()-prior.at<15000)return prior.value;
  try{
   const response=await fetchImpl(key,{method:'GET',headers:{accept:'application/json'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(3500)});
   if(!response.ok)return null;
   const data=await response.json();
   if(!data||typeof data!=='object'||Array.isArray(data))return null;
   cache.set(key,{at:now(),value:data});if(cache.size>30)cache.delete(cache.keys().next().value);
   return data;
  }catch{return null;}
 }
 async function preview(url,localResponse){
  const u=new URL(url);if(!allowed.test(u.pathname))return localResponse;
  if(!localResponse||![200,404].includes(localResponse.status))return localResponse;
  let local={};try{local=await localResponse.clone().json()}catch{return localResponse;}
  const data=await remote(url);if(!data)return localResponse;
  if(u.pathname.startsWith('/api/concepts/')){
   if(localResponse.status===200)return localResponse;
   return data.concept?Response.json({...data,preview_source:'hosted_public_read_only'}):localResponse;
  }
  const key=u.pathname==='/api/activity'?'events':'concepts';
  const localRows=Array.isArray(local[key])?local[key]:[];
  const remoteRows=Array.isArray(data[key])?data[key]:[];
  const seen=new Set(localRows.map(r=>r.id).filter(Boolean));
  const additional=remoteRows.filter(r=>!r?.id||!seen.has(r.id)).map(r=>({...r,preview_origin:'hosted_public_read_only'}));
  const size=Number(u.searchParams.get('limit'))||24;
  const merged=[...localRows,...additional].slice(0,Math.min(60,Math.max(1,size)));
  return Response.json({...local,[key]:merged,preview_source:'local_plus_hosted_public_read_only',
    next_before:key==='concepts'?(data.next_before||local.next_before||null):undefined});
 }
 return {preview};
}
