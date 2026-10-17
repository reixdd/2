const $=id=>document.getElementById(id);
const state={tab:'concepts',concepts:[],market:[],sources:null,selected:null,busy:false,seen:false};
const txt=(v,f='—')=>v===null||v===undefined||v===''?f:String(v);
const short=(v,n=22)=>String(v||'').length>n?String(v).slice(0,n-1)+'…':String(v||'');
const date=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toLocaleString():'Unknown';};
const ago=v=>{const t=Date.parse(v||'');if(!Number.isFinite(t))return 'UNKNOWN AGE';const s=Math.max(0,Math.round((Date.now()-t)/1000));return s<60?s+'s AGO':s<3600?Math.floor(s/60)+'m AGO':Math.floor(s/3600)+'h AGO'};
const num=(v,places=2)=>v===null||v===undefined||!Number.isFinite(Number(v))?'NOT REPORTED':Number(v).toLocaleString(undefined,{maximumFractionDigits:places});
const fmtUsd=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'NOT REPORTED':'$'+num(v);
const el=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n};
const clear=(target)=>{target.replaceChildren();return target};
function link(href,title){const a=el('a','source-link',title);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a}
function imageBox(url,name,large=false){const box=el('div',large?'detail-image':'item-art');if(url){const img=el('img');img.src=url;img.alt='Source artwork for '+name;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();box.textContent=(name||'?').slice(0,1)};box.append(img)}else box.textContent=(name||'?').slice(0,1);return box}
function button(label,cl,click){const b=el('button',cl,label);b.type='button';b.addEventListener('click',click);return b}
async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});let d;try{d=await r.json()}catch{throw Error('Invalid server response')}if(!r.ok)throw Error(d.error||'HTTP '+r.status);return d}
function showLogin(){ $('login-screen').hidden=false;$('workspace').hidden=true;state.seen=false;}
function showApp(){ $('login-screen').hidden=true;$('workspace').hidden=false;state.seen=true;}
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();const access=$('access-code').value;const msg=$('login-error');msg.textContent='VERIFYING…';
 try{await api('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:access})});$('access-code').value='';msg.textContent='';showApp();await load()}catch(err){msg.textContent=err.message}
});
$('logout').addEventListener('click',async()=>{await api('/logout',{method:'POST'}).catch(()=>{});showLogin()});
$('refresh').addEventListener('click',()=>load(true));
$('tab-concepts').addEventListener('click',()=>setTab('concepts'));
$('tab-market').addEventListener('click',()=>setTab('market'));
$('search').addEventListener('input',renderList);$('sort').addEventListener('change',renderList);
function setTab(tab){if(state.tab===tab)return;state.tab=tab;state.selected=null;$('tab-concepts').classList.toggle('active',tab==='concepts');$('tab-market').classList.toggle('active',tab==='market');$('tab-concepts').setAttribute('aria-pressed',tab==='concepts');$('tab-market').setAttribute('aria-pressed',tab==='market');$('sort').hidden=tab==='market';$('search').value='';renderList();renderDetails()}
async function load(force=false){
 if(state.busy)return;state.busy=true;$('refresh').disabled=true;
 try{
  const d=await api('/api/data');state.concepts=d.concepts||[];state.market=d.market||[];state.sources=d.sources;$('metric-concepts').textContent=String(state.concepts.length);$('metric-ready').textContent=String(state.concepts.filter(c=>c.complete).length);$('metric-market').textContent=String(state.market.length);$('updated-at').textContent='FETCHED '+date(d.checked_at)+' / EVERY 15s';
  const healthy=d.sources?.market?.ok&&d.sources?.concepts?.ok,partly=d.sources?.market?.ok||d.sources?.concepts?.ok;
  $('source-status').classList.toggle('bad',!healthy);$('source-status').innerHTML='';$('source-status').append(el('span','signal-dot'),document.createTextNode(healthy?' LIVE SOURCES':partly?' DEGRADED':' SOURCES OFFLINE'));
  $('metric-health').textContent=healthy?'ONLINE':partly?'PARTIAL':'OFFLINE';$('metric-health-sub').textContent=healthy?'Feeds responding':partly?'Some feeds unavailable':'No fresh observations';
  const warning=$('source-warning');const problems=[];if(!d.sources?.concepts?.ok)problems.push('Concepts: '+txt(d.sources?.concepts?.error,'not available'));if(!d.sources?.market?.ok)problems.push('Market: '+txt(d.sources?.market?.error||d.sources?.market?.status,'stale snapshot'));
  warning.hidden=!problems.length;warning.textContent=problems.length?'SOURCE NOTICE / '+problems.join(' • ')+' — No fake data will be substituted.':'';
  renderList();if(force||!document.activeElement?.matches('input,textarea'))renderDetails();
 }catch(err){if(err.message==='Local login required'){showLogin();return}$('source-warning').hidden=false;$('source-warning').textContent='LOCAL DATA API ERROR / '+err.message;$('source-status').textContent=' OFFLINE'}
 finally{state.busy=false;$('refresh').disabled=false}
}
function sorted(){const q=$('search').value.toLowerCase().trim(),rows=state.tab==='concepts'?[...state.concepts]:[...state.market];const matches=rows.filter(r=>[r.name,r.ticker,r.symbol,r.agent,r.provider,r.narrative,...(r.sources||[]).map(s=>s.title)].some(x=>String(x||'').toLowerCase().includes(q)));
 if(state.tab==='concepts'){const sort=$('sort').value;if(sort==='recent')matches.sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));else if(sort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));else matches.sort((a,b)=>b.readiness-a.readiness||(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));}
 else matches.sort((a,b)=>(Date.parse(b.observed_at)||0)-(Date.parse(a.observed_at)||0));return matches}
