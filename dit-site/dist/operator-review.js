// Private localhost operator schedule & human concept review.
const $=id=>document.getElementById(id);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const request=async(path,data)=>{const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j};
let drafts=[],selected=null;
async function schedules(){
  try{
    const data=await request('/operator/api/autonomous'),rows=data.schedules||[];
    $('schedule-controls').innerHTML=rows.map(row=>
      '<form class="schedule-row" data-agent="'+h(row.agent_id)+'" data-revision="'+h(row.revision)+'">'+
      '<strong>'+h(row.agent_id)+'</strong><label>Interval (minutes)<input name="interval_minutes" type="number" min="10" max="240" required value="'+h(row.interval_minutes)+'"></label>'+
      '<label><input type="checkbox" name="enabled" '+(row.enabled?'checked':'')+'> Enabled</label>'+
      '<span>'+h(row.status||'waiting')+'</span><button type="submit">SAVE</button></form>').join('')||'<p>Schedules will appear after the local autonomous researcher starts.</p>';
  }catch(e){$('schedule-message').textContent='Schedules unavailable: '+e.message}
}
$('schedule-controls').onsubmit=async ev=>{
  ev.preventDefault();const form=ev.target;if(!form.matches('.schedule-row'))return;
  const data=new FormData(form);
  try{await request('/operator/api/schedule',{agent_id:form.dataset.agent,revision:Number(form.dataset.revision),enabled:data.has('enabled'),interval_minutes:Number(data.get('interval_minutes'))});$('schedule-message').textContent='Saved. The identity will honor its next interval.';await schedules()}
  catch(e){$('schedule-message').textContent=e.message}
};
const required={name:'Concept name',ticker:'Ticker-style identifier (fictional)',hook:'One-line meme hook (under 15 words)',buzzwords:'Buzzwords (comma-separated)',narrative:'Cultural narrative',cultural_origin:'Historical / cultural origin',artwork_brief:'Art direction',social_draft:'Original social content draft (not posted)'};
const anatomy={spread:'Why the narrative may spread',references:'References and recognition',evidence:'What recorded evidence supports',synthetic_distortion:'Risks of synthetic amplification',uncertainty:'Unknowns / limitations'};
function paint(){
  selected=drafts.find(x=>x.id===$('review-select').value)||null;
  $('review-form').hidden=!selected;
  if(!selected)return;
  const c=selected.content||{},a=c.attention_anatomy||{};
  const textarea=(name,label,value)=>'<label>'+h(label)+'<textarea name="'+h(name)+'" rows="'+(['name','ticker'].includes(name)?1:3)+'" required>'+h(value||'')+'</textarea></label>';
  $('review-fields').innerHTML=Object.entries(required).map(([k,v])=>textarea(k,v,k==='buzzwords'?(c[k]||[]).join(', '):c[k])).join('')+
    '<label>Interpretation confidence (0–1)<input name="confidence" type="number" min="0" max="1" step=".01" value="'+h(c.confidence??0.25)+'"></label>'+
    textarea('contradictory_evidence','Counter-evidence (one per line)',(c.contradictory_evidence||[]).join('\n'))+
    '<h3>ATTENTION ANATOMY</h3>'+Object.entries(anatomy).map(([k,v])=>textarea('a_'+k,v,a[k])).join('');
  $('review-sources').textContent='RECORDED SOURCES: '+(selected.source_refs||[]).map(x=>x.title||x.url).join(' · ');
  $('review-message').textContent=selected.agent_id+' / '+selected.status+' / REV '+selected.revision;
}
async function reviews(focus){
  try{
    const d=await request('/operator/api/concepts');drafts=d.concepts||[];
    $('review-select').innerHTML='<option value="">SELECT A CONCEPT</option>'+drafts.map(c=>'<option value="'+h(c.id)+'">'+h(c.agent_id)+' / '+h(c.content?.name)+' / '+h(c.status)+'</option>').join('');
    if(focus)$('review-select').value=focus;
    paint();
    if(!drafts.length)$('review-message').textContent='No valid sourced concepts awaiting review. Successful model research is required first.';
  }catch(e){$('review-message').textContent=e.message}
}
$('review-select').onchange=paint;
$('review-form').onsubmit=async ev=>{
  ev.preventDefault();if(!selected)return;
  const data=new FormData(ev.target),content={...selected.content};
  for(const key of Object.keys(required))content[key]=key==='buzzwords'?String(data.get(key)||'').split(',').map(v=>v.trim()).filter(Boolean).slice(0,4):String(data.get(key)||'');
  content.ticker=content.ticker.toUpperCase().trim();
  content.confidence=Number(data.get('confidence'));
  content.contradictory_evidence=String(data.get('contradictory_evidence')||'').split('\n').map(x=>x.trim()).filter(Boolean);
  content.attention_anatomy=Object.fromEntries(Object.keys(anatomy).map(k=>[k,String(data.get('a_'+k)||'')]));
  try{
    const result=await request('/operator/api/concepts',{id:selected.id,revision:selected.revision,status:ev.submitter.value,content});
    await reviews(result.id);$('review-message').textContent='Saved: '+result.status+'. Only published concepts are public.';
  }catch(e){$('review-message').textContent=e.message}
};
schedules();reviews();setInterval(schedules,60000);
