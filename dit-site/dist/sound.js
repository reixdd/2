// DIT ambient engine. The *gesture-unlocked* playback approach comes from Grand Line,
// but the audio palette is original: subdued electronic pulses, modem-like acknowledgements
// and an optional user-supplied local soundtrack. There is no hidden YouTube player or scraping.
const fxToggle = document.getElementById('dit-sound-toggle');
const musicToggle = document.getElementById('dit-music-toggle');
let fxEnabled = false, musicEnabled = false, ctx = null, bus = null, lastHover = 0;
let drone = [], bgAudio = null, usingFile = false;
const params={hover:{frequency:1850,duration:.035,volume:.002},select:{frequency:950,duration:.075,volume:.012},panel:{frequency:420,duration:.12,volume:.013},vote:{frequency:670,duration:.17,volume:.016},transmit:{frequency:260,duration:.3,volume:.010},error:{frequency:190,duration:.20,volume:.013},boot:{frequency:320,duration:.18,volume:.008}};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function ensureAudio() {
  try {
    ctx ||= new (window.AudioContext||window.webkitAudioContext)();
    if(!bus){bus=ctx.createGain();bus.gain.value=.22;bus.connect(ctx.destination)}
    if(ctx.state==='suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
// Non-melodic machine responses: filtered relay noise plus a single low resonant pulse.
function beep(kind='select') {
  if(!fxEnabled)return;const c=ensureAudio();if(!c)return;
  const p=params[kind]||params.select,t=c.currentTime;
  const n=Math.max(128,Math.round(c.sampleRate*p.duration)),buffer=c.createBuffer(1,n,c.sampleRate);
  const data=buffer.getChannelData(0);for(let i=0;i<n;i++){const decay=(1-i/n)**2;data[i]=(Math.random()*2-1)*decay;}
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),amp=c.createGain();source.buffer=buffer;filter.type=kind==='transmit'?'lowpass':'bandpass';filter.frequency.value=p.frequency;filter.Q.value=kind==='hover'?2.2:1.35;
  amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(p.volume,t+.005);amp.gain.exponentialRampToValueAtTime(.0001,t+p.duration);
  source.connect(filter);filter.connect(amp);amp.connect(bus);source.start(t);source.stop(t+p.duration+.02);
  if(kind==='panel'||kind==='transmit'||kind==='vote'){
    const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(kind==='transmit'?63:kind==='vote'?112:78,t);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.006,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(.13,p.duration));
    o.connect(g);g.connect(bus);o.start(t);o.stop(t+Math.max(.14,p.duration)+.02);
  }
}
function startDrone() {
  const c=ensureAudio();if(!c||drone.length)return;
  // 55 Hz + 82.4 Hz with slow LFO: low-mix original synthesized station ambience.
  const lowpass=c.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=245;lowpass.Q.value=.55;lowpass.connect(bus);
  for(const [freq,level] of [[55,.014],[82.41,.009],[164.81,.002]]) {
    const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=freq;
    g.gain.value=level;o.connect(g);g.connect(lowpass);o.start();drone.push(o);
  }
}
function stopDrone(){for(const d of drone){try{d.stop()}catch{}}drone=[];}
async function playLocalSoundtrack(){
  if(!bgAudio){
    // The owner may provide a locally licensed media file. mp4 stays visually hidden.
    for(const file of ['assets/dit-soundtrack.mp3','assets/dit-soundtrack.mp4','assets/dit-soundtrack.webm']){
      try{const r=await fetch(file,{method:'HEAD',signal:AbortSignal.timeout(1500)});if(!r.ok)continue;
        bgAudio=document.createElement(file.endsWith('.mp3')?'audio':'video');bgAudio.src=file;bgAudio.loop=true;bgAudio.preload='auto';
        bgAudio.setAttribute('aria-hidden','true');bgAudio.className='dit-hidden-media';bgAudio.volume=.26;
        if(bgAudio.tagName==='VIDEO')bgAudio.playsInline=true;
        document.body.append(bgAudio);break;
      }catch{}
    }
  }
  if(!musicEnabled)return;
  if(bgAudio){try{await bgAudio.play();usingFile=true;return}catch{/* browser denied playback; user can click again */}}
  usingFile=false;startDrone();
}
function updateToggles(){
 if(fxToggle){fxToggle.textContent=fxEnabled?'◉ FX ON':'◌ FX OFF';fxToggle.setAttribute('aria-pressed',String(fxEnabled));}
 if(musicToggle){musicToggle.textContent=musicEnabled?(usingFile?'Ⅱ MUSIC ON':'Ⅱ AMBIENCE ON'):'▷ AMBIENCE';musicToggle.setAttribute('aria-pressed',String(musicEnabled));musicToggle.title='Music uses assets/dit-soundtrack.mp3, .mp4 or .webm if supplied; otherwise original synthesized ambience.';}
}
fxToggle?.addEventListener('click',()=>{fxEnabled=!fxEnabled;updateToggles();if(fxEnabled)beep('boot')});
musicToggle?.addEventListener('click',async()=>{musicEnabled=!musicEnabled;if(musicEnabled)await playLocalSoundtrack();else{bgAudio?.pause();stopDrone();usingFile=false}updateToggles()});
document.addEventListener('pointerover',e=>{const t=e.target.closest('button, a, [data-stage-agent]');if(!t||t.contains(e.relatedTarget)||performance.now()-lastHover<165)return;lastHover=performance.now();beep('hover')});
document.addEventListener('click',e=>{if(e.target.closest('#dit-sound-toggle,#dit-music-toggle'))return;
 if(e.target.closest('[data-vote]'))beep('vote');
 else if(e.target.closest('[data-panel],.command-nav button'))beep('panel');
 else if(e.target.closest('button,a,[data-stage-agent],#dit-stage-canvas'))beep('select');
});
window.addEventListener('dit:transmission',()=>beep('transmit'));
window.addEventListener('dit:ui-error',()=>beep('error'));
document.addEventListener('visibilitychange',()=>{if(!bgAudio)return;if(document.hidden&&musicEnabled)bgAudio.pause();else if(!document.hidden&&musicEnabled)bgAudio.play().catch(()=>{})});
updateToggles();
