import {artworkCandidates,matchesMarketFilter} from './market-data.js';

const cash=v=>typeof v==='number'&&Number.isFinite(v)?'$'+v.toLocaleString(undefined,{maximumFractionDigits:2}):'—';

const age=(v,now)=>{const n=Date.parse(v||'');if(!Number.isFinite(n))return 'Unknown';const sec=Math.max(0,Math.floor((now-n)/1000));return sec<60?sec+'s':sec<3600?Math.floor(sec/60)+'m '+sec%60+'s':sec<86400?Math.floor(sec/3600)+'h':Math.floor(sec/86400)+'d';};

export class MarketFeed {

 constructor(root){this.root=root;this.cards=new Map();root.innerHTML='<div class="market-feed-meta"><span>Source observations / no launch inferred</span><span class="market-health" role="status"></span></div><div class="market-source-warning" hidden></div><div class="market-grid" tabindex="0" role="region" aria-label="Scrollable market observations"></div><div class="market-feed-count"></div>';this.grid=root.querySelector('.market-grid');}

 create(row){const card=document.createElement('article');card.className='market-card';card.dataset.contract=row.address;card.innerHTML='<div class="market-card-image"><img hidden decoding="async" referrerpolicy="no-referrer"><span class="market-image-error">ARTWORK PENDING</span></div><div class="market-card-body"><div class="market-card-title"><b></b><span></span></div><p class="market-card-name"></p><div class="market-card-stats"><span>5M VOLUME<strong data-stat="vol"></strong></span><span>LIQUIDITY<strong data-stat="liq"></strong></span><span>BUYS / SELLS<strong data-stat="txns"></strong></span><span>MARKET CAP<strong data-stat="mc"></strong></span><span>PAIR AGE<strong data-stat="age"></strong></span></div><div class="market-card-foot"><small class="market-age"></small><a target="_blank" rel="noopener noreferrer">TRACE SOURCE ↗</a></div><details><summary>Provenance &amp; timestamps</summary><dl class="market-provenance"></dl></details><small class="market-card-disclaimer"></small></div>';

 const state={card,img:card.querySelector('img'),candidates:[],failed:new Map(),loaded:null,pending:false};state.img.addEventListener('error',()=>{state.loaded=null;state.img.hidden=true;this.loadArt(state);});this.cards.set(row.address,state);return state;}

