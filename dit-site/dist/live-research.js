// Live display for the uploaded MIAMI SIGNAL HTML. Real backend records only.
(async () => {
  const {agentPortrait,conceptArtwork,formatActivity,researchHook,safeArtUrl,compact}=await import('./terminal-ui.js');
  const $ = id => document.getElementById(id);
  const hero=document.getElementById('stage'),controls=document.querySelector('.bottom-bar');
  if(hero&&controls)hero.insertAdjacentElement('afterend',controls); // keep original audio/FX directly below artwork
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const when = x => x && Number.isFinite(Date.parse(x)) ? new Date(x).toLocaleString() : 'No record';
  const valid = x => {try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
  const link=(x,label)=>valid(x)?'<a rel="noopener noreferrer" target="_blank" href="'+esc(valid(x))+'">'+esc(label||x)+' ↗</a>':esc(label||'Source unavailable');
  const api=async path=>{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
  const ids=['GHOST_001','NULL_ENTITY','ECHO.exe'];
  let world=null,observations=[],runs=[],concepts=[],events=[],busy=false,liveMarket=null,marketBusy=false,localDrafts=[];
  let marketStructureKey='',activityStructureKey='',conceptStructureKey='',lastActivityTime=0;
  for(const [id,title] of [['dit-live-evidence-section','NEW PAIRS // EVIDENCE'],['dit-live-transmission-section','AGENT ACTIVITY'],['dit-live-concept-section','MEME RADAR // APPROVED CONCEPTS']]){
    const heading=document.querySelector('#'+id+' h2');if(heading)heading.textContent=title;
  }
  // Same HTML reference, new information architecture: MEME RADAR before ACTIVITY.
  const conceptSection=$('dit-live-concept-section'),activitySection=$('dit-live-transmission-section');
  if(conceptSection&&activitySection&&conceptSection.parentNode===activitySection.parentNode){
    activitySection.parentNode.insertBefore(conceptSection,activitySection);
  }
  const nav=document.querySelector('.dit-live nav');
  if(nav){const conceptLink=nav.querySelector('a[href="#dit-live-concept-section"]');
    const activityLink=nav.querySelector('a[href="#dit-live-transmission-section"]');
    if(conceptLink&&activityLink)nav.insertBefore(conceptLink,activityLink);}
    const buzz=x=>Array.isArray(x)?x.slice(0,4).map(y=>'#'+String(y).replace(/^#/,'')).join(' · '):'';
  const portrait=(id,cls='terminal-avatar')=>agentPortrait(id)?'<img class="'+cls+'" src="'+esc(agentPortrait(id))+'" alt="'+esc(id)+' portrait" loading="lazy">':'';
  const artTile=(c,cls)=>{const a=conceptArtwork(c,liveMarket?.signals||[]);
    return '<div class="'+cls+'">'+(a.url?'<img src="'+esc(a.url)+'" alt="'+esc(a.label)+'" loading="lazy" decoding="async">':'<span>_ NO ART</span>')+
    '<small>'+esc(a.label)+'</small></div>';};

  const teaser=x=>String(x||'').split('CONCEPT_JSON')[0].split('```')[0].replace(/\s+/g,' ').trim().slice(0,180);
  const dlg=$('dit-live-dialog');
  const open=(title,html)=>{$('dit-live-modal-title').textContent=title;$('dit-live-modal-body').innerHTML=html;if(!dlg.open)dlg.showModal()};
  $('dit-live-close').onclick=()=>dlg.close();
  const agent=id=>world?.agents?.find(x=>x.id===id);
  async function detail(id){
    open(id,'<p>_ RETRIEVING VERIFIED AGENT ACTIVITY...</p>');
    try{
      const d=await api('/api/agents/'+encodeURIComponent(id)),a=agent(id);
      const recent=(d.activity||[]).slice(0,6).map(formatActivity).filter(Boolean);
      const history=(d.research_runs||[]).filter(r=>r.status==='completed').slice(0,3);
      $('dit-live-modal-body').innerHTML='<div class="terminal-modal-head">'+portrait(id)+
        '<div><span class="terminal-prompt">_ '+esc(id)+' / '+esc(a?.presence||'offline')+'</span><p>LAST OBSERVED: '+esc(when(a?.last_run?.finished_at))+'</p></div></div>'+
        '<h3>_ RECENT DECISIONS &amp; EVENTS</h3>'+
        (recent.map(ev=>'<p class="terminal-detail-line">_ '+esc(ev.title)+'<small>'+esc(when(ev.at))+' / '+esc(ev.status)+'</small></p>').join('')||'<p>_ No recorded events</p>')+
        '<h3>_ MEME HOOKS</h3>'+(
        history.map(r=>'<p class="terminal-detail-line">_ '+esc(researchHook(r.answer)||'Research completed; no validated concise hook')+
          '<small>'+esc(when(r.finished_at))+'</small></p>').join('')||'<p>_ No completed meme hooks</p>')+
        '<a class="terminal-action" href="/operator">OPEN PRIVATE OPERATOR / FULL TRACE ↗</a>';
    }catch{$('dit-live-modal-body').textContent='Agent data is currently unavailable.'}
  }
  async function showConcept(id){
    open('ATTENTION ANATOMY','<p>Loading approved concept…</p>');
    try{
      const c=(await api('/api/concepts/'+encodeURIComponent(id))).concept,x=c.content||{},a=x.attention_anatomy||{};
      $('dit-live-modal-body').innerHTML='<div class="terminal-modal-head">'+artTile(c,'terminal-concept-art')+
        '<div><span class="terminal-prompt">_ APPROVED // '+esc(x.ticker)+'</span><h2>'+esc(x.name)+'</h2><p>'+esc(x.hook||x.narrative)+'</p></div></div>'+
        '<h3>_ CONCEPT // SHORT BRIEF</h3><p>'+esc(compact(x.narrative).slice(0,250))+'</p>'+
        '<h3>_ EVIDENCE</h3>'+((c.source_refs||[]).slice(0,6).map(s=>'<p>'+link(s.url,s.title)+'</p>').join('')||'<p>_ No verified source attached</p>')+
        '<h3>_ STATUS</h3><p>Human-reviewed fictional concept. No asset has been launched.</p>'+
        (x.social_draft?'<h3>_ DRAFT TEXT // NOT POSTED</h3><blockquote>'+esc(x.social_draft)+'</blockquote>':'');
    }catch{$('dit-live-modal-body').textContent='Concept not currently published.'}
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-live-agent],[data-live-concept],[data-live-event]');if(b?.dataset.liveAgent)detail(b.dataset.liveAgent);if(b?.dataset.liveConcept)showConcept(b.dataset.liveConcept);
    if(b?.dataset.liveEvent){const event=events.find(x=>String(x.id)===b.dataset.liveEvent);if(event){
      const ev=formatActivity(event);open('_ '+ev.agent_id+' / '+ev.status,
        '<div class="terminal-modal-head">'+portrait(ev.agent_id)+'<div><h2>'+esc(ev.title)+'</h2><p>'+esc(when(ev.at))+'</p></div></div>'+
        '<h3>_ RECORDED EVENT</h3><p>'+esc(ev.detail||'No additional detail recorded')+'</p><button data-live-agent="'+esc(ev.agent_id)+'">AGENT TIMELINE ↗</button>');}}});
  document.addEventListener('click',e=>{
    const b=e.target.closest('.stage [data-view],.stage [data-vote],.panel [data-modal-vote]');if(!b)return;
    const view=b.dataset.view;
    if(!b.dataset.vote&&!b.dataset.modalVote&&!['ghost','null','echo','network','transmissions','treasury'].includes(view))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(b.dataset.vote||b.dataset.modalVote)return open('ACCOUNT REQUIRED','<p>Voting requires a verified signed-in account; no sample votes are counted.</p>');
    if(view==='ghost')return detail(ids[0]);if(view==='null')return detail(ids[1]);if(view==='echo')return detail(ids[2]);
    if(view==='network')return $('dit-live-network')?.scrollIntoView({behavior:'smooth'});
    if(view==='transmissions')return $('dit-live-transmissions')?.scrollIntoView({behavior:'smooth'});
    if(view==='treasury')return open('RESEARCH ACCOUNTING','<p>No simulated fees or unverified financial balances are presented as real.</p>');
  },true);
  function render(){
    const completedRecently=runs.some(r=>r.status==='completed'&&r.finished_at&&Date.now()-Date.parse(r.finished_at)<20*60_000);
    $('dit-live-status').textContent=world?.researcher?.online?(completedRecently?'RECENT RESEARCH RECORDED':'RESEARCH WORKER CONNECTED / INFERENCE UNVERIFIED'):'RESEARCH WORKER OFFLINE OR STALE';
    $('dit-live-metrics').textContent='CULTURAL COLLECTOR '+(world?.collector?.online?'ONLINE':'OFFLINE')+' / LAST HEARTBEAT '+when(world?.researcher?.last_seen_at);
    if($('health'))$('health').textContent=world?.researcher?.online?'WORKER HEARTBEAT RECEIVED':'OFFLINE';
    $('dit-live-network').innerHTML=world?ids.map(id=>{
      const a=agent(id),r=a?.last_run||{},presence=a?.presence||'offline';
      return '<article class="live-agent"><span class="agent-name">'+esc(id)+'</span><span class="live-state" data-state="'+esc(presence)+'">'+esc(presence)+'</span><small>LAST RUN '+esc(r.status||'none')+' / '+when(r.finished_at||r.started_at)+'</small><small>NEXT DUE '+(world.researcher.online?when(a?.next_due_at):'Local server offline')+'</small><button data-live-agent="'+esc(id)+'">VIEW DOSSIER ↗</button></article>';
    }).join(''):'<p class="live-empty">Unable to verify local agent status.</p>';
    const selected=$('dit-live-filter')?.value||'';
    const marketRefs=runs.flatMap(r=>(r.source_refs||[]).map(s=>({agent_id:r.agent_id,source_id:'GMGN via JARVIS',observed_at:s.observed_at,title:s.title,url:s.url,evidence:{summary:'Market context cited by the local researcher.'}})));
    const rows=[...observations.filter(o=>/dex|gecko|gmgn|solana/i.test(o.source_id||'')),...marketRefs].filter(o=>!selected||o.agent_id===selected).sort((a,b)=>Date.parse(b.observed_at||0)-Date.parse(a.observed_at||0)).slice(0,12);
    if(!liveMarket?.signals?.length)$('dit-live-evidence').innerHTML=rows.length?rows.map(o=>'<article class="live-row"><div><span class="byline">'+esc(o.agent_id)+' / '+esc(o.source_id)+'</span><time>'+when(o.observed_at)+'</time></div><div><h3>'+link(o.url,o.title)+'</h3><p>'+esc(o.evidence?.summary||'Source recorded, claims not independently established.')+'</p></div></article>').join(''):'<p class="live-empty">No recent market observations recorded. General news is hidden.</p>';
    // Activity comes from persisted activity_events, not from old model answer dumps.
    const realEvents=events.map(formatActivity).filter(Boolean).slice(0,20);
    const key=realEvents.map(e=>e.id+'|'+e.status+'|'+e.title).join(';');
    if(key!==activityStructureKey){
      activityStructureKey=key;
      const shell=document.querySelector('.dit-live');
      if(shell){
        let backdrop=shell.querySelector('.terminal-ghost-lines');
        if(!backdrop){backdrop=document.createElement('div');backdrop.className='terminal-ghost-lines';backdrop.setAttribute('aria-hidden','true');shell.insertBefore(backdrop,shell.firstChild);}
        backdrop.innerHTML=realEvents.slice(0,14).map((ev,i)=>'<span style="animation-delay:-'+(i*0.7).toFixed(1)+'s">_ '+esc(ev.agent_id)+
          ' :: '+esc(ev.title)+'</span>').join('');
      }
      const lines=realEvents.map((ev,i)=>'<button type="button" class="terminal-event" data-live-event="'+esc(ev.id)+'">'+
        portrait(ev.agent_id)+
        '<span class="terminal-event-copy"><small>_ '+esc(ev.agent_id)+' / '+esc(ev.status)+' / '+esc(when(ev.at))+'</small>'+
        '<strong class="'+(i<3?'terminal-type':'')+'">'+esc(ev.title)+'</strong>'+
        '<em>VIEW EVENT TRACE ↗</em></span></button>').join('');
      $('dit-live-transmissions').innerHTML=lines||'<p class="live-empty">_ WAITING FOR RECORDED AGENT EVENTS<span class="terminal-cursor">_</span></p>';
      // Reuse the real activity feed in the hero's decorative transmission rail.
      const rail=document.querySelector('.compact-activity');
      if(rail&&realEvents.length){
        rail.innerHTML=realEvents.slice(0,5).map(ev=>'<button type="button" class="terminal-rail-event" data-live-event="'+esc(ev.id)+'">'+
         portrait(ev.agent_id,'terminal-rail-avatar')+'<span><small>_ '+esc(ev.agent_id)+' / '+esc(ev.status)+'</small>'+
         '<b>'+esc(ev.title)+'</b></span></button>').join('');
      }
    }
    renderLiveMarket();
    const liveDrafts=localDrafts.filter(c=>c.status==='review').slice(0,12);
    const present=[...liveDrafts.map(c=>({...c,_private:true})),...concepts.map(c=>({...c,_private:false}))];
    const conceptKey=JSON.stringify(present.map(c=>[c.id,c.status,c.updated_at,c.content?.name,c.content?.hook,
      c.content?.image_url,c.source_refs?.map(x=>x.url), (liveMarket?.signals||[]).filter(s=>(c.source_refs||[]).some(r=>r.url===s.url)).map(s=>s.image_url)]));
    if(conceptKey!==conceptStructureKey){
      conceptStructureKey=conceptKey;
      $('dit-live-concepts').innerHTML=present.length?present.map(c=>{
      const x=c.content||{},label=c._private?'DRAFT // REQUIRES HUMAN REVIEW':'APPROVED CONCEPT';
      return '<article class="terminal-concept-card">'+artTile(c,'terminal-concept-image')+
        '<div class="terminal-concept-copy"><small>_ '+esc(c.agent_id)+' / '+label+'</small>'+
        '<h3>'+esc(x.name||'Untitled')+' <span>$'+esc(x.ticker||'?')+'</span></h3>'+
        '<p class="terminal-type">'+esc(compact(x.hook||x.narrative).slice(0,135))+'</p>'+
        '<small>'+esc(buzz(x.buzzwords))+'</small>'+
        (c._private?'<a class="terminal-action" href="/operator">OPEN PRIVATE REVIEW ↗</a>':
        '<button type="button" data-live-concept="'+esc(c.id)+'">OPEN CONCEPT BRIEF ↗</button>')+
        '</div></article>';
    }).join(''):'<p class="live-empty">_ NO REVIEWED CONCEPTS YET. MARKET SCANS CONTINUE INDEPENDENTLY<span class="terminal-cursor">_</span></p>';

    }
  }

  const money=x=>typeof x==='number'&&Number.isFinite(x)?('$'+(x>=1000?(x/1000).toFixed(1)+'k':Math.round(x).toLocaleString())):'—';
  const marketImage=s=>safeArtUrl(s.image_url)
    ?'<img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+esc(safeArtUrl(s.image_url))+'" alt="'+esc((s.name||s.symbol||'Token')+' artwork')+'">'
    :'<div class="market-art-empty" aria-label="No verified artwork">◈ '+esc((s.symbol||'?').slice(0,6))+'</div>';
  function renderLiveMarket(){
    const feed=$('dit-live-evidence');
    if(!feed||!liveMarket?.signals?.length)return;
    const signals=liveMarket.signals.slice(0,12);
    // Do not recreate image elements at 1Hz: GIFs must keep playing.
    const structure=JSON.stringify(signals.map(s=>[s.address,s.image_url,s.symbol,s.kind]));
    if(structure!==marketStructureKey){
      marketStructureKey=structure;
      const cards=signals.map(s=>'<article class="market-card" data-market-index="'+signals.indexOf(s)+'"><div class="market-card-image">'+marketImage(s)+'</div>'+
        '<div class="market-card-body"><div class="market-card-title"><b>'+esc(s.symbol||'???')+'</b><span>_ '+esc(s.kind||'PAIR')+'</span></div>'+
        '<p class="market-card-name terminal-type">'+esc(s.name||'Unnamed Solana token')+'</p>'+
        '<div class="market-card-stats"><span>5M VOL<strong data-stat="vol">'+money(s.volume_5m_usd)+'</strong></span><span>LIQUIDITY<strong data-stat="liq">'+money(s.liquidity_usd)+'</strong></span>'+
        '<span>BUYS / SELLS<strong data-stat="txns">'+esc(s.buys_5m??'—')+' / '+esc(s.sells_5m??'—')+'</strong></span></div>'+
        '<div class="market-card-foot"><small>'+esc(s.provider||'JARVIS')+' · <time class="market-age" data-time="'+esc(s.observed_at)+'"></time></small>'+
        '<a href="'+esc(valid(s.url)||'#')+'" target="_blank" rel="noopener noreferrer">VIEW SOURCE ↗</a></div>'+
        '<small class="market-card-disclaimer">Safety: '+esc(s.safety||'UNVERIFIED')+(s.paid_attention?' · PAID ATTENTION':'')+'</small></div></article>').join('');
      feed.innerHTML='<div class="market-feed-meta"><span>_ READ-ONLY JARVIS CACHE / DISPLAY 1S</span>'+
        '<span>OBSERVED <time id="market-last-observed"></time></span></div>'+
        '<div class="market-grid">'+cards+'</div>';
    }
    const age=x=>{const t=Date.parse(x||'');return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/1000))+'s ago':'unknown'};
    feed.querySelectorAll('.market-card').forEach(card=>{
      const token=signals[Number(card.dataset.marketIndex)];if(!token)return;
      const put=(sel,value)=>{const el=card.querySelector(sel);if(el&&el.textContent!==value)el.textContent=value};
      put('[data-stat="vol"]',money(token.volume_5m_usd));
      put('[data-stat="liq"]',money(token.liquidity_usd));
      put('[data-stat="txns"]',String(token.buys_5m??'—')+' / '+String(token.sells_5m??'—'));
      const tick=card.querySelector('.market-age');if(tick){tick.dataset.time=token.observed_at;tick.textContent=age(token.observed_at)}
    });
    const updated=feed.querySelector('#market-last-observed');
    if(updated)updated.textContent=age(liveMarket.last_checked_at)+(liveMarket.stale?' / STALE — LAST VALID SNAPSHOT':liveMarket.refreshing?' / REFRESHING':'');
  }
  async function refreshPrivateDrafts(){
    if(!['localhost','127.0.0.1'].includes(location.hostname)||document.hidden)return;
    try{
      const r=await fetch('/operator/api/concepts',{cache:'no-store',signal:AbortSignal.timeout(3000)});
      if(r.ok){const data=await r.json();localDrafts=Array.isArray(data.concepts)?data.concepts:[];render();}
    }catch{/* Hosted site has no private review endpoint. */}
  }
  async function refreshLiveMarket(){
    if(marketBusy||document.hidden)return;
    marketBusy=true;
    try{
      // Private local operator for fast source access; hosted clients read the
      // sanitized shared snapshot instead of attempting Windows localhost.
      const local=['localhost','127.0.0.1'].includes(location.hostname);
      let r=local?await fetch('/operator/api/market',{cache:'no-store',signal:AbortSignal.timeout(4000)}):null;
      if(!r||r.status===403||r.status===404)r=await fetch('/api/market',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(!r.ok){if(liveMarket)liveMarket.stale=true;renderLiveMarket();return;}
      const incoming=await r.json();
      if(Array.isArray(incoming.signals)&&incoming.signals.length){
        liveMarket=incoming;
      }else if(liveMarket?.signals?.length){
        // Preserve the last valid snapshot during outages or empty refreshes.
        liveMarket={...liveMarket,stale:true,source_states:incoming.source_states||liveMarket.source_states};
      }else liveMarket=incoming;
      renderLiveMarket();
    }catch{
      if(liveMarket)liveMarket.stale=true;
      renderLiveMarket();
    }finally{marketBusy=false}
  }
  async function refreshActivity(){
    if(document.hidden)return;
    try{
      const result=await api('/api/activity?limit=60');
      events=(result.events||[]).filter(x=>formatActivity(x));
      lastActivityTime=Date.now();
      render();
    }catch{/* Read-only activity service may be offline. */}
  }
  async function refresh(){
    if(busy||document.hidden)return;busy=true;
    try{
      const out=await Promise.allSettled([api('/api/observatory'),api('/api/observations?limit=60'),api('/api/results?limit=40'),api('/api/concepts')]);
      world=out[0].status==='fulfilled'?out[0].value:null;
      if(out[1].status==='fulfilled')observations=out[1].value.observations||[];
      if(out[2].status==='fulfilled')runs=out[2].value.runs||[];
      if(out[3].status==='fulfilled')concepts=out[3].value.concepts||[];
      render();
    }finally{busy=false}
  }
  refresh();refreshActivity();refreshLiveMarket();refreshPrivateDrafts();setInterval(refresh,30000);setInterval(refreshLiveMarket,1000);setInterval(refreshPrivateDrafts,15000);
  setInterval(refreshActivity,5000);setInterval(()=>{if(liveMarket)renderLiveMarket()},1000);
  if(typeof EventSource!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname)){const channel=new EventSource('/api/stream');channel.onmessage=()=>{refreshActivity();refreshPrivateDrafts()};}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();refreshLiveMarket()}});
})();