function renderList(){const list=clear($('items')),rows=sorted();$('list-title').textContent=state.tab==='concepts'?'AGENT-GENERATED IDEAS':'OBSERVED MARKET SIGNALS';$('list-count').textContent=rows.length+' RECORDS';
 if(!rows.length){list.append(el('div','empty',state.tab==='concepts'?'No stored concepts match this filter. A live source may also be unavailable.':'No observed tokens match this filter. Missing data is not filled in.'));return}
 for(const r of rows){const concept=state.tab==='concepts';const key=concept?r.id:r.address;const item=el('button','item'+(state.selected===key?' selected':''));item.type='button';item.append(imageBox(concept?r.artwork_url:r.image_url,r.name));const center=el('div','item-center');center.append(el('div','item-name',txt(r.name,concept?'UNTITLED CONCEPT':'UNKNOWN TOKEN')+'  /  $'+txt(concept?r.ticker:r.symbol,'?')));center.append(el('div','item-sub',concept?txt(r.agent)+'  ·  '+r.readiness+'/6 FIELDS  ·  '+ago(r.created_at):txt(r.provider)+'  ·  '+ago(r.observed_at)));item.append(center);const tag=el('span','tag'+(concept?(r.complete?'':' warn'):' ghost'),concept?(r.complete?'COMPLETE':'NEEDS '+r.missing.length):'SOURCE');item.append(tag);item.addEventListener('click',()=>{state.selected=key;renderList();renderDetails()});list.append(item)}
}
function block(root,title,copy,muted=false){const s=el('section','detail-section');s.append(el('h3',null,title));s.append(el('p',muted?'muted':null,copy||'Not provided'));root.append(s);return s}
function badges(root,labels){const wrap=el('div','meta-row');labels.forEach(([s,type])=>wrap.append(el('span','meta-chip '+(type||''),s)));root.append(wrap)}
function section(root,title){const s=el('section','detail-section');s.append(el('h3',null,title));root.append(s);return s}
function textbox(parent,label,type,value,placeholder=''){const l=el('label');l.append(document.createTextNode(label));let input;if(type==='textarea'){input=el('textarea');input.rows=3;input.value=value||''}else{input=el('input');input.type='url';input.value=value||''}input.placeholder=placeholder;l.append(input);parent.append(l);return input}
async function copy(text,msg){try{await navigator.clipboard.writeText(text);msg.textContent='COPIED TO CLIPBOARD'}catch{msg.textContent='Clipboard unavailable; use export instead.'}}
function exportDraft(c){const data={research_only:true,not_a_token_launch:true,agent:c.agent,name:c.name,ticker:c.ticker,x_url:c.x_url,artwork_url:c.artwork_url,artwork_brief:c.artwork_brief,narrative:c.narrative,hook:c.hook,social_draft:c.social_draft,notes:c.notes,source_references:c.sources,missing_fields:c.missing,prepared_at:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const href=URL.createObjectURL(blob);const a=el('a');a.href=href;a.download='dit-concept-'+(c.ticker||'draft').toLowerCase()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000)}
function renderDetails(){const root=clear($('details'));const concept=state.tab==='concepts',r=(concept?state.concepts:state.market).find(x=>(concept?x.id:x.address)===state.selected);
 if(!r){root.append(el('div','detail-empty'));const d=root.firstChild;d.append(el('div','orbit','◉'),el('h2',null,'SELECT A SIGNAL'),el('p',null,'Choose an agent concept or market observation to inspect its evidence and metadata.'));return}
 const header=el('div','detail-header');header.append(imageBox(concept?r.artwork_url:r.image_url,r.name,true));const h=el('div','detail-heading');h.append(el('small',null,concept?txt(r.agent)+' / STORED CONCEPT':txt(r.provider)+' / MARKET OBSERVATION'),el('h2',null,txt(r.name)+'  $'+txt(concept?r.ticker:r.symbol)),el('small',null,concept?'CREATED '+date(r.created_at):'OBSERVED '+date(r.observed_at)));header.append(h);root.append(header);
 if(concept){
  badges(root,[[r.readiness+'/6 FIELDS',r.complete?'good':'warn'],[r.status.toUpperCase(),''],[r.x_url?'X LINK READY':'NO X LINK',r.x_url?'good':'warn'],[r.sources.length+' SOURCES',r.sources.length?'':'warn']]);
  if(r.missing.length)block(root,'MISSING FIELDS',r.missing.join(' · '),true);
  block(root,'AGENT NARRATIVE',r.narrative);block(root,'ARTWORK DIRECTION',r.artwork_brief||'No artwork brief provided.',!r.artwork_brief);block(root,'SOCIAL DRAFT',r.social_draft||'No social draft provided.',!r.social_draft);
  const sec=section(root,'LOCAL DRAFT ENRICHMENT / SAVED ONLY HERE');const form=el('form','detail-form');const x=textbox(form,'ORIGINAL CONCEPT X PROFILE',null,r.x_url,'https://x.com/yourproject');const art=textbox(form,'CONCEPT ARTWORK HTTPS URL',null,r.artwork_url,'https://...');const notes=textbox(form,'PRIVATE REVIEW NOTES','textarea',r.notes,'Evidence, missing details, next review…');sec.append(form);const actions=el('div','action-row');const save=button('SAVE LOCAL DRAFT','action-button strong',async()=>{save.disabled=true;feedback.textContent='SAVING…';try{await api('/api/draft/'+encodeURIComponent(r.id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x_url:x.value,artwork_url:art.value,notes:notes.value})});feedback.textContent='SAVED LOCALLY — NOT PUBLISHED';await load(true)}catch(e){feedback.textContent='FAILED: '+e.message}finally{save.disabled=false}});actions.append(save);
  actions.append(button('COPY METADATA','action-button',()=>copy([r.name,r.ticker,x.value,art.value,r.narrative].join('\n'),feedback)));
  actions.append(button('EXPORT JSON','action-button',()=>exportDraft({...r,x_url:x.value,artwork_url:art.value,notes:notes.value})));
  sec.append(actions);const feedback=el('div','inline-feedback');sec.append(feedback);
  const src=section(root,'SOURCE EVIDENCE / ORIGINAL LINKS');const links=el('div','source-list');if(!r.sources.length)links.append(el('p','muted','No recorded source references.'));else r.sources.forEach(s=>{const a=link(s.url,s.title||s.url);a.append(el('span',null,date(s.observed_at)));links.append(a)});src.append(links);
  if(r.x_url){const links=section(root,'PROJECT SOCIAL LINK');links.append(link(r.x_url,r.x_url))}
 }else{
  badges(root,[['SOURCE '+r.provider,''],['SAFETY '+r.safety,r.safety==='UNVERIFIED'?'warn':''],['X '+(r.twitter_url?'ON FILE':'NOT REPORTED'),'']]);
  const m=section(root,'SOURCE-REPORTED MARKET METRICS');const table=el('div','source-list');for(const [label,val] of [['PRICE / USD',fmtUsd(r.price_usd)],['MARKET CAP',fmtUsd(r.market_cap_usd)],['5M VOLUME',fmtUsd(r.volume_5m_usd)],['5M BUYS',num(r.buys_5m,0)],['5M SELLS',num(r.sells_5m,0)],['LIQUIDITY',fmtUsd(r.liquidity_usd)]]){const row=el('div','meta-chip');row.textContent=label+'  /  '+val;table.append(row)}m.append(table);
  block(root,'PROVENANCE',`Provider: ${r.provider}\nObserved at: ${date(r.observed_at)}\nPair created: ${date(r.pair_created_at)}\nAddress: ${r.address}`,true);
  const links=section(root,'ORIGINAL SOURCE LINKS');const wrap=el('div','source-list');if(r.address)wrap.append(link('https://gmgn.ai/sol/token/'+encodeURIComponent(r.address),'GMGN / TOKEN RESEARCH ↗'));if(r.twitter_url)wrap.append(link(r.twitter_url,'SOURCE-PROVIDED X PROFILE ↗'));links.append(wrap);
 }
}
setInterval(()=>{$('clock').textContent=new Date().toLocaleTimeString()},1000);setInterval(()=>{if(state.seen)load()},15000);
(async()=>{try{await api('/api/data');showApp();await load()}catch(e){showLogin()}})();
