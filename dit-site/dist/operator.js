const IDS=['GHOST_001','NULL_ENTITY','ECHO.exe'];const ROLES=['THE ARCHIVIST','THE SIGNAL HUNTER','THE VIRAL MACHINE'];
const $=id=>document.getElementById(id);let discovered=[],active='GHOST_001',running=null,settings=null;
const e=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,body){const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j}
function paint(){const s=settings;$('provider').value=s.provider;$('service-url').value=s.url;const choices=discovered.map(v=>`<option value="${e(v)}">${e(v)}</option>`).join('');$('agent-settings').innerHTML=IDS.map((id,i)=>`<div class="agent-setting ${id===active?'selected':''}" data-id="${e(id)}"><b>${e(id)}</b><span>${e(ROLES[i])}</span><p><label>ASSIGNED MODEL<select data-model="${e(id)}"><option value="">${s.provider==='jarvis'?'JARVIS MANAGED':'SELECT MODEL'}</option>${choices}</select></label></p><button type="button" data-select="${e(id)}">${id===active?'SELECTED':'SELECT ENTITY'}</button></div>`).join('');
 for(const id of IDS){const sel=document.querySelector(`[data-model="${CSS.escape(id)}"]`);if(s.models[id]&&!discovered.includes(s.models[id]))sel.add(new Option(s.models[id]+' (NOT DISCOVERED)',s.models[id]));sel.value=s.models[id]||'';}
}
function fields(){return {provider:$('provider').value,url:$('service-url').value,models:Object.fromEntries(IDS.map(id=>[id,document.querySelector(`[data-model="${CSS.escape(id)}"]`)?.value||'']))}}
$('provider').onchange=()=>{settings=fields();const d={ollama:'http://127.0.0.1:11434',jarvis:'http://127.0.0.1:8768','openai-local':'http://127.0.0.1:1234'};settings.url=d[settings.provider];settings.models={};discovered=[];paint()};
$('discover').onclick=async()=>{try{$('discovery').textContent='CONNECTING…';settings=fields();const d=await api('/operator/api/discover',{settings});discovered=d.models;settings.models=Object.fromEntries(IDS.map(id=>[id,discovered.includes(settings.models[id])?settings.models[id]:'']));paint();$('discovery').textContent=`CONNECTED / ${discovered.length} MODELS`;}
catch(err){$('discovery').textContent='ERROR / '+err.message}};
$('save').onclick=async()=>{try{settings=fields();await api('/operator/api/settings',settings);$('discovery').textContent='SETTINGS SAVED LOCALLY';}catch(err){$('discovery').textContent=err.message}};
$('agent-settings').onclick=ev=>{const btn=ev.target.closest('[data-select]');if(!btn)return;active=btn.dataset.select;settings=fields();paint()};
$('run').onclick=async()=>{try{settings=fields();await api('/operator/api/settings',settings);const r=await api('/operator/api/run',{agent_id:active,prompt:$('prompt').value});running=r.id;$('run-status').textContent=`${active} / RUNNING`;poll()}catch(err){$('run-status').textContent=err.message}};
$('cancel').onclick=async()=>{try{await api('/operator/api/cancel',{agent_id:active});$('run-status').textContent='CANCELLING…'}catch(err){$('run-status').textContent=err.message}};
async function poll(){try{const r=await api('/api/results?limit=12');$('results').innerHTML=r.runs.map(x=>`<div class="result"><small>${e(x.agent_id)} / ${e(x.provider)} / ${e(x.model||'AUTO')} / ${e(x.status.toUpperCase())} / ${e(x.started_at)}</small><h3>${e(x.prompt)}</h3>${e(x.answer||x.error||'Research in progress…')}</div>`).join('')||'<p>No research results yet.</p>';if(running){const row=r.runs.find(x=>x.id===running);if(row&&row.status!=='running'){$('run-status').textContent=row.status.toUpperCase();running=null}}}catch(e){$('run-status').textContent=e.message}}
const s=await api('/operator/api/settings').catch(()=>null);settings=s?.settings||{provider:'ollama',url:'http://127.0.0.1:11434',models:{}};paint();if(s?.lowLoad){$('provider').disabled=true;$('service-url').disabled=true;$('discovery').textContent='JARVIS SHARED / UP TO 3 CONCURRENT AGENTS';}
async function updateAutonomous(){
 const el=$('autonomous-overview');if(!el)return;
 try{
  const a=await api('/operator/api/autonomous');
  if(!a.enabled){el.textContent='AUTONOMOUS MODE DISABLED // manual research is available';return;}
  const html=(a.agents||[]).map(x=>{
   const running=(a.active||[]).includes(x.agent_id);
   return '<div class="auto-agent"><b>'+e(x.agent_id)+'</b><span>'+e(running?'RESEARCHING NOW':x.status==='paused_for_resources'?'RESOURCE PAUSE':'SCHEDULED / IDLE')+'</span><span>NEXT CYCLE: '+e(x.nextDueAt||'STARTING')+'</span></div>';
  }).join('');
  el.innerHTML='<div class="auto-status">'+html+'</div><p class="note">ACTIVE REQUESTS '+e((a.active||[]).length)+' / '+e(a.maxConcurrent)+' · INTERVAL '+e(a.intervalMinutes)+' MIN · MEMORY FLOOR '+e(a.minFreeRamGB)+' GB</p>'+(a.pausedReason?'<div class="auto-pressure">'+e(a.pausedReason)+'</div>':'');
 }catch(err){el.textContent='LOCAL AUTONOMOUS STATUS UNAVAILABLE: '+err.message;}
}
poll();updateAutonomous();setInterval(poll,10000);setInterval(updateAutonomous,10000);
