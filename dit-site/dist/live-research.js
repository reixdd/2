// Live display for the uploaded MIAMI SIGNAL HTML. Real backend records only.
(async () => {
  const {agentPortrait,conceptArtwork,formatActivity,researchHook,safeArtUrl,compact}=await import('./terminal-ui.js?v=launch-final-3');
  const {mountControlRoom,updateControlRoom}=await import('./control-room.js?v=launch-final-3');
  const {MarketFeed}=await import('./market-feed.js?v=launch-final-3');
  const {featuredAgentIdeas}=await import('./concept-feature.js?v=launch-final-4');
  const {conceptStudyArtwork}=await import('./concept-art.js?v=launch-final-4');
  const {linkedCoinXEvidence}=await import('./coin-twitter.js?v=launch-final-5');
  const marketFeed=new MarketFeed(document.getElementById('dit-live-evidence'));
  document.getElementById('dit-live-filter').addEventListener('change',()=>renderLiveMarket());
  const $ = id => document.getElementById(id);
  const hero=document.getElementById('stage'),controls=document.querySelector('.bottom-bar');
  if(hero&&controls)hero.insertAdjacentElement('afterend',controls); // keep original audio/FX directly below artwork
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const when = x => x && Number.isFinite(Date.parse(x)) ? new Date(x).toLocaleString() : 'No record';
  const valid = x => {try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
  const link=(x,label)=>valid(x)?'<a rel="noopener noreferrer" target="_blank" href="'+esc(valid(x))+'">'+esc(label||x)+' ↗</a>':esc(label||'Source unavailable');
  const api=async path=>{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
  function activateTab(which){
    const selected=which==='activity'?'activity':'radar';
    const radar=$('dit-live-concept-section'),activity=$('dit-live-transmission-section');
    if(radar)radar.hidden=selected!=='radar';
    if(activity)activity.hidden=selected!=='activity';
    document.querySelectorAll('[data-dit-tab]').forEach(btn=>btn.setAttribute('aria-selected',String(btn.dataset.ditTab===selected)));
    const state=$('dit-tab-state');if(state)state.textContent=selected==='radar'?'_ ORIGINAL CONCEPTS / HUMAN REVIEW':'_ VERIFIED OBSERVATIONS / DECISION FLOW';
  }
  mountControlRoom({openAgent:id=>detail(id),activateTab});
  // HD portraits and the composited city run without WebGL by default.
  // WebGL is optional and loads exactly once when the human enables GFX.
  window.addEventListener('dit:gfx',async e=>{
    if(e.detail?.enabled){
      try{await import('./stage.js?v=launch-final-3')}catch(err){console.warn('[DIT] optional GPU effect unavailable:',err);}
    }
  });
  activateTab(location.hash==='#dit-live-transmission-section'?'activity':'radar');
  const ids=['GHOST_001','NULL_ENTITY','ECHO.exe'];
  let conceptBefore=null,conceptArchive=[],conceptPaging=false,archiveOpen=false,archiveShow=9;
  let world=null,observations=[],runs=[],concepts=[],events=[],busy=false,liveMarket=null,marketBusy=false,localDrafts=[],treasury=null;
  let activityStructureKey='',conceptStructureKey='',lastActivityTime=0;
  for(const [id,title] of [['dit-live-evidence-section','MARKET OBSERVATIONS'],['dit-live-transmission-section','AGENT ACTIVITY'],['dit-live-concept-section','MEME RADAR // AGENT IDEAS']]){
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
  const artTile=(c,cls)=>{
    // A verified concept image belongs to this idea; source token icons do not.
    const saved=conceptArtwork(c,[]),actual=saved.kind==='concept'&&saved.url;
    const url=actual?saved.url:conceptStudyArtwork(c);
    const label=actual?'ORIGINAL CONCEPT ART':'AGENT CONCEPT STUDY / VECTOR PREVIEW';
    return '<div class="'+cls+'"><img src="'+esc(url)+'" alt="'+esc((c.content?.name||'Agent idea')+' illustrated concept')+'" loading="lazy" decoding="async"'+
      (actual?' referrerpolicy="no-referrer"':'')+'><span class="terminal-art-fallback" hidden>_ CONCEPT ART UNAVAILABLE</span>'+
      '<small>'+esc(label)+'</small></div>';
  };
  document.addEventListener('error',event=>{
    const img=event.target;
    if(!(img instanceof HTMLImageElement))return;
    if(img.closest('.market-card-image'))return;
    if(!img.closest('.terminal-concept-image,.terminal-concept-art'))return;
    img.hidden=true;
    const placeholder=img.parentElement?.querySelector('.terminal-art-fallback');
    if(placeholder)placeholder.hidden=false;
  },true);

  const teaser=x=>String(x||'').split('CONCEPT_JSON')[0].split('```')[0].replace(/\s+/g,' ').trim().slice(0,180);
  const dlg=$('dit-live-dialog');
  const open=(title,html)=>{$('dit-live-modal-title').textContent=title;$('dit-live-modal-body').innerHTML=html;if(!dlg.open)dlg.showModal()};
  $('dit-live-close').onclick=()=>dlg.close();
  const agent=id=>world?.agents?.find(x=>x.id===id);

  // Authenticated social votes. No simulated vote count or anonymous production identity.
  let voteToken='';
  try{
    voteToken=sessionStorage.getItem('dit:vote-session')||'';
    const hash=new URLSearchParams(location.hash.startsWith('#')?location.hash.slice(1):'');
    if(hash.get('access_token')&&hash.get('token_type')?.toLowerCase()==='bearer'){
      voteToken=hash.get('access_token');
      sessionStorage.setItem('dit:vote-session',voteToken);
      history.replaceState(null,'',location.pathname+location.search);
    }
  }catch{/* Session storage can be disabled; sign-in will still show a clear error. */}
  async function identifyForVote(){
    let config;
    try{config=await api('/api/config')}catch{config=null}
    const mode=config?.auth||'none';
    if(mode!=='dev'&&mode!=='supabase'){
      return open('VOTING NOT CONFIGURED','<p>Verified identity is not available in this runtime. Nothing has been submitted.</p>');
    }
    open('HUMAN OBSERVER / VOTING IDENTITY',
      '<p>One current favorite per account. Votes are social, not financial.</p>'+
      '<form id="dit-vote-identity"><label for="identity-email">EMAIL / VERIFIED IDENTITY</label>'+
      '<input type="email" id="identity-email" name="email" required autocomplete="email" placeholder="you@example.com">'+
      '<button type="submit">'+(mode==='dev'?'USE LOCAL TEST IDENTITY':'SEND EMAIL SIGN-IN LINK')+' ↗</button></form>'+
      '<p id="identity-status" role="status">'+(mode==='dev'?'LOCAL TEST MODE: votes are not verified for public use.':'Email confirmation is required to cast a public vote.')+'</p>');
    $('dit-vote-identity')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const email=String($('identity-email')?.value||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        $('identity-status').textContent='Enter a valid email address.';return;
      }
      if(mode==='dev'){
        voteToken='dev:'+email;
        try{sessionStorage.setItem('dit:vote-session',voteToken)}catch{}
        $('identity-status').textContent='LOCAL TEST IDENTITY READY. CLOSE THIS PANEL AND VOTE AGAIN.';
        return;
      }
      const url=config?.supabase?.url,key=config?.supabase?.anonKey;
      if(!url||!key){$('identity-status').textContent='Authentication service unavailable.';return;}
      try{
        const redirect=location.origin+location.pathname;
        const result=await fetch(url.replace(/\/+$/,'')+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{
          method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({email,create_user:true}),
          signal:AbortSignal.timeout(10000)
        });
        if(!result.ok)throw Error('Sign-in link request was not accepted');
        $('identity-status').textContent='Check your email for the sign-in link. No vote has been recorded yet.';
      }catch(err){$('identity-status').textContent='Unable to request sign-in: '+String(err.message||'Unavailable');}
    },{once:true});
  }
  window.addEventListener('dit:vote-identity',identifyForVote);
  async function voteFor(id){
    if(!ids.includes(id))return;
    if(!voteToken){window.dispatchEvent(new Event('dit:vote-identity'));return;}
    try{
      const res=await fetch('/api/vote',{
        method:'POST',
        headers:{authorization:'Bearer '+voteToken,'content-type':'application/json'},
        body:JSON.stringify({agent_id:id}),signal:AbortSignal.timeout(12000)
      });
      const d=await res.json();
      if(!res.ok){
        if(res.status===401||res.status===403){voteToken='';try{sessionStorage.removeItem('dit:vote-session')}catch{}}
        throw Error(d.error||'Server did not record the vote');
      }
      open('VOTE RECORDED / '+id,
        '<p>Server-confirmed favorite: '+esc(id)+'. You can switch later.</p>'+
        '<p>Recorded social votes: '+esc(String(d.votes?.total??'UNAVAILABLE'))+'</p>');
    }catch(err){open('VOTE NOT RECORDED','<p>'+esc(String(err.message||'Vote unavailable'))+'</p>');}
  }

  // Treasury values are shown only when the existing ledger API returns valid data.
  const lamportsSol=n=>Number.isFinite(Number(n))&&Number(n)>=0?(Number(n)/1e9).toLocaleString(undefined,{maximumFractionDigits:6})+' SOL':'—';
  async function refreshTreasury(){
    try{const v=await api('/api/treasury');treasury=v?.totals&&Number.isFinite(Number(v.target_percent))?v:null;}
    catch{treasury=null;}
    updateControlRoom(world,liveMarket,events,treasury);
  }
  window.addEventListener('dit:open-treasury',()=>{
    if(!treasury)return open('TREASURY / NO VERIFIED LEDGER',
     '<p>The existing ledger is unavailable. No creator-fee balance or transfer is being assumed.</p><a class="terminal-action" href="/operator">OPEN OPERATOR ↗</a>');
    const t=treasury.totals||{};
    open('TREASURY / VERIFIED LEDGER',
      '<p>Creator-fee allocation target: '+esc(treasury.target_percent)+'% (configuration, not guaranteed transfer)</p>'+
      '<p>Confirmed on chain: '+esc(lamportsSol(t.confirmed_lamports))+'</p>'+
      '<p>Pending allocation: '+esc(lamportsSol(t.pending_treasury_lamports))+'</p>'+
      '<p>Observed but unverified: '+esc(lamportsSol(t.observed_lamports))+'</p>'+
      '<p>'+esc(treasury.transfer?.limitation||'Any transfer requires an independently validated record.')+'</p>'+
      '<a class="terminal-action" href="/operator">OPEN OPERATOR ↗</a>');
  });
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
        '<h3>RESEARCH FINDINGS</h3>'+(
        history.map(r=>'<p class="terminal-detail-line">_ '+esc(researchHook(r.answer)||'Research completed; no validated concise hook')+
          '<small>'+esc(when(r.finished_at))+'</small></p>').join('')||'<p>_ No completed meme hooks</p>')+
        '<h3>COIN-LINKED X / TWITTER</h3>'+(linkedCoinXEvidence(d.observations||[],liveMarket?.signals||[]).map(o=>'<p>'+link(o.url,(o.symbol?'
        '<details><summary>Errors and full research logs</summary>'+((d.research_runs||[]).slice(0,8).map(r=>'<h4>'+esc(r.status)+' / '+esc(when(r.finished_at||r.started_at))+'</h4><p>'+esc(r.error||r.answer||'No output recorded')+'</p>').join('')||'<p>No runs recorded.</p>')+'</details>'+
        '<a class="terminal-action" href="/operator">OPEN PRIVATE OPERATOR / FULL TRACE ↗</a>';
    }catch{$('dit-live-modal-body').textContent='Agent data is currently unavailable.'}
  }
  async function showConcept(id){
    open('ATTENTION ANATOMY','<p>Loading agent concept…</p>');
    try{
      const c=(await api('/api/concepts/'+encodeURIComponent(id))).concept,x=c.content||{},a=x.attention_anatomy||{};
      $('dit-live-modal-body').innerHTML='<div class="terminal-modal-head">'+artTile(c,'terminal-concept-art')+
        '<div><span class="terminal-prompt">_ AGENT IDEA // '+esc(x.ticker)+'</span><h2>'+esc(x.name)+'</h2><p>'+esc(x.hook||x.narrative)+'</p></div></div>'+
        '<h3>_ CONCEPT // SHORT BRIEF</h3><p>'+esc(compact(x.narrative).slice(0,250))+'</p>'+
        '<h3>_ COIN-LINKED X / TWITTER</h3>'+(linkedCoinXEvidence(c.source_refs||[],liveMarket?.signals||[]).map(s=>'<p>'+link(s.url,'COIN SOURCE ON X')+'</p>').join('')||'<p>_ No matching coin-linked X reference supplied by source metadata.</p>')+
        '<h3>_ STATUS</h3><p>Agent-generated fictional concept. Review status is shown separately; no asset has been launched.</p>'+
        (x.social_draft?'<h3>_ DRAFT TEXT // NOT POSTED</h3><blockquote>'+esc(x.social_draft)+'</blockquote>':'');
    }catch{$('dit-live-modal-body').textContent='Concept not currently published.'}
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-live-agent],[data-live-concept],[data-live-event]');if(b?.dataset.liveAgent)detail(b.dataset.liveAgent);if(b?.dataset.liveConcept)showConcept(b.dataset.liveConcept);
    if(b?.dataset.liveEvent){const event=events.find(x=>String(x.id)===b.dataset.liveEvent);if(event){
      const ev=formatActivity(event);open('_ '+ev.agent_id+' / '+ev.status,
        '<div class="terminal-modal-head">'+portrait(ev.agent_id)+'<div><h2>'+esc(ev.title)+'</h2><p>'+esc(when(ev.at))+'</p></div></div>'+
        '<h3>_ RECORDED EVENT</h3><p>'+esc(event.detail||'No additional detail recorded')+'</p>'+link(event.payload?.url||event.source_url,'Evidence trace')+'<p>Event '+esc(event.id)+'</p><button data-live-agent="'+esc(ev.agent_id)+'">AGENT TIMELINE ↗</button>');}}});
  document.addEventListener('click',e=>{
    const b=e.target.closest('.stage [data-view],.stage [data-vote],.panel [data-modal-vote]');if(!b)return;
    const view=b.dataset.view;
    if(!b.dataset.vote&&!b.dataset.modalVote&&!['ghost','null','echo','network','transmissions','treasury'].includes(view))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(b.dataset.vote||b.dataset.modalVote)return voteFor(b.dataset.vote||b.dataset.modalVote);
    if(view==='ghost')return detail(ids[0]);if(view==='null')return detail(ids[1]);if(view==='echo')return detail(ids[2]);
    if(view==='network')return $('dit-live-network')?.scrollIntoView({behavior:'smooth'});
    if(view==='transmissions')return $('dit-live-transmissions')?.scrollIntoView({behavior:'smooth'});
    if(view==='treasury')return open('RESEARCH ACCOUNTING','<p>No simulated fees or unverified financial balances are presented as real.</p>');
  },true);
  function render(){
    const completedRecently=runs.some(r=>r.status==='completed'&&r.finished_at&&Date.now()-Date.parse(r.finished_at)<20*60_000);
    $('dit-live-status').textContent=world?.researcher?.online?(completedRecently?'RECENT RESEARCH RECORDED':'RESEARCH WORKER CONNECTED / INFERENCE UNVERIFIED'):'RESEARCH WORKER OFFLINE / LAST OBSERVATION RETAINED';
    $('dit-live-metrics').textContent='CULTURAL COLLECTOR '+(world?.collector?.online?'ONLINE':'OFFLINE')+' / LAST HEARTBEAT '+when(world?.researcher?.last_seen_at);
    if($('health'))$('health').textContent=world?.researcher?.online?'WORKER HEARTBEAT RECEIVED':'OFFLINE';
    $('dit-live-network').innerHTML=world?ids.map(id=>{
      const a=agent(id),r=a?.last_run||{},presence=a?.presence||'offline';
      return '<article class="live-agent"><span class="agent-name">'+esc(id)+'</span><span class="live-state" data-state="'+esc(presence)+'">'+esc(presence)+'</span><small>LAST RUN '+esc(r.status||'none')+' / '+when(r.finished_at||r.started_at)+'</small><small>NEXT DUE '+(world.researcher.online?when(a?.next_due_at):'Local server offline')+'</small><button data-live-agent="'+esc(id)+'">VIEW DOSSIER ↗</button></article>';
    }).join(''):'<p class="live-empty">Unable to verify local agent status.</p>';
    // Cultural research is NOT a token pair. New Pairs accepts only verified market-adapter rows.
    // Activity comes from persisted activity_events, not from old model answer dumps.
    const realEvents=events.map(formatActivity).filter(Boolean).slice(0,20);
    const key=realEvents.map(e=>e.id+'|'+e.status+'|'+e.title).join(';');
    if(key!==activityStructureKey){
      const previous=activityStructureKey;
      const panel=document.querySelector('.dit-knowledge-flow');
      if(panel&&previous&&realEvents.length){
        panel.dataset.transmitting='true';
        clearTimeout(panel._ditPulseTimeout);
        panel._ditPulseTimeout=setTimeout(()=>{panel.dataset.transmitting='false'},1500);
      }
      activityStructureKey=key;
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
    // Animate only verified presence/status provided by the research worker, never simulated work.
    window.dispatchEvent(new CustomEvent('dit:agents',{detail:{
      unavailable:!world,workerAlive:!!world?.researcher?.online,
      agents:(world?.agents||[]).map(a=>({id:a.id,state:['OBSERVING','THINKING','CREATING'].includes(String(a.presence).toUpperCase())?String(a.presence).toUpperCase():'IDLE'}))
    }}));
    updateControlRoom(world,liveMarket,events,treasury);


    // Primary Radar: newest actual research idea per agent. History is opt-in.
    const liveDrafts=localDrafts.filter(c=>c.status==='review').slice(0,8);
    const allIdeas=[...concepts.map(c=>({...c,_private:false})),
      ...liveDrafts.filter(c=>!concepts.some(p=>p.id===c.id)).map(c=>({...c,_private:true}))];
    const present=archiveOpen?allIdeas.slice(0,archiveShow):featuredAgentIdeas(allIdeas);
    older.hidden=!archiveOpen?allIdeas.length<=3&&!conceptBefore:!conceptBefore&&allIdeas.length<=archiveShow;
    older.textContent=archiveOpen?'LOAD MORE AGENT IDEAS':'BROWSE IDEA ARCHIVE';
    const conceptKey=JSON.stringify([archiveOpen,archiveShow,...present.map(c=>[c.id,c.status,c.updated_at,
      c.content?.name,c.content?.hook,c.content?.image_url,c.agent_id])]);
    if(conceptKey!==conceptStructureKey){
      conceptStructureKey=conceptKey;
      $('dit-live-concepts').innerHTML=present.length?present.map(c=>{
      const x=c.content||{},label=c._private?'DRAFT // REQUIRES HUMAN REVIEW':(c.status==='published'?'REVIEWED IDEA':'UNREVIEWED AGENT IDEA');
      return '<article class="terminal-concept-card">'+artTile(c,'terminal-concept-image')+
        '<div class="dit-creator-credit">'+portrait(c.agent_id,'dit-creator-avatar')+'<span>'+esc(c.agent_id)+'</span></div>'+
        '<div class="terminal-concept-copy"><small>_ '+label+'</small>'+
        '<h3>'+esc(x.name||'Untitled')+' <span>$'+esc(x.ticker||'?')+'</span></h3>'+
        '<p class="terminal-type">'+esc(compact(x.hook||x.narrative).slice(0,135))+'</p>'+
        '<small>'+esc(buzz(x.buzzwords))+'</small>'+
        (c._private?'<a class="terminal-action" href="/operator">OPEN PRIVATE REVIEW ↗</a>':
        '<button type="button" data-live-concept="'+esc(c.id)+'">OPEN CONCEPT BRIEF ↗</button>')+
        '</div></article>';
    }).join(''):'<p class="live-empty">_ AWAITING THE NEXT SOURCED AGENT IDEA. MARKET SCANS CONTINUE<span class="terminal-cursor">_</span></p>';

    }
  }

  const older=document.createElement('button');older.type='button';older.textContent='LOAD OLDER AGENT IDEAS';$('dit-live-concepts').after(older);older.hidden=true;
  older.addEventListener('click',async()=>{
    if(conceptPaging)return;
    if(!archiveOpen){archiveOpen=true;archiveShow=9;render();return;}
    if(archiveShow<concepts.length+localDrafts.length){archiveShow+=9;render();return;}
    if(!conceptBefore)return;
    conceptPaging=true;older.disabled=true;
    try{const page=await api('/api/concepts?limit=24&before='+encodeURIComponent(conceptBefore));
      conceptArchive=[...conceptArchive,...(page.concepts||[])];conceptBefore=page.next_before;
      concepts=[...concepts,...conceptArchive.filter(c=>!concepts.some(n=>n.id===c.id))];
      archiveShow+=9;render();
    }catch{older.textContent='RETRY IDEA ARCHIVE';}finally{conceptPaging=false;older.disabled=false;}
  });
  const money=x=>typeof x==='number'&&Number.isFinite(x)?('$'+(x>=1000?(x/1000).toFixed(1)+'k':Math.round(x).toLocaleString())):'—';
  function renderLiveMarket(){marketFeed.render(liveMarket,$('dit-live-filter')?.value||'all');}
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
    // Market updates must not reconstruct independent agent-concept artwork.
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
      updateControlRoom(world,liveMarket,events,treasury);
      // Ideas only re-render when their own persisted content changes.
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
      const out=await Promise.allSettled([api('/api/observatory'),api('/api/observations?limit=60'),api('/api/results?limit=40'),api('/api/concepts?limit=24')]);
      world=out[0].status==='fulfilled'?out[0].value:null;
      if(out[1].status==='fulfilled')observations=out[1].value.observations||[];
      if(out[2].status==='fulfilled')runs=out[2].value.runs||[];
      if(out[3].status==='fulfilled'){const latest=out[3].value.concepts||[];if(!conceptArchive.length)conceptBefore=out[3].value.next_before;concepts=[...latest,...conceptArchive.filter(c=>!latest.some(n=>n.id===c.id))];}
      render();
    }finally{busy=false}
  }
  refresh();refreshActivity();refreshLiveMarket();refreshPrivateDrafts();refreshTreasury();setInterval(refresh,10000);setInterval(refreshLiveMarket,['localhost','127.0.0.1'].includes(location.hostname)?1000:10000);setInterval(refreshPrivateDrafts,15000);setInterval(refreshTreasury,60000);
  setInterval(refreshActivity,5000);setInterval(()=>{if(liveMarket&&!document.hidden)renderLiveMarket()},1000);
  if(typeof EventSource!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname)){const channel=new EventSource('/api/stream');channel.onmessage=()=>{refreshActivity();refreshPrivateDrafts()};}
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('dit-page-hidden',document.hidden);if(!document.hidden){refresh();refreshLiveMarket()}});
})();
+o.symbol+' / ':'')+'COIN SOURCE ON X')+'<small> / '+esc(o.origin)+' / '+esc(o.address.slice(0,6))+'…</small></p>').join('')||'<p>_ NO CONTRACT-LINKED X ACCOUNT PROVIDED BY COIN SOURCES.</p>')+
        '<details><summary>Errors and full research logs</summary>'+((d.research_runs||[]).slice(0,8).map(r=>'<h4>'+esc(r.status)+' / '+esc(when(r.finished_at||r.started_at))+'</h4><p>'+esc(r.error||r.answer||'No output recorded')+'</p>').join('')||'<p>No runs recorded.</p>')+'</details>'+
        '<a class="terminal-action" href="/operator">OPEN PRIVATE OPERATOR / FULL TRACE ↗</a>';
    }catch{$('dit-live-modal-body').textContent='Agent data is currently unavailable.'}
  }
  async function showConcept(id){
    open('ATTENTION ANATOMY','<p>Loading agent concept…</p>');
    try{
      const c=(await api('/api/concepts/'+encodeURIComponent(id))).concept,x=c.content||{},a=x.attention_anatomy||{};
      $('dit-live-modal-body').innerHTML='<div class="terminal-modal-head">'+artTile(c,'terminal-concept-art')+
        '<div><span class="terminal-prompt">_ AGENT IDEA // '+esc(x.ticker)+'</span><h2>'+esc(x.name)+'</h2><p>'+esc(x.hook||x.narrative)+'</p></div></div>'+
        '<h3>_ CONCEPT // SHORT BRIEF</h3><p>'+esc(compact(x.narrative).slice(0,250))+'</p>'+
        '<h3>_ EVIDENCE</h3>'+((c.source_refs||[]).slice(0,6).map(s=>'<p>'+link(s.url,s.title)+'</p>').join('')||'<p>_ No verified source attached</p>')+
        '<h3>_ STATUS</h3><p>Agent-generated fictional concept. Review status is shown separately; no asset has been launched.</p>'+
        (x.social_draft?'<h3>_ DRAFT TEXT // NOT POSTED</h3><blockquote>'+esc(x.social_draft)+'</blockquote>':'');
    }catch{$('dit-live-modal-body').textContent='Concept not currently published.'}
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-live-agent],[data-live-concept],[data-live-event]');if(b?.dataset.liveAgent)detail(b.dataset.liveAgent);if(b?.dataset.liveConcept)showConcept(b.dataset.liveConcept);
    if(b?.dataset.liveEvent){const event=events.find(x=>String(x.id)===b.dataset.liveEvent);if(event){
      const ev=formatActivity(event);open('_ '+ev.agent_id+' / '+ev.status,
        '<div class="terminal-modal-head">'+portrait(ev.agent_id)+'<div><h2>'+esc(ev.title)+'</h2><p>'+esc(when(ev.at))+'</p></div></div>'+
        '<h3>_ RECORDED EVENT</h3><p>'+esc(event.detail||'No additional detail recorded')+'</p>'+link(event.payload?.url||event.source_url,'Evidence trace')+'<p>Event '+esc(event.id)+'</p><button data-live-agent="'+esc(ev.agent_id)+'">AGENT TIMELINE ↗</button>');}}});
  document.addEventListener('click',e=>{
    const b=e.target.closest('.stage [data-view],.stage [data-vote],.panel [data-modal-vote]');if(!b)return;
    const view=b.dataset.view;
    if(!b.dataset.vote&&!b.dataset.modalVote&&!['ghost','null','echo','network','transmissions','treasury'].includes(view))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(b.dataset.vote||b.dataset.modalVote)return voteFor(b.dataset.vote||b.dataset.modalVote);
    if(view==='ghost')return detail(ids[0]);if(view==='null')return detail(ids[1]);if(view==='echo')return detail(ids[2]);
    if(view==='network')return $('dit-live-network')?.scrollIntoView({behavior:'smooth'});
    if(view==='transmissions')return $('dit-live-transmissions')?.scrollIntoView({behavior:'smooth'});
    if(view==='treasury')return open('RESEARCH ACCOUNTING','<p>No simulated fees or unverified financial balances are presented as real.</p>');
  },true);
  function render(){
    const completedRecently=runs.some(r=>r.status==='completed'&&r.finished_at&&Date.now()-Date.parse(r.finished_at)<20*60_000);
    $('dit-live-status').textContent=world?.researcher?.online?(completedRecently?'RECENT RESEARCH RECORDED':'RESEARCH WORKER CONNECTED / INFERENCE UNVERIFIED'):'RESEARCH WORKER OFFLINE / LAST OBSERVATION RETAINED';
    $('dit-live-metrics').textContent='CULTURAL COLLECTOR '+(world?.collector?.online?'ONLINE':'OFFLINE')+' / LAST HEARTBEAT '+when(world?.researcher?.last_seen_at);
    if($('health'))$('health').textContent=world?.researcher?.online?'WORKER HEARTBEAT RECEIVED':'OFFLINE';
    $('dit-live-network').innerHTML=world?ids.map(id=>{
      const a=agent(id),r=a?.last_run||{},presence=a?.presence||'offline';
      return '<article class="live-agent"><span class="agent-name">'+esc(id)+'</span><span class="live-state" data-state="'+esc(presence)+'">'+esc(presence)+'</span><small>LAST RUN '+esc(r.status||'none')+' / '+when(r.finished_at||r.started_at)+'</small><small>NEXT DUE '+(world.researcher.online?when(a?.next_due_at):'Local server offline')+'</small><button data-live-agent="'+esc(id)+'">VIEW DOSSIER ↗</button></article>';
    }).join(''):'<p class="live-empty">Unable to verify local agent status.</p>';
    // Cultural research is NOT a token pair. New Pairs accepts only verified market-adapter rows.
    // Activity comes from persisted activity_events, not from old model answer dumps.
    const realEvents=events.map(formatActivity).filter(Boolean).slice(0,20);
    const key=realEvents.map(e=>e.id+'|'+e.status+'|'+e.title).join(';');
    if(key!==activityStructureKey){
      const previous=activityStructureKey;
      const panel=document.querySelector('.dit-knowledge-flow');
      if(panel&&previous&&realEvents.length){
        panel.dataset.transmitting='true';
        clearTimeout(panel._ditPulseTimeout);
        panel._ditPulseTimeout=setTimeout(()=>{panel.dataset.transmitting='false'},1500);
      }
      activityStructureKey=key;
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
    // Animate only verified presence/status provided by the research worker, never simulated work.
    window.dispatchEvent(new CustomEvent('dit:agents',{detail:{
      unavailable:!world,workerAlive:!!world?.researcher?.online,
      agents:(world?.agents||[]).map(a=>({id:a.id,state:['OBSERVING','THINKING','CREATING'].includes(String(a.presence).toUpperCase())?String(a.presence).toUpperCase():'IDLE'}))
    }}));
    updateControlRoom(world,liveMarket,events,treasury);


    // Primary Radar: newest actual research idea per agent. History is opt-in.
    const liveDrafts=localDrafts.filter(c=>c.status==='review').slice(0,8);
    const allIdeas=[...concepts.map(c=>({...c,_private:false})),
      ...liveDrafts.filter(c=>!concepts.some(p=>p.id===c.id)).map(c=>({...c,_private:true}))];
    const present=archiveOpen?allIdeas.slice(0,archiveShow):featuredAgentIdeas(allIdeas);
    older.hidden=!archiveOpen?allIdeas.length<=3&&!conceptBefore:!conceptBefore&&allIdeas.length<=archiveShow;
    older.textContent=archiveOpen?'LOAD MORE AGENT IDEAS':'BROWSE IDEA ARCHIVE';
    const conceptKey=JSON.stringify([archiveOpen,archiveShow,...present.map(c=>[c.id,c.status,c.updated_at,
      c.content?.name,c.content?.hook,c.content?.image_url,c.agent_id])]);
    if(conceptKey!==conceptStructureKey){
      conceptStructureKey=conceptKey;
      $('dit-live-concepts').innerHTML=present.length?present.map(c=>{
      const x=c.content||{},label=c._private?'DRAFT // REQUIRES HUMAN REVIEW':(c.status==='published'?'REVIEWED IDEA':'UNREVIEWED AGENT IDEA');
      return '<article class="terminal-concept-card">'+artTile(c,'terminal-concept-image')+
        '<div class="dit-creator-credit">'+portrait(c.agent_id,'dit-creator-avatar')+'<span>'+esc(c.agent_id)+'</span></div>'+
        '<div class="terminal-concept-copy"><small>_ '+label+'</small>'+
        '<h3>'+esc(x.name||'Untitled')+' <span>$'+esc(x.ticker||'?')+'</span></h3>'+
        '<p class="terminal-type">'+esc(compact(x.hook||x.narrative).slice(0,135))+'</p>'+
        '<small>'+esc(buzz(x.buzzwords))+'</small>'+
        (c._private?'<a class="terminal-action" href="/operator">OPEN PRIVATE REVIEW ↗</a>':
        '<button type="button" data-live-concept="'+esc(c.id)+'">OPEN CONCEPT BRIEF ↗</button>')+
        '</div></article>';
    }).join(''):'<p class="live-empty">_ AWAITING THE NEXT SOURCED AGENT IDEA. MARKET SCANS CONTINUE<span class="terminal-cursor">_</span></p>';

    }
  }

  const older=document.createElement('button');older.type='button';older.textContent='LOAD OLDER AGENT IDEAS';$('dit-live-concepts').after(older);older.hidden=true;
  older.addEventListener('click',async()=>{
    if(conceptPaging)return;
    if(!archiveOpen){archiveOpen=true;archiveShow=9;render();return;}
    if(archiveShow<concepts.length+localDrafts.length){archiveShow+=9;render();return;}
    if(!conceptBefore)return;
    conceptPaging=true;older.disabled=true;
    try{const page=await api('/api/concepts?limit=24&before='+encodeURIComponent(conceptBefore));
      conceptArchive=[...conceptArchive,...(page.concepts||[])];conceptBefore=page.next_before;
      concepts=[...concepts,...conceptArchive.filter(c=>!concepts.some(n=>n.id===c.id))];
      archiveShow+=9;render();
    }catch{older.textContent='RETRY IDEA ARCHIVE';}finally{conceptPaging=false;older.disabled=false;}
  });
  const money=x=>typeof x==='number'&&Number.isFinite(x)?('$'+(x>=1000?(x/1000).toFixed(1)+'k':Math.round(x).toLocaleString())):'—';
  function renderLiveMarket(){marketFeed.render(liveMarket,$('dit-live-filter')?.value||'all');}
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
    // Market updates must not reconstruct independent agent-concept artwork.
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
      updateControlRoom(world,liveMarket,events,treasury);
      // Ideas only re-render when their own persisted content changes.
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
      const out=await Promise.allSettled([api('/api/observatory'),api('/api/observations?limit=60'),api('/api/results?limit=40'),api('/api/concepts?limit=24')]);
      world=out[0].status==='fulfilled'?out[0].value:null;
      if(out[1].status==='fulfilled')observations=out[1].value.observations||[];
      if(out[2].status==='fulfilled')runs=out[2].value.runs||[];
      if(out[3].status==='fulfilled'){const latest=out[3].value.concepts||[];if(!conceptArchive.length)conceptBefore=out[3].value.next_before;concepts=[...latest,...conceptArchive.filter(c=>!latest.some(n=>n.id===c.id))];}
      render();
    }finally{busy=false}
  }
  refresh();refreshActivity();refreshLiveMarket();refreshPrivateDrafts();refreshTreasury();setInterval(refresh,10000);setInterval(refreshLiveMarket,['localhost','127.0.0.1'].includes(location.hostname)?1000:10000);setInterval(refreshPrivateDrafts,15000);setInterval(refreshTreasury,60000);
  setInterval(refreshActivity,5000);setInterval(()=>{if(liveMarket&&!document.hidden)renderLiveMarket()},1000);
  if(typeof EventSource!=='undefined'&&['localhost','127.0.0.1'].includes(location.hostname)){const channel=new EventSource('/api/stream');channel.onmessage=()=>{refreshActivity();refreshPrivateDrafts()};}
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('dit-page-hidden',document.hidden);if(!document.hidden){refresh();refreshLiveMarket()}});
})();