 loadArt(state){if(state.loaded||state.pending)return;const candidate=state.candidates.find(c=>!state.failed.has(c.url)||Date.now()-state.failed.get(c.url)>60000);if(!candidate){state.card.querySelector('.market-image-error').hidden=false;return;}state.pending=true;const probe=new Image();probe.referrerPolicy='no-referrer';let settled=false;const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);state.pending=false;if(ok){state.loaded=candidate.url;state.img.src=candidate.url;state.img.hidden=false;state.img.dataset.provenance=candidate.provider;state.card.querySelector('.market-image-error').hidden=true;}else{state.failed.set(candidate.url,Date.now());if(state.failed.size>32)state.failed.delete(state.failed.keys().next().value);this.loadArt(state);}};const timer=setTimeout(()=>finish(false),6000);probe.onload=()=>finish(probe.naturalWidth>0);probe.onerror=()=>finish(false);probe.src=candidate.url;}

 render(snapshot,filter='all',now=Date.now()){

 const all=snapshot?.signals||[],rows=all.filter(s=>matchesMarketFilter(s,filter,now,snapshot?.new_window_ms||300000)).slice(0,100);

 for(const option of document.querySelectorAll('#dit-live-filter option')){const labels={new:'NEW / VERIFIED 5M',recent:'RECENT / OBSERVED 24H',trending:'TRENDING',all:'ALL OBSERVATIONS'};const count=all.filter(s=>matchesMarketFilter(s,option.value,now,snapshot?.new_window_ms||300000)).length;option.textContent=(labels[option.value]||option.value)+' ('+count+')';}
 const sources=Object.entries(snapshot?.source_states||{}).map(([k,v])=>k+': '+v).join(' / ');

 const times=all.map(s=>Date.parse(s.source_observed_at||'')).filter(Number.isFinite),latest=times.length?Math.max(...times):null;

 const delayed=snapshot?.stale||!latest||now-latest>180000;

 this.root.querySelector('.market-health').textContent=(delayed?'DELAYED / RETAINED DATA':'SOURCE CURRENT')+' · Last source '+(latest?age(new Date(latest).toISOString(),now)+' ago':'unknown');

 const warning=this.root.querySelector('.market-source-warning');warning.hidden=rows.length>0;warning.textContent=!all.length?'Market source unavailable. '+(sources||'Waiting for JARVIS observations.'):filter==='new'?'No verified launches in the last 5 minutes. '+all.filter(r=>!r.pair_time_verified).length+' rows lack verified pair timestamps.':filter==='trending'?'The upstream trending source has no current results. '+sources:'No source observations from the last 24 hours.';

 this.root.querySelector('.market-feed-count').textContent='> '+rows.length+' / '+all.length+' observations · scroll inside the feed';

 const wanted=new Set(rows.map(r=>r.address));for(const [address,state] of this.cards)if(!wanted.has(address))state.card.remove();

 for(const row of rows){const state=this.cards.get(row.address)||this.create(row),card=state.card;const position=rows.indexOf(row);if(this.grid.children[position]!==card)this.grid.insertBefore(card,this.grid.children[position]||null);const put=(q,v)=>{const n=card.querySelector(q);if(n.textContent!==String(v))n.textContent=String(v);};

 put('.market-card-title b',row.symbol||'Unknown');put('.market-card-title span',matchesMarketFilter(row,'new',now,snapshot?.new_window_ms||300000)?'NEW PAIR':row.kind||'OBSERVATION');put('.market-card-name',row.name||row.address);

 put('[data-stat="vol"]',cash(row.volume_5m_usd));put('[data-stat="liq"]',cash(row.liquidity_usd));put('[data-stat="mc"]',cash(row.market_cap_usd));put('[data-stat="txns"]',(row.buys_5m??'—')+' / '+(row.sells_5m??'—'));put('[data-stat="age"]',row.pair_time_verified?age(row.pair_created_at,now):'Unverified');

 for(const [key,stat] of [['volume_5m_usd','vol'],['liquidity_usd','liq'],['market_cap_usd','mc']]){const p=row.metric_sources?.[key];card.querySelector('[data-stat="'+stat+'"]').title=(p?.provider||row.provider||'Unknown source')+' / '+(p?.observed_at||'Source time unknown');}

 put('.market-age',(row.provider||'JARVIS')+' · '+(row.source_observed_at?age(row.source_observed_at,now)+' ago':'Source time unknown'));

 put('.market-card-disclaimer','Safety: '+(row.safety||'UNVERIFIED')+(row.paid_attention?' · Paid attention reported':''));const a=card.querySelector('a');a.href='https://gmgn.ai/sol/token/'+encodeURIComponent(row.address);

 const entries=[['Contract',row.address],['Pair created',row.pair_time_verified?row.pair_created_at:'Unverified'],['Token created',row.token_created_at],['First observed',row.first_observed_at],['Source observed',row.source_observed_at],['Server received',row.received_at],['Sources',sources]];const key=JSON.stringify(entries);if(card.dataset.provenance!==key){card.dataset.provenance=key;const dl=card.querySelector('dl');dl.replaceChildren();for(const [label,value] of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'Unknown';dl.append(dt,dd);}}

 state.candidates=artworkCandidates([...(row.image_candidates||[]),row.image_url,...state.candidates].filter(Boolean),row.provider);state.img.alt=(row.name||row.symbol||'Token')+' artwork';this.loadArt(state);

 }

 // Bound retained DOM/artwork metadata while keeping recently seen contracts stable.

 if(this.cards.size>150)for(const [key,state] of this.cards){if(!state.card.isConnected&&!state.pending){this.cards.delete(key);if(this.cards.size<=100)break;}}

 }

}
