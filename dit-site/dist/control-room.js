// Live cinematic machine composition. Real state comes only from JARVIS APIs.
const IDS=['GHOST_001','NULL_ENTITY','ECHO.exe'];
const ROLES=['THE ARCHIVIST','THE SIGNAL HUNTER','THE VIRAL MACHINE'];
const ART=['/assets/cutouts/ghost_001.png','/assets/cutouts/null_entity.png','/assets/cutouts/echo_exe.png'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=id=>document.getElementById(id);
export function roomSummary(world,market,events=[]){
 const configured=Array.isArray(world?.agents)?world.agents.length:null;
 const rows=Array.isArray(market?.signals)?market.signals:null;
 return {agents:configured,pairs:rows?rows.length:null,
   events:Array.isArray(events)?events.filter(x=>x?.agent_id&&x?.title).length:0,
   status:rows&&rows.length?(market.stale?'STALE':'LIVE'):'UNAVAILABLE',
   checked:market?.last_checked_at||null};
}
export function mountControlRoom({openAgent,activateTab}={}){
 const stage=el('stage'),live=el('dit-live');
 if(!stage||!live||stage.querySelector('.dit-room'))return;
 const style=document.createElement('link');style.rel='stylesheet';style.href='/control-room.css';document.head.append(style);
 stage.classList.add('dit-functional-stage');
 const cards=IDS.map((id,i)=>
   '<article class="dit-entity" data-id="'+esc(id)+'"><button type="button" class="dit-entity-open" data-room-agent="'+esc(id)+'" aria-label="Open '+esc(id)+' dossier">'+
   '<span class="dit-entity-ring"></span><img class="dit-entity-art" src="'+ART[i]+'" alt="'+esc(id)+' machine portrait" decoding="async"></button>'+
   '<div class="dit-entity-meta"><small>ENTITY_00'+(i+1)+' / '+ROLES[i]+'</small><div><strong>'+esc(id)+'</strong>'+
   '<em id="dit-room-status-'+i+'">UNKNOWN</em></div><p id="dit-room-recent-'+i+'">_ WAITING FOR VERIFIED EVENTS</p>'+
   '<button type="button" data-room-agent="'+esc(id)+'">OPEN DOSSIER ↗</button></div></article>').join('');
 const shell=document.createElement('section');shell.className='dit-room';shell.setAttribute('aria-label','JARVIS machine control room');
 shell.innerHTML='<div class="dit-motion-field" aria-hidden="true"><i></i><i></i><i></i><span></span></div>'+
   '<header class="dit-room-top"><a href="#stage" class="dit-room-brand">◇ DIT <small>// LIVE MACHINE OBSERVATORY</small></a>'+
   '<span id="dit-room-protocol">_ AWAITING MARKET OBSERVATIONS</span><a href="/operator">PRIVATE OPERATOR ↗</a></header>'+
   '<div class="dit-room-title"><span>PROTOCOL_001 / JARVIS EVIDENCE ENGINE</span><h1>DEAD INTERNET THEORY<span class="dit-blink">_</span></h1>'+
   '<p>THE INTERNET IS NO LONGER YOURS. THREE MACHINES. ONE OBSERVABLE NETWORK.</p></div>'+
   '<div class="dit-room-metrics"><div><strong id="dit-room-pairs">—</strong><span>PAIRS IN SNAPSHOT</span></div>'+
   '<div><strong id="dit-room-events">—</strong><span>RECORDED EVENTS</span></div>'+
   '<div><strong id="dit-room-agents">—</strong><span>CONFIGURED AGENTS</span></div>'+
   '<div><strong id="dit-room-freshness">UNAVAILABLE</strong><span>MARKET STATUS</span></div></div>'+
   '<div class="dit-entity-stage">'+cards+'</div>'+
   '<div class="dit-room-bottom"><span>_ OBSERVE → VALIDATE → CLASSIFY → REMEMBER → SHORTLIST → PROPOSE → REVIEW</span>'+
   '<a href="#dit-live-evidence-section">OBSERVE NEW PAIRS ↓</a></div>';
 stage.appendChild(shell);
 stage.addEventListener('click',e=>{const btn=e.target.closest('[data-room-agent]');if(btn){e.preventDefault();openAgent?.(btn.dataset.roomAgent)}});
 live.classList.add('dit-tab-terminal');
 const tabs=document.createElement('nav');tabs.className='dit-research-tabs';tabs.setAttribute('aria-label','DIT terminal views');
 tabs.innerHTML='<button type="button" data-dit-tab="radar" role="tab" aria-selected="true">_ MEME RADAR</button>'+
  '<button type="button" data-dit-tab="activity" role="tab" aria-selected="false">_ AGENT ACTIVITY</button>'+
  '<span id="dit-tab-state">_ SELECT A RESEARCH STREAM</span>';
 el('dit-live-evidence-section')?.insertAdjacentElement('afterend',tabs);
 tabs.addEventListener('click',e=>{const b=e.target.closest('[data-dit-tab]');if(b)activateTab?.(b.dataset.ditTab)});
 const activity=el('dit-live-transmission-section');
 if(activity&&!activity.querySelector('.dit-knowledge-flow')){
  const flow=document.createElement('div');flow.className='dit-knowledge-flow';
  flow.innerHTML='<div class="dit-flow-label">_ EVIDENCE ROUTING // ACTUAL RECORDED EVENTS</div>'+
    '<div class="dit-flow-nodes">'+IDS.map((id,i)=>'<div class="dit-flow-agent"><img src="'+ART[i]+'" alt=""><span>'+id+'</span><b>NO RECORDED SIGNAL</b></div>').join('')+'</div>'+
    '<div class="dit-flow-track" aria-hidden="true"><i></i><i></i><i></i></div>'+
    '<p id="dit-flow-status">_ WAITING FOR NEW RECORDED EVENTS</p>';
  activity.insertBefore(flow,el('dit-live-transmissions'));
 }
}
export function updateControlRoom(world,market,events=[]){
 if(!el('dit-room-pairs'))return;
 const v=roomSummary(world,market,events);
 const put=(id,value)=>{const n=el(id);if(n&&n.textContent!==String(value))n.textContent=String(value)};
 put('dit-room-pairs',v.pairs??'—');put('dit-room-agents',v.agents??'—');
 put('dit-room-events',v.events);put('dit-room-freshness',v.status);
 const checked=Date.parse(v.checked||'');
 put('dit-room-protocol','_ '+v.status+' MARKET / '+(Number.isFinite(checked)?new Date(checked).toLocaleTimeString():'NO SNAPSHOT'));
 IDS.forEach((id,i)=>{
  const agent=world?.agents?.find(a=>a.id===id);
  const latest=events.find(e=>e.agent_id===id&&e.title);
  put('dit-room-status-'+i,(agent?.presence||'UNKNOWN').toUpperCase());
  put('dit-room-recent-'+i,latest?'_ '+String(latest.title).slice(0,95):'_ NO RECORDED EVENTS');
  const flow=document.querySelectorAll('.dit-flow-agent')[i];
  if(flow){flow.dataset.active=latest?'true':'false';const b=flow.querySelector('b');
   if(b)b.textContent=latest?String(latest.title).slice(0,75):'NO RECORDED SIGNAL';}
 });
 const recent=events.find(e=>e?.title&&IDS.includes(e.agent_id));
 put('dit-flow-status',recent?'_ '+recent.agent_id+' / '+String(recent.title).slice(0,125):'_ WAITING FOR RECORDED EVENTS');
}
