// Decorative code is separate from the console of actual recorded events.
let output, target='', cursor=0, timer;
export function typeRecordedEvents(events=[]){
 const next=events.slice(0,4).reverse().map(e=>'> '+e.agent_id+' / '+String(e.title).slice(0,140)).join('\n')||'> awaiting recorded agent events';
 if(next!==target){target=next;cursor=0;if(output)output.textContent='';}
}
export function mountTerminalMotion(shell){
 if(timer)return;
 output=document.createElement('pre');output.className='dit-command-output';output.setAttribute('aria-label','Recorded agent event console');output.setAttribute('aria-live','off');
 shell.querySelector('.dit-room-bottom').insertAdjacentElement('afterend',output);
 const bg=document.createElement('pre');bg.className='terminal-code-bg';bg.setAttribute('aria-hidden','true');document.body.prepend(bg);
 const code=['// DIT terminal display layer','const stream = await observations.read();','for (const signal of stream) {','  preserve(signal.source_observed_at);','  verify(signal.pair_created_at);','  render(signal.contract, signal.artwork);','}','// observe · record · preserve','await events.next();'].join('\n');
 let index=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 timer=setInterval(()=>{if(document.hidden)return;
  if(reduced.matches){output.textContent=target;bg.textContent=code;cursor=target.length;return;}
  if(cursor<target.length){cursor=Math.min(cursor+4,target.length);output.textContent=target.slice(0,cursor);output.scrollTop=output.scrollHeight;}
  index=(index+3)%(code.length*5);bg.textContent=code.repeat(5).slice(0,index)+'_';
 },45);
}
