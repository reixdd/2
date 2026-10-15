// Ambient pseudocode is decorative; actual recorded events use a separate console.
let output,target='',cursor=0,timer,wallTimer;
const snippets={
 left:['// DIT · OBSERVE / RECORD / PRESERVE','const packets = await tape.read();','for (const packet of packets) {','  if (!packet.source) continue;','  const mint = packet.contract;','  validate(mint, "solana");','  preserve(packet.source_observed_at);','  verify(packet.pair_created_at);','  render(packet.artwork);','  await ledger.commit();','}','// NO UNSOURCED QUOTES','const evidence = archive.query();','return evidence.filter(byContract);','await next.signal();'],
 right:['// DIT · MACHINE OBSERVATORY','const observer = core.subscribe();','while (observer.open) {','  const record = await observer.read();','  if (!record.contract) continue;','  check(record.source_metadata);','  index(record.provenance);','  preserve(record.contract);','  emit(record.annotation);','}','// SOURCE ≠ SCREEN UPDATE','const audit = memory.history();','return audit.asReadOnly();','await memory.flush();','// STATUS / RESEARCH ONLY']
};
export function buildCodeWallpaper(side='left',phase=0,rows=70){
 const tokens=snippets[side==='right'?'right':'left'];
 const count=Math.max(1,Math.min(300,Math.trunc(Number(rows))||70));
 return Array.from({length:count},(_,i)=>tokens[(i+phase*3)%tokens.length]).join('\n');
}
export function typeRecordedEvents(events=[]){
 const next=events.slice(0,4).reverse().map(e=>'> '+e.agent_id+' / '+String(e.title).slice(0,140)).join('\n')||'> awaiting recorded agent events';
 if(next!==target){target=next;cursor=0;if(output)output.textContent='';}
}
export function mountTerminalMotion(shell){
 if(timer)return;
 output=document.createElement('pre');
 output.className='dit-command-output';
 output.setAttribute('aria-label','Recorded agent event console');
 output.setAttribute('aria-live','off');
 shell.querySelector('.dit-room-bottom').insertAdjacentElement('afterend',output);
 const left=document.createElement('pre'),right=document.createElement('pre');
 left.className='terminal-code-bg terminal-code-bg--left';
 right.className='terminal-code-bg terminal-code-bg--right';
 left.setAttribute('aria-hidden','true');right.setAttribute('aria-hidden','true');
 document.body.prepend(right);document.body.prepend(left);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let phase=0;
 const paint=()=>{
  const rows=Math.ceil(innerHeight/14.5)+8;
  left.textContent=buildCodeWallpaper('left',phase,rows);
  right.textContent=buildCodeWallpaper('right',phase+2,rows);
 };
 paint();
 if(!reduced.matches)wallTimer=setInterval(()=>{if(document.hidden)return;phase++;paint();},9500);
 window.addEventListener('resize',paint,{passive:true});
 timer=setInterval(()=>{
  if(document.hidden)return;
  if(reduced.matches){if(cursor<target.length){output.textContent=target;cursor=target.length;}return;}
  if(cursor<target.length){
   cursor=Math.min(cursor+4,target.length);
   output.textContent=target.slice(0,cursor);
   output.scrollTop=output.scrollHeight;
  }
 },45);
}
