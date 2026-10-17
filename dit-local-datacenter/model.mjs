// Data normalization is deliberately independent of the production site.
// A source token's X profile is never silently presented as an agent concept's account.
const text=(v,n=1000)=>String(v??'').trim().slice(0,n);
const numeric=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
export function safeHttps(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=750?u.href:null}catch{return null}}
export function safeX(raw){
 const u=safeHttps(raw);if(!u)return null;const x=new URL(u);
 if(!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(x.hostname.toLowerCase()))return null;
 if(!/^\/[A-Za-z0-9_]{1,15}\/?$/.test(x.pathname))return null;
 const handle=x.pathname.split('/')[1].toLowerCase();if(['home','search','explore','intent','share','settings','login','signup','messages'].includes(handle))return null;
 return 'https://x.com/'+x.pathname.split('/')[1];
}
export function validateDraft(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid draft');
 const v={};for(const field of ['x_url','artwork_url','notes']){
  if(Object.hasOwn(payload,field)){
   if(typeof payload[field]!=='string')throw Error('Invalid '+field);
   const item=payload[field].trim();
   if(field==='x_url'){const url=item?safeX(item):null;if(item&&!url)throw Error('X link must be an HTTPS profile on x.com');v[field]=url}
   if(field==='artwork_url'){const url=item?safeHttps(item):null;if(item&&!url)throw Error('Artwork URL must be HTTPS');v[field]=url}
   if(field==='notes'){if(item.length>1500)throw Error('Notes too long');v[field]=item}
  }
 }
 return v;
}
export function normalizeConcept(row={},draft={}){
 const c=row.content&&typeof row.content==='object'?row.content:{};
 const refs=(Array.isArray(row.source_refs)?row.source_refs:[]).filter(r=>r&&safeHttps(r.url)).slice(0,15).map(r=>({url:safeHttps(r.url),title:text(r.title||r.url,135),observed_at:r.observed_at||null}));
 const originalX=safeX(draft.x_url||c.x_url||c.twitter_url||c.social_url);
 const art=safeHttps(draft.artwork_url||c.image_url||c.artwork_url);
 const result={id:text(row.id,120),agent:text(row.agent_id||c.origin_agent||'UNKNOWN',40),name:text(c.name,90),ticker:text(c.ticker,10).toUpperCase(),narrative:text(c.narrative,3500),hook:text(c.hook,160),social_draft:text(c.social_draft,1300),artwork_brief:text(c.artwork_brief,1400),x_url:originalX,artwork_url:art,notes:text(draft.notes,1500),sources:refs,created_at:row.created_at||null,status:text(row.status||'review',30),confidence:numeric(c.confidence)};
 const missing=[];if(!result.name)missing.push('Name');if(!/^[A-Z0-9]{2,10}$/.test(result.ticker))missing.push('Ticker');if(!result.x_url)missing.push('X link');if(!result.artwork_url)missing.push('Artwork');if(!result.narrative)missing.push('Narrative');if(!result.sources.length)missing.push('Sources');
 result.missing=missing;result.complete=missing.length===0;result.readiness=6-missing.length;return result;
}
export function rankConcepts(rows){return [...rows].sort((a,b)=>b.readiness-a.readiness||(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||a.name.localeCompare(b.name))}
export function normalizeMarket(s={}){
 return {address:text(s.address,48),name:text(s.name,90),symbol:text(s.symbol,24),provider:text(s.provider||'Not reported',70),observed_at:s.observed_at||null,received_at:s.received_at||null,kind:text(s.kind||'radar',30),image_url:(Array.isArray(s.image_candidates)&&s.image_candidates.map(c=>safeHttps(c.url)).find(Boolean))||safeHttps(s.image_url),twitter_url:safeX(s.twitter_url),price_usd:numeric(s.price_usd),market_cap_usd:numeric(s.market_cap_usd??s.market_cap),volume_5m_usd:numeric(s.volume_5m_usd??s.volume5m_usd),buys_5m:numeric(s.buys_5m),sells_5m:numeric(s.sells_5m),liquidity_usd:numeric(s.liquidity_usd),safety:text(s.safety||'UNVERIFIED',50),pair_created_at:s.pair_created_at||null};
}
