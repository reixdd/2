// Short local UI clicks only. Audio begins inside a user gesture, never autoplay.
let mounted=false;
export function mountTerminalFeedback(shell){
 if(mounted)return;mounted=true;
 let context,last=0,enabled=true;
 try{enabled=localStorage.getItem('dit:terminal-sound')!=='off'}catch{}
 const button=document.createElement('button');button.type='button';button.id='dit-terminal-sound';
 const sync=()=>{button.textContent=enabled?'SFX ON':'SFX OFF';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label','Interface click sounds');};
 sync();shell.querySelector('.dit-hud-controls')?.append(button);
 button.addEventListener('click',()=>{enabled=!enabled;sync();try{localStorage.setItem('dit:terminal-sound',enabled?'on':'off')}catch{}});
 document.addEventListener('click',event=>{
  const target=event.target.closest('button,a,select,summary');if(!target||target.disabled)return;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){target.classList.add('dit-press');setTimeout(()=>target.classList.remove('dit-press'),150);}
  if(!enabled||!event.isTrusted||performance.now()-last<60)return;last=performance.now();
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   context??=new Audio();if(context.state==='suspended')context.resume().catch(()=>{});
   const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
   osc.type='square';osc.frequency.setValueAtTime(1100,now);osc.frequency.exponentialRampToValueAtTime(170,now+.025);
   gain.gain.setValueAtTime(.018,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.035);
   osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.04);
   osc.onended=()=>{osc.disconnect();gain.disconnect()};
  }catch{/* Audio availability must never block a control. */}
 });
}
