// Live cinematic machine composition. Real state comes only from JARVIS APIs.
const IDS=['GHOST_001','NULL_ENTITY','ECHO.exe'];
const ROLES=['THE ARCHIVIST','THE SIGNAL HUNTER','THE VIRAL MACHINE'];
const ART=['/assets/cutouts/ghost_001.png','/assets/cutouts/null_entity.png','/assets/cutouts/echo_exe.png'];
const COLORS=['#6bbdff','#ce86ff','#86edb4'];
const fmtSol=lamports=>Number.isFinite(Number(lamports))&&Number(lamports)>=0?(Number(lamports)/1e9).toLocaleString(undefined,{maximumFractionDigits:4})+' SOL':'—';
const shortEvent=e=>e?.event_type==='job_dead'?'RUN FAILED — OPEN OPERATOR FOR ERROR':String(e?.title||'NO RECORDED SIGNAL');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=id=>document.getElementById(id);
export function roomSummary(world,market,events=[]){
 const configured=Array.isArray(world?.agents)?world.agents.length:null;
 const rows=Array.isArray(market?.signals)?market.signals:null;
 return {agents:configured,pairs:rows?rows.length:null,
   events:Array.isArray(events)?events.filter(x=>x?.agent_id&&x?.title).length:0,
   status:rows&&rows.length?(market.stale?'LAST VERIFIED':'LIVE'):'AWAITING SOURCE',
   checked:market?.last_checked_at||null};
}
export function mountControlRoom({openAgent,activateTab}={}){
 const stage=el('stage'),live=el('dit-live');
 if(!stage||!live||stage.querySelector('.dit-room'))return;
 // Main HTML already loads the control-room stylesheet; avoid duplicate downloads/reflows.
 stage.classList.add('dit-functional-stage');
 const cards=IDS.map((id,i)=>
   '<article class="dit-entity" style="--agent-accent:'+COLORS[i]+'" data-id="'+esc(id)+'"><button type="button" class="dit-entity-open" data-room-agent="'+esc(id)+'" aria-label="Open '+esc(id)+' dossier">'+
   '<span class="dit-entity-ring"></span><img class="dit-entity-art" src="'+ART[i]+'" alt="'+esc(id)+' machine portrait" decoding="async"></button>'+
   '<div class="dit-entity-meta dit-room-agent-strip"><small>ENTITY_00'+(i+1)+' / '+ROLES[i]+'</small><div><strong>'+esc(id)+'</strong>'+
   '<em id="dit-room-status-'+i+'">UNKNOWN</em></div><p id="dit-room-recent-'+i+'">_ WAITING FOR VERIFIED EVENTS</p>'+
   '<div class="dit-entity-actions"><button type="button" data-room-agent="'+esc(id)+'">VIEW DOSSIER ↗</button><button type="button" data-vote="'+esc(id)+'">VOTE ↗</button></div></div></article>').join('');
 const shell=document.createElement('section');shell.className='dit-room';shell.setAttribute('aria-label','JARVIS machine control room');
 shell.innerHTML='<div class="dit-motion-field" aria-hidden="true"><i></i><i></i><i></i><span></span></div>'+
   '<header class="dit-room-top"><a href="#stage" class="dit-room-brand">◇ DIT <small>// PROTOCOL_001 TRACKING</small></a>'+
   '<nav class="dit-hud-nav" aria-label="Machine terminal navigation"><button id="dit-nav-network" type="button">01 / NETWORK</button><button id="dit-nav-transmissions" type="button">02 / TRANSMISSIONS</button><button id="dit-nav-system" type="button" aria-controls="dit-hud-system" aria-expanded="false">03 / SYSTEM</button></nav>'+
   '<span class="dit-room-live" id="dit-room-protocol">_ AWAITING MARKET OBSERVATIONS</span>'+
   '<div class="dit-hud-controls"><button type="button" id="dit-appearance" aria-pressed="false">APPEARANCE</button><button type="button" id="dit-gfx-toggle" aria-pressed="true">GFX ON</button><button type="button" id="dit-hud-expand" aria-expanded="false" aria-controls="dit-hud-system" aria-label="Toggle system diagnostics">＋</button></div></header>'+
   '<div class="dit-room-title"><span>PROTOCOL_001 / JARVIS EVIDENCE ENGINE</span><h1>DEAD INTERNET THEORY<span class="dit-blink">_</span></h1>'+
   '<p>THE INTERNET IS NO LONGER YOURS. THREE MACHINES. ONE OBSERVABLE NETWORK.</p></div>'+
   '<div class="dit-room-metrics"><div><strong id="dit-room-pairs">—</strong><span>OBSERVED PAIRS</span></div>'+
   '<div><strong id="dit-room-events">—</strong><span>RECENT EVENTS LOADED</span></div>'+
   '<div><strong id="dit-room-agents">—</strong><span>CONFIGURED AGENTS</span></div>'+
   '<div><strong id="dit-room-freshness">UNAVAILABLE</strong><span>MARKET STATUS</span></div></div>'+
   '<div class="dit-room-stage-wrap"><aside class="dit-ops-rail" id="dit-treasury"><span class="dit-rail-kicker">[ OPERATION TREASURY ]</span>'+
   '<strong class="dit-ops-heading" id="dit-treasury-target">—</strong><p>CREATOR-FEE ALLOCATION TARGET</p>'+
   '<div class="dit-treasury-meter"><span id="dit-treasury-bar"></span></div>'+
   '<div><span>CONFIRMED FEES</span><b id="dit-treasury-confirmed">—</b></div>'+
   '<div><span>PENDING ALLOCATION</span><b id="dit-treasury-pending">—</b></div>'+
   '<div><span>OBSERVED / UNVERIFIED</span><b id="dit-treasury-observed">—</b></div>'+
   '<small id="dit-treasury-status">WAITING FOR VERIFIED LEDGER</small>'+
   '<button type="button" id="dit-treasury-open">VIEW TREASURY ↗</button></aside>'+
   '<div class="dit-entity-stage">'+cards+'</div>'+
   '<aside class="dit-status-rail"><span class="dit-rail-kicker">[ SIGNAL STATUS ]</span>'+IDS.map((id,i)=>'<div><strong>'+esc(id)+'</strong><span id="dit-rail-state-'+i+'">UNKNOWN</span></div>').join('')+
   '<p>Agent states are reported by the connected research worker.</p></aside></div>'+
   '<div class="dit-room-bottom"><span id="dit-room-ticker">_ OBSERVE → VALIDATE → CLASSIFY → REMEMBER → SHORTLIST → PROPOSE → REVIEW</span>'+
   '<button type="button" id="dit-transmission-open">VIEW ALL TRANSMISSIONS →</button></div>'+
   '<div class="dit-transmission-ribbon"><span class="dit-rail-kicker">// RECENT TRANSMISSIONS</span>'+
   '<div id="dit-transmission-ribbon" aria-live="off"><span>AWAITING RECORDED AGENT EVENTS</span></div></div>'+
   '<section class="dit-hud-system" id="dit-hud-system" aria-label="System diagnostics" hidden>'+
   '<strong>SYSTEM / READ-ONLY DIAGNOSTICS</strong><p id="dit-system-summary">AWAITING RESEARCH STATUS</p>'+
   '<p id="dit-system-market">MARKET: AWAITING DATA</p><p id="dit-system-error">WORKER STATUS: UNKNOWN</p>'+
   '<a href="/operator">OPEN OPERATOR ↗</a></section>';
 // Restore the original cinematic layers *behind* the functioning terminal.
 // One WebGL canvas renders all three portraits; real dossiers remain native buttons.
 const scenery=document.createElement('div');scenery.className='dit-scenery';scenery.setAttribute('aria-hidden','true');
 scenery.innerHTML='<div class="dit-world-canvas"></div><div class="dit-world-bars">'+
   Array.from({length:28},(_,i)=>'<span style="--bar-h:'+((17+i*29)%65+18)+'%;--bar-i:'+i+'"></span>').join('')+'</div>';
 stage.appendChild(scenery);
 const cinematic=document.createElement('div');
 cinematic.innerHTML='<div id="dit-stage" class="dit-scene-bg" data-mode="ambient" aria-hidden="true"></div>';
 shell.querySelector('.dit-entity-stage')?.prepend(cinematic.firstElementChild);
 stage.appendChild(shell);
 stage.addEventListener('click',e=>{const btn=e.target.closest('[data-room-agent]');if(btn){e.preventDefault();openAgent?.(btn.dataset.roomAgent)}});
 const system=el('dit-hud-system');const toggleSystem=()=>{const showing=system.hidden;system.hidden=!showing;
   el('dit-nav-system').setAttribute('aria-expanded',String(showing));el('dit-hud-expand').setAttribute('aria-expanded',String(showing));};
 el('dit-nav-system').addEventListener('click',toggleSystem);
 el('dit-hud-expand').addEventListener('click',toggleSystem);
 el('dit-nav-network').addEventListener('click',()=>el('dit-live-evidence-section')?.scrollIntoView({behavior:'smooth'}));
 const openActivity=()=>{activateTab?.('activity');el('dit-live-transmission-section')?.scrollIntoView({behavior:'smooth'});};
 el('dit-nav-transmissions').addEventListener('click',openActivity);
 el('dit-transmission-open').addEventListener('click',openActivity);
 el('dit-appearance').addEventListener('click',()=>{const contrast=stage.classList.toggle('dit-high-contrast');el('dit-appearance').setAttribute('aria-pressed',String(contrast));});
 el('dit-gfx-toggle').addEventListener('click',()=>{const enabled=!stage.classList.toggle('dit-gfx-off');const button=el('dit-gfx-toggle');
   button.textContent=enabled?'GFX ON':'GFX OFF';button.setAttribute('aria-pressed',String(enabled));
   window.dispatchEvent(new CustomEvent('dit:gfx',{detail:{enabled}}));});
 el('dit-treasury-open').addEventListener('click',()=>window.dispatchEvent(new Event('dit:open-treasury')));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&system&&!system.hidden){system.hidden=true;
   el('dit-nav-system')?.setAttribute('aria-expanded','false');el('dit-hud-expand')?.setAttribute('aria-expanded','false');}});
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
export function updateControlRoom(world,market,events=[],treasury=null){
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
  put('dit-room-recent-'+i,latest?'_ '+shortEvent(latest).slice(0,82):'_ NO RECORDED EVENTS');
  put('dit-rail-state-'+i,(agent?.presence||'UNKNOWN').toUpperCase());
  const flow=document.querySelectorAll('.dit-flow-agent')[i];
  if(flow){flow.dataset.active=latest?'true':'false';const b=flow.querySelector('b');
   if(b)b.textContent=latest?String(latest.title).slice(0,75):'NO RECORDED SIGNAL';}
 });
 const recent=events.find(e=>e?.title&&IDS.includes(e.agent_id));
 put('dit-flow-status',recent?'_ '+recent.agent_id+' / '+String(recent.title).slice(0,125):'_ WAITING FOR RECORDED EVENTS');
 put('dit-room-ticker',recent?'_ LAST RESEARCH EVENT / '+recent.agent_id+' // '+shortEvent(recent).slice(0,116):'_ AWAITING VERIFIED RESEARCH EVENTS / NEVER SIMULATED');
 const stat=el('dit-transmission-ribbon');
 const recentEvents=(Array.isArray(events)?events:[]).filter(e=>e?.title&&IDS.includes(e.agent_id)).slice(0,5);
 const ribbonKey=recentEvents.map(e=>String(e.id)+'|'+String(e.title)).join(';');
 if(stat&&stat.dataset.events!==ribbonKey){
  stat.dataset.events=ribbonKey;
  stat.replaceChildren();
  if(!recentEvents.length){const span=document.createElement('span');span.textContent='AWAITING RECORDED AGENT EVENTS';stat.append(span);}
  for(const ev of recentEvents){const button=document.createElement('button');button.type='button';button.dataset.liveEvent=String(ev.id);
   const small=document.createElement('small');small.textContent=ev.agent_id+' / '+String(ev.event_type||'EVENT').toUpperCase();
   const headline=document.createElement('strong');headline.textContent=shortEvent(ev).slice(0,95);
   button.append(small,headline);stat.append(button);}
 }
 const percent=Number(treasury?.target_percent);
 const known=treasury&&treasury.totals&&Number.isFinite(percent)&&percent>=0&&percent<=100;
 put('dit-treasury-target',known?percent.toFixed(percent%1?1:0)+'%':'—');
 const totals=treasury?.totals;
 put('dit-treasury-confirmed',known?fmtSol(totals.confirmed_lamports):'—');
 put('dit-treasury-pending',known?fmtSol(totals.pending_treasury_lamports):'—');
 put('dit-treasury-observed',known?fmtSol(totals.observed_lamports):'—');
 put('dit-treasury-status',known?'RECORDED LEDGER / TRANSFERS NOT ASSUMED':'LEDGER UNAVAILABLE / NO VALUES INFERRED');
 if(el('dit-treasury-bar'))el('dit-treasury-bar').style.width=known?percent+'%':'0%';
 const failure=(Array.isArray(events)?events:[]).find(e=>e?.event_type==='job_dead');
 put('dit-system-summary','JARVIS: '+(world?.researcher?.online?'WORKER HEARTBEAT RECEIVED':'WORKER OFFLINE / UNVERIFIED'));
 put('dit-system-market','MARKET: '+v.status+' / '+(v.checked?new Date(v.checked).toLocaleString():'NO SNAPSHOT'));
 put('dit-system-error',failure?'JOB FAILURE / '+failure.agent_id+' — '+String(failure.detail||'Retry attempts exhausted').slice(0,170)+' — OPEN OPERATOR':'NO PERMANENT JOB FAILURE IN LOADED EVENTS');
 const right=el('dit-room');if(right)right.dataset.worker=world?.researcher?.online?'online':'offline';
}
