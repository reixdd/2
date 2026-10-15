// Live display for the uploaded MIAMI SIGNAL HTML. Real backend records only.
(() => {
  const $ = id => document.getElementById(id);
  const hero=document.getElementById('stage'),controls=document.querySelector('.bottom-bar');
  if(hero&&controls)hero.insertAdjacentElement('afterend',controls); // keep original audio/FX directly below artwork
  const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const when = x => x && Number.isFinite(Date.parse(x)) ? new Date(x).toLocaleString() : 'No record';
  const valid = x => {try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
  const link=(x,label)=>valid(x)?'<a rel="noopener noreferrer" target="_blank" href="'+esc(valid(x))+'">'+esc(label||x)+' ↗</a>':esc(label||'Source unavailable');
  const api=async path=>{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
  const ids=['GHOST_001','NULL_ENTITY','ECHO.exe'];
  let world=null,observations=[],runs=[],concepts=[],busy=false;
  const dlg=$('dit-live-dialog');
  const open=(title,html)=>{$('dit-live-modal-title').textContent=title;$('dit-live-modal-body').innerHTML=html;if(!dlg.open)dlg.showModal()};
  $('dit-live-close').onclick=()=>dlg.close();
  const agent=id=>world?.agents?.find(x=>x.id===id);
  async function detail(id){
    open(id,'<p>Loading independent research memory…</p>');
    try{
      const d=await api('/api/agents/'+encodeURIComponent(id)),a=agent(id);
      $('dit-live-modal-body').innerHTML='<p>Presence: '+esc(a?.presence||'offline')+'</p><h3>RECENT RESEARCH</h3>'+
        ((d.research_runs||[]).slice(0,4).map(r=>'<p>'+esc(r.status)+' / '+esc(when(r.finished_at))+'<br>'+esc((r.answer||r.error||'No answer').slice(0,1000))+'</p>').join('')||'<p>No runs yet.</p>')+
        '<h3>INDEPENDENT MEMORY</h3>'+((d.memories||[]).slice(0,6).map(m=>'<p>'+esc(m.summary||m.content)+'</p>').join('')||'<p>No memory records yet.</p>');
    }catch{$('dit-live-modal-body').textContent='Agent research is temporarily unavailable.'}
  }
  async function showConcept(id){
    open('ATTENTION ANATOMY','<p>Loading approved concept…</p>');
    try{
      const c=(await api('/api/concepts/'+encodeURIComponent(id))).concept,x=c.content||{},a=x.attention_anatomy||{};
      $('dit-live-modal-body').innerHTML='<span class="live-signal">FICTIONAL CONCEPT // NO FINANCIAL ASSET</span><h2>'+esc(x.name)+' / '+esc(x.ticker)+'</h2><p>'+esc(x.narrative)+'</p>'+
        '<h3>ATTENTION ANATOMY</h3><dl>'+Object.entries({spread:'SPREAD',references:'CULTURAL REFERENCES',evidence:'WHAT THE EVIDENCE PROVES',synthetic_distortion:'ARTIFICIAL AMPLIFICATION',uncertainty:'UNKNOWN FACTORS'}).map(([k,v])=>'<dt>'+v+'</dt><dd>'+esc(a[k]||'Not established')+'</dd>').join('')+'</dl>'+
        '<h3>SOURCES</h3>'+((c.source_refs||[]).map(s=>'<p>'+link(s.url,s.title)+'</p>').join('')||'<p>No listed sources</p>')+
        '<h3>SOCIAL DRAFT (NOT POSTED)</h3><blockquote>'+esc(x.social_draft)+'</blockquote>';
    }catch{$('dit-live-modal-body').textContent='Concept not currently published.'}
  }
  document.addEventListener('click',e=>{let b=e.target.closest('[data-live-agent],[data-live-concept]');if(b?.dataset.liveAgent)detail(b.dataset.liveAgent);if(b?.dataset.liveConcept)showConcept(b.dataset.liveConcept)});
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
    $('dit-live-status').textContent=world?.researcher?.online?'LOCAL JARVIS CONNECTED // '+(world.researcher.active||[]).length+' ACTIVE':'LOCAL RESEARCH OFFLINE OR STALE';
    $('dit-live-metrics').textContent='CULTURAL COLLECTOR '+(world?.collector?.online?'ONLINE':'OFFLINE')+' / LAST HEARTBEAT '+when(world?.researcher?.last_seen_at);
    if($('health'))$('health').textContent=world?.researcher?.online?'ONLINE':'OFFLINE';
    $('dit-live-network').innerHTML=world?ids.map(id=>{
      const a=agent(id),r=a?.last_run||{},presence=a?.presence||'offline';
      return '<article class="live-agent"><span class="agent-name">'+esc(id)+'</span><span class="live-state" data-state="'+esc(presence)+'">'+esc(presence)+'</span><small>LAST RUN '+esc(r.status||'none')+' / '+when(r.finished_at||r.started_at)+'</small><small>NEXT DUE '+(world.researcher.online?when(a?.next_due_at):'Local server offline')+'</small><button data-live-agent="'+esc(id)+'">VIEW DOSSIER ↗</button></article>';
    }).join(''):'<p class="live-empty">Unable to verify local agent status.</p>';
    const selected=$('dit-live-filter')?.value||'';
    const rows=observations.filter(o=>!selected||o.agent_id===selected).slice(0,18);
    $('dit-live-evidence').innerHTML=rows.length?rows.map(o=>'<article class="live-row"><div><span class="byline">'+esc(o.agent_id)+' / '+esc(o.source_id)+'</span><time>'+when(o.observed_at)+'</time></div><div><h3>'+link(o.url,o.title)+'</h3><p>'+esc(o.evidence?.summary||'Source recorded, claims not independently established.')+'</p></div></article>').join(''):'<p class="live-empty">No source observations recorded for this selection.</p>';
    $('dit-live-transmissions').innerHTML=runs.length?runs.slice(0,10).map(r=>'<article class="live-row"><div><span class="byline">'+esc(r.agent_id)+' / '+esc(r.model||'unknown model')+'</span><time>'+when(r.finished_at||r.started_at)+'</time></div><div><h3>'+esc(r.status)+'</h3><p>'+esc((r.status==='completed'?r.answer:r.error)||'Research pending').slice(0,700)+'</p></div></article>').join(''):'<p class="live-empty">No research runs yet.</p>';
    $('dit-live-concepts').innerHTML=concepts.length?concepts.map(c=>'<article class="live-concept"><div class="live-ticker">'+esc(c.content?.ticker)+'</div><div><span class="byline">'+esc(c.agent_id)+'</span><h3>'+esc(c.content?.name)+'</h3><p>'+esc(c.content?.narrative)+'</p><button data-live-concept="'+esc(c.id)+'">VIEW ATTENTION ANATOMY ↗</button></div></article>').join(''):'<p class="live-empty">No human-reviewed fictional concepts are published yet.</p>';
  }
  $('dit-live-filter').onchange=render;
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
  refresh();setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
