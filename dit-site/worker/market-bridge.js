import {timestamp,artworkCandidates,mergeMarketRows} from '../dist/market-data.js';
import {enrichVerifiedPairs} from './pair-metadata.js';
// Read-only JARVIS market bridge. No direct credentials, wallets, trades or extra schedulers.
const SOL=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const str=(v,n=100)=>String(v??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,n);
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const first=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&x!=='')??null;
const stamp=timestamp;
const rows=(payload,kind)=>{
 const data=payload?.data??payload;
 if(Array.isArray(data))return data;
 if(kind==='trenches')return Array.isArray(data?.new_creation)?data.new_creation:[];
 return Array.isArray(data?.items)?data.items:Array.isArray(data?.rank)?data.rank:Array.isArray(data?.list)?data.list:Array.isArray(data?.tokens)?data.tokens:[];
};
function normalize(row,kind,now,freshnessMs){
 if(!row||typeof row!=='object')return null;
 const a=row.token&&typeof row.token==='object'?row.token:row;
 const key=typeof row.identity_key==='string'?row.identity_key:'';
 const address=str(first(a.address,a.token_address,a.tokenAddress,a.contract,a.mint,row.base_token_address,row.baseToken?.address,kind==='radar'&&key.startsWith('sol:')?key.split(':')[1]:null),64);
 if(!SOL.test(address)||(row.chain&&!['sol','solana'].includes(String(row.chain).toLowerCase())))return null;
 const recordedAge=num(row.observation_age_seconds);
 const upstream=stamp(first(row.last_observed_at,row.observed_at,row.timestamp,row.time));
 const source_observed_at=upstream||(recordedAge!==null&&recordedAge>=0?new Date(now-recordedAge*1000).toISOString():null);
 // A fetched response is not proof that an undated source emitted a new observation.
 const received_at=new Date(now).toISOString();
 const provider_response_at=stamp(row._provider_response_at);
 const seen=source_observed_at||provider_response_at||received_at;
 const age=now-Date.parse(seen);
 const fresh=age>=-60_000&&age<=freshnessMs&&row.live_eligible!==false;
 const pair_created_at=stamp(first(row.pair_created_at,row.pairCreatedAt,row.pairCreatedTime,row.pool_created_at,row.poolCreatedAt,row.pair?.created_at,row.pool?.created_at,(['DEX Screener','GeckoTerminal'].includes(row.provider)&&row.pool&&row.provenance?.independent_observation===true)?row.launch_at:null));
 const token_created_at=stamp(first(row.token_created_at,row.tokenCreatedAt,row.creation_timestamp,row.created_timestamp,row.created_at,a.creation_timestamp));
 const created_at=pair_created_at||token_created_at;
 const provider=kind==='radar'?'JARVIS · DexScreener/GeckoTerminal':kind==='tape'?'JARVIS · '+str(row.provider||'SENSE / Market Tape',50):'GMGN via JARVIS';
 const image_candidates=artworkCandidates([a.logo,a.image_url,a.imageUrl,a.icon,a.logoURI,a.image?.url,row.image_url,row.imageUrl,row.info?.imageUrl,row.info?.image_url,a.metadata?.image,row.metadata?.image,row.baseToken?.logo,row.baseToken?.logoURI],provider);
 const result={chain:'sol',address,name:str(first(a.name,a.token_name,row.name),90),symbol:str(first(a.symbol,a.token_symbol,row.symbol),20),
 kind,kinds:[kind],provider,providers:[provider],pair_created_at,token_created_at,pair_time_verified:!!pair_created_at,pair_time_source:pair_created_at?provider:null,first_observed_at:received_at,first_seen_at:received_at,observed_at:seen,source_observed_at,provider_response_at,received_at,created_at,freshness:fresh?'FRESH':'STALE',
 image_candidates,image_url:image_candidates[0]?.url||null,
 market_cap_usd:num(first(row.market_cap,row.marketcap,row.marketCap)),
 liquidity_usd:num(first(row.liquidity?.usd,row.liquidity_usd,typeof row.liquidity==='object'?null:row.liquidity)),
 volume_5m_usd:num(first(row.volume_5m,row.volume?.m5)),
 buys_5m:num(first(row.buys_5m,row.txns?.m5?.buys)),sells_5m:num(first(row.sells_5m,row.txns?.m5?.sells)),
 safety:str(first(row.risk,row.security?.status),40)||'UNVERIFIED',
 paid_attention:num(first(row.dexscr_boost_fee,row.boost_amount,row.boosts?.active,0))>0,
 url:'https://gmgn.ai/sol/token/'+address,source_status:source_observed_at?'OBSERVED':'SOURCE_TIME_UNKNOWN'};
 result.metric_sources=Object.fromEntries(['volume_5m_usd','liquidity_usd','buys_5m','sells_5m','market_cap_usd'].filter(k=>result[k]!==null).map(k=>[k,{provider,observed_at:source_observed_at||provider_response_at,basis:source_observed_at?'source':provider_response_at?'fresh_api_response':'unknown'}]));
 return result;
}
export function normalizeMarketResponses(responses={}, {now=Date.now(),freshnessMs=15*60_000}={}){
 const map=new Map();
 for(const [kind,response] of Object.entries(responses)){
  if(!response?.ok||!response?.data)continue;
  const payload=kind==='radar'||kind==='tape'?response.data:response.data.data;
  for(const row of rows(payload,kind)){
   const freshApi=['trenches','trending'].includes(kind)&&response.data.cached===false&&response.data.source==='GMGN official CLI';
   const s=normalize({...row,_provider_response_at:freshApi?new Date(now).toISOString():null},kind,now,freshnessMs);if(!s)continue;
   const old=map.get(s.address);
   map.set(s.address,mergeMarketRows(old,s));
  }
 }
 return {observed_at:new Date(now).toISOString(),signals:[...map.values()].filter(s=>s.freshness==='FRESH').sort((a,b)=>Number(!!(b.source_observed_at||b.provider_response_at))-Number(!!(a.source_observed_at||a.provider_response_at))).slice(0,100),
  source_states:Object.fromEntries(Object.entries(responses).map(([k,v])=>[k,v?.ok?'OK':str(v?.error||'UNAVAILABLE',120)])),research_only:true};
}
export async function collectJarvisMarkets({baseUrl='http://127.0.0.1:8768',fetchImpl=fetch,now=Date.now(),signal,tapeOnly=false,enrichPairs=false}={}){
 const u=new URL(baseUrl);
 if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/')
  throw Error('JARVIS market bridge accepts loopback origin only');
 const routes=tapeOnly?{tape:'/api/tape?limit=100'}:{
  trenches:'/api/operator/gmgn/trenches?chain=sol&limit=20',
  trending:'/api/operator/gmgn/trending?chain=sol&interval=5m&limit=20',
  radar:'/api/operator/radar?limit=40',tape:'/api/tape?limit=100'};
 const output={};
 await Promise.all(Object.entries(routes).map(async([kind,route])=>{
  try{const guard=signal?AbortSignal.any([signal,AbortSignal.timeout(9000)]):AbortSignal.timeout(9000);
   const response=await fetchImpl(u.origin+route,{headers:{accept:'application/json'},signal:guard});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   output[kind]=data?.ok===false?{ok:false,error:str(data.error||data.state||'GMGN unavailable')}:{ok:true,data};
  }catch(e){output[kind]={ok:false,error:str(e.message)}}
 }));
 const normalized=normalizeMarketResponses(output,{now});
 return enrichPairs&&!tapeOnly?enrichVerifiedPairs(normalized,{now,fetchImpl,signal}):normalized;
}
export function marketPromptEvidence(signals=[]){
 return signals.filter(x=>x.freshness==='FRESH').slice(0,6).map(x=>({
  url:x.url,title:(x.symbol||x.name||'Solana token')+' / '+x.kind+' / '+x.provider,
  observed_at:x.observed_at,address:x.address,provider:x.provider,
  summary:(x.name||'Unnamed')+' ('+(x.symbol||'?')+') | 5m volume USD '+(x.volume_5m_usd??'unknown')+
  ' | liquidity USD '+(x.liquidity_usd??'unknown')+' | paid='+(x.paid_attention?'yes':'unknown/no reported boost')+' | safety='+x.safety
 }));
}
