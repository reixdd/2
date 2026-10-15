// Read-only JARVIS market bridge. No direct credentials, wallets, trades or extra schedulers.
const SOL=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const str=(v,n=100)=>String(v??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,n);
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const first=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&x!=='')??null;
const imageUrl=raw=>{try{if(typeof raw!=='string')return null;const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&raw.length<400?u.href:null}catch{return null}};
const rows=(payload,kind)=>{
 const data=payload?.data??payload;
 if(Array.isArray(data))return data;
 if(kind==='trenches')return Array.isArray(data?.new_creation)?data.new_creation:[];
 return Array.isArray(data?.items)?data.items:Array.isArray(data?.rank)?data.rank:Array.isArray(data?.list)?data.list:[];
};
function normalize(row,kind,now,freshnessMs){
 if(!row||typeof row!=='object')return null;
 const a=row.token&&typeof row.token==='object'?row.token:row;
 const key=typeof row.identity_key==='string'?row.identity_key:'';
 const address=str(first(a.address,a.token_address,a.tokenAddress,a.contract,a.mint,row.base_token_address,row.baseToken?.address,kind==='radar'&&key.startsWith('sol:')?key.split(':')[1]:null),64);
 if(!SOL.test(address)||(row.chain&&!['sol','solana'].includes(row.chain)))return null;
 const observed=str(first(row.last_observed_at,row.observed_at),40);
 const seen=observed&&!Number.isNaN(Date.parse(observed))?observed:new Date(now).toISOString();
 const age=now-Date.parse(seen);
 const recordedAge=num(row.observation_age_seconds);
 const fresh=age>=0&&age<=freshnessMs&&!(kind==='radar'&&(row.live_eligible===false||(recordedAge!==null&&recordedAge>freshnessMs/1000)));
 const rawCreated=num(first(row.creation_timestamp,row.created_timestamp,row.created_at,row.pairCreatedAt,row.launch_at));
 const created_at=rawCreated&&rawCreated>1e9?new Date(rawCreated<1e12?rawCreated*1000:rawCreated).toISOString():null;
 const provider=kind==='radar'?'JARVIS · DexScreener/GeckoTerminal':'GMGN via JARVIS';
 return {chain:'sol',address,name:str(first(a.name,a.token_name,row.name),90),symbol:str(first(a.symbol,a.token_symbol,row.symbol),20),
 kind,provider,providers:[provider],observed_at:seen,created_at,freshness:fresh?'FRESH':'STALE',
 image_url:imageUrl(first(a.logo,a.image_url,a.imageUrl,a.icon,a.logoURI,a.image?.url,row.image_url,row.info?.imageUrl)),
 market_cap_usd:num(first(row.market_cap,row.marketcap,row.marketCap)),
 liquidity_usd:num(first(row.liquidity,row.liquidity_usd,row.liquidity?.usd)),
 volume_5m_usd:num(first(row.volume_5m,row.volume?.m5)),
 buys_5m:num(first(row.buys_5m,row.txns?.m5?.buys)),sells_5m:num(first(row.sells_5m,row.txns?.m5?.sells)),
 safety:str(first(row.risk,row.security?.status),40)||'UNVERIFIED',
 paid_attention:num(first(row.dexscr_boost_fee,row.boost_amount,row.boosts?.active,0))>0,
 url:'https://gmgn.ai/sol/token/'+address,source_status:'OBSERVED'};
}
export function normalizeMarketResponses(responses={}, {now=Date.now(),freshnessMs=15*60_000}={}){
 const map=new Map();
 for(const [kind,response] of Object.entries(responses)){
  if(!response?.ok||!response?.data)continue;
  const payload=kind==='radar'?response.data:response.data.data;
  for(const row of rows(payload,kind)){
   const s=normalize(row,kind,now,freshnessMs);if(!s)continue;
   const old=map.get(s.address);
   if(old){
    old.providers=[...new Set([...old.providers,s.provider])];
    // Join GMGN discovery with existing JARVIS DexScreener/GeckoTerminal
    // token metrics; never turn missing 5m values into invented zeroes.
    for(const field of ['volume_5m_usd','liquidity_usd','buys_5m','sells_5m','market_cap_usd']){
      if(old[field]===null&&s[field]!==null)old[field]=s[field];
    }
    if(!old.image_url&&s.image_url)old.image_url=s.image_url;
    if(s.freshness==='FRESH'&&old.freshness==='STALE')old.freshness='FRESH';
   }
   else map.set(s.address,s);
  }
 }
 return {observed_at:new Date(now).toISOString(),signals:[...map.values()].filter(s=>s.freshness==='FRESH').slice(0,12),
  source_states:Object.fromEntries(Object.entries(responses).map(([k,v])=>[k,v?.ok?'OK':str(v?.error||'UNAVAILABLE',120)])),research_only:true};
}
export async function collectJarvisMarkets({baseUrl='http://127.0.0.1:8768',fetchImpl=fetch,now=Date.now(),signal}={}){
 const u=new URL(baseUrl);
 if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/')
  throw Error('JARVIS market bridge accepts loopback origin only');
 const routes={trenches:'/api/operator/gmgn/trenches?chain=sol&limit=20',trending:'/api/operator/gmgn/trending?chain=sol&interval=5m&limit=20',radar:'/api/operator/radar?limit=40'};
 const output={};
 await Promise.all(Object.entries(routes).map(async([kind,route])=>{
  try{const guard=signal?AbortSignal.any([signal,AbortSignal.timeout(9000)]):AbortSignal.timeout(9000);
   const response=await fetchImpl(u.origin+route,{headers:{accept:'application/json'},signal:guard});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   output[kind]=data?.ok===false?{ok:false,error:str(data.error||data.state||'GMGN unavailable')}:{ok:true,data};
  }catch(e){output[kind]={ok:false,error:str(e.message)}}
 }));
 return normalizeMarketResponses(output,{now});
}
export function marketPromptEvidence(signals=[]){
 return signals.filter(x=>x.freshness==='FRESH').slice(0,6).map(x=>({
  url:x.url,title:(x.symbol||x.name||'Solana token')+' / '+x.kind+' / '+x.provider,
  observed_at:x.observed_at,address:x.address,provider:x.provider,
  summary:(x.name||'Unnamed')+' ('+(x.symbol||'?')+') | 5m volume USD '+(x.volume_5m_usd??'unknown')+
  ' | liquidity USD '+(x.liquidity_usd??'unknown')+' | paid='+(x.paid_attention?'yes':'unknown/no reported boost')+' | safety='+x.safety
 }));
}