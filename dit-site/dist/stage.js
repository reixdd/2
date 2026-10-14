// DEAD INTERNET THEORY — agent control-room stage (WebGL via Three.js, lazy-loaded).
//
// Detailed, transparent 2.5D portraits share a camera and softly animated city backdrop.
// Prototype GLBs remain in dit-assets for authoring; they are not the production characters.
// Research activity always comes from the existing API. Idle motion is visual only.
import { createQualityController, opaqueAt } from './stage-quality.js';
const THREE_URL = './vendor/three.module.js';
const AGENTS = [
  { id: 'GHOST_001', title: 'THE ARCHIVIST', model: 'ghost_001', accent: 0x66baff },
  { id: 'NULL_ENTITY', title: 'THE SIGNAL HUNTER', model: 'null_entity', accent: 0xb18aff },
  { id: 'ECHO.exe', title: 'THE VIRAL MACHINE', model: 'echo_exe', accent: 0x8ddfae },
];
// energy: overall brightness/scan; glitch: chromatic split; pulse: breathing/pulse rate
const STATE_PARAMS = {
  IDLE: { energy: 0.12, glitch: 0, pulse: 0.6, red: 0.0 },
  OBSERVING: { energy: 0.45, glitch: 0.02, pulse: 1.0, red: 0.12 },
  THINKING: { energy: 0.8, glitch: 0.05, pulse: 2.2, red: 0.23 },
  CREATING: { energy: 1.0, glitch: 0.35, pulse: 3.0, red: 0.32 },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionPreference.matches;
motionPreference.addEventListener('change', e => { reduced = e.matches; window.dispatchEvent(new Event('dit:motion')); });
const host = document.getElementById('dit-stage');
if (host) boot();

function boot() {
  const section = host;
  section.innerHTML = `
    <div class="dit-stage-frame">
      <div class="hud-orbit-field" aria-hidden="true">
        <span class="hud-orbit hud-orbit-left"></span>
        <span class="hud-orbit hud-orbit-center"></span>
        <span class="hud-orbit hud-orbit-right"></span>
        <span class="hud-center-axis"></span>
      </div><canvas id="dit-stage-canvas" tabindex="-1" aria-hidden="true"></canvas>
      <div class="dit-stage-still" id="dit-stage-still">${AGENTS.map((a,i)=>`<button type="button" class="still-agent still-${i}" data-stage-open="${a.id}" aria-label="Open ${a.id} dossier"><span></span></button>`).join('')}</div>
      <p class="dit-stage-fallback mono" id="dit-stage-fallback" hidden></p></div>
    <div class="dit-stage-labels" id="dit-stage-labels">${AGENTS.map((a,i) => `
      <div class="dit-stage-label" data-stage-agent="${esc(a.id)}">
        <span class="entity-index">ENTITY_00${i+1}</span>
        <strong>${esc(a.id)}</strong><span class="agent-role">${esc(a.title)}</span>
        <span class="agent-live-state" data-stage-state="${esc(a.id)}">IDLE</span>
        <div class="label-action">
          <button class="mini-vote" type="button" data-stage-open="${esc(a.id)}">VIEW DOSSIER</button>
          <button class="mini-vote" type="button" data-vote="${esc(a.id)}">VOTE</button>
          <button class="mini-vote more-btn" type="button" data-stage-more="${esc(a.id)}" aria-expanded="false" aria-controls="stage-more-${i}" aria-label="Votes and latest signal for ${esc(a.id)}" title="Votes and latest signal">⋮</button>
        </div>
        <div class="label-more" id="stage-more-${i}" hidden>
          <small data-stage-message="${esc(a.id)}">AWAITING RESEARCH SIGNALS</small>
          <span data-vote-count="${esc(a.id)}">0 VOTES</span>
          <div class="label-meter"><i data-vote-bar="${esc(a.id)}"></i></div>
        </div>
      </div>`).join('')}</div>`;

  // Grand Line-like scene depth: the city and atmospheric bars follow the cursor.
  // A single rAF batches writes, while CSS reduced-motion keeps the scene still.
  let worldRaf=0, worldPointer={x:0,y:0};
  function moveWorld(e) {
    if (reduced || e.pointerType==='touch') return;
    worldPointer.x=(e.clientX/window.innerWidth-.5)*2;
    worldPointer.y=(e.clientY/window.innerHeight-.5)*2;
    if(worldRaf) return;
    worldRaf=requestAnimationFrame(()=>{
      worldRaf=0;
      document.documentElement.style.setProperty('--world-x',(-worldPointer.x*16).toFixed(1)+'px');
      document.documentElement.style.setProperty('--world-y',(-worldPointer.y*11).toFixed(1)+'px');
      document.documentElement.style.setProperty('--bars-x',(-worldPointer.x*28).toFixed(1)+'px');
    });
  }
  window.addEventListener('pointermove',moveWorld,{passive:true});
  window.addEventListener('pagehide',()=>{window.removeEventListener('pointermove',moveWorld);cancelAnimationFrame(worldRaf);},{once:true});
  const note = document.querySelector('#dit-stage-note');
  const fallback = section.querySelector('#dit-stage-fallback');
  const canvas = section.querySelector('#dit-stage-canvas');
  const live = { agents: new Map(), workerAlive: false, received: false, unavailable: false };

  const paintLabels = () => {
    for (const a of AGENTS) {
      const el = section.querySelector(`[data-stage-state="${CSS.escape(a.id)}"]`);
      const s = live.agents.get(a.id);
      if (el) el.textContent = live.unavailable ? 'STATE UNAVAILABLE' : !live.received ? 'STATE UNKNOWN' : !live.workerAlive ? `${s || 'IDLE'} / WORKER OFFLINE` : (s || 'IDLE');
      const plate = section.querySelector(`[data-stage-agent="${CSS.escape(a.id)}"]`);
      if (plate) { plate.dataset.machineState = live.workerAlive ? (s || 'IDLE') : 'STANDBY'; plate.dataset.workerOnline = String(live.workerAlive); }
    }
    note.textContent = live.unavailable ? 'BACKEND UNAVAILABLE' : !live.received ? 'AWAITING BACKEND' : live.workerAlive ? 'STATES FROM LIVE WORKER' : 'WORKER OFFLINE — AGENTS DIMMED';
  };
  window.addEventListener('dit:messages', e => {
    for (const [id, title] of Object.entries(e.detail || {})) {
      const label = section.querySelector(`[data-stage-message="${CSS.escape(id)}"]`);
      if (label) label.textContent = title || 'AWAITING RESEARCH SIGNALS';
    }
  });
  window.addEventListener('dit:agents', e => {
    live.unavailable=!!e.detail.unavailable;live.received = true; live.workerAlive = !!e.detail.workerAlive;
    for (const a of e.detail.agents || []) live.agents.set(a.id, a.state);
    paintLabels(); stage?.requestRender();
  });
  const open = id => {
    window.dispatchEvent(new CustomEvent('dit:select', { detail: { id } }));
    if (stage) stage.zoomTo(id, () => window.dispatchEvent(new CustomEvent('dit:open-entity', { detail: { id } })));
    else window.dispatchEvent(new CustomEvent('dit:open-entity', { detail: { id } }));
  };
  const closeMore = except => section.querySelectorAll('[data-stage-more][aria-expanded="true"]').forEach(btn => {
    if (btn === except) return; btn.setAttribute('aria-expanded', 'false'); btn.closest('.dit-stage-label').querySelector('.label-more').hidden = true;
  });
  section.addEventListener('click', e => {
    const b = e.target.closest('[data-stage-open]'); if (b) open(b.dataset.stageOpen);
    const m = e.target.closest('[data-stage-more]');
    if (m) { const panel = m.closest('.dit-stage-label').querySelector('.label-more'); const willOpen = panel.hidden; closeMore(m); panel.hidden = !willOpen; m.setAttribute('aria-expanded', String(willOpen)); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.dit-stage-label')) closeMore(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMore(); });
  section.querySelector('#dit-stage-labels').addEventListener('pointerover', e => {
    const b = e.target.closest('[data-stage-agent]');
    if (b) { section.dataset.focusAgent = b.dataset.stageAgent; stage?.setFocus(b.dataset.stageAgent); }
  });
  section.querySelector('#dit-stage-labels').addEventListener('pointerleave', () => {
    section.dataset.focusAgent = '';stage?.setFocus(null);
  });
  section.addEventListener('focusin', e => { const plate=e.target.closest('[data-stage-agent]'); if(plate) stage?.setFocus(plate.dataset.stageAgent); });
  section.addEventListener('focusout', e => { if (!section.contains(e.relatedTarget)) stage?.setFocus(null); });
  document.getElementById('dossier')?.addEventListener('close', () => stage?.zoomOut());

  let stage = null, started = false;
  const start = async () => {
    if (started) return; started = true;
    try {
      note.textContent = 'ESTABLISHING OBSERVATORY…';
      const THREE = await import(THREE_URL);
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw Error('WebGL is not available in this browser');
      stage = await buildStage(THREE, canvas, live, section);
      section.querySelector("#dit-stage-still").hidden = true;
      paintLabels();
      section.dataset.renderer = 'webgl';
    } catch (err) {
      fallback.hidden = false;
      fallback.textContent = `3D STAGE UNAVAILABLE (${err.message}). THE PORTRAIT FALLBACK AND AGENT PROFILES REMAIN AVAILABLE.`;
      canvas.hidden = true; section.dataset.renderer='fallback';note.textContent = '3D UNAVAILABLE';
    }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '300px' });
    io.observe(section);
  } else start();
}

async function buildStage(THREE, canvas, live, section) {
  const small = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x030405, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const scene = new THREE.Scene();
  // No heavy environment map: transparent portrait shader needs no procedural stage lighting.
  // Transparent viewport: the city artwork is the actual shared backdrop.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  // 2.5D art direction: retain the painterly city and detailed cutouts, without
  // synthetic metallic pedestals or procedural boxes masking the original art.
  const glowTex = (() => { // radial glow sprite texture
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(172,213,220,.75)'); r.addColorStop(1, 'rgba(172,213,220,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();

  // ---- particles ------------------------------------------------------------------------------
  const N = small ? 64 : 130; const pos = new Float32Array(N * 3); const vel = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 26; pos[i * 3 + 1] = Math.random() * 8 - 2; pos[i * 3 + 2] = (Math.random() - .5) * 14 - 1; vel[i] = .1 + Math.random() * .4; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xb7bec2, size: small ? .05 : .04, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(pGeo, pMat));

  // ---- agents ---------------------------------------------------------------------------------
  // Three separate transparent cutouts retain the supplied detail, with subtle shared-camera motion.
  const textures = await Promise.all(AGENTS.map(a=>new Promise((resolve,reject)=>new THREE.TextureLoader().load(`assets/cutouts/${a.model}.png`,resolve,undefined,()=>reject(Error('Character cutout missing: '+a.model))))));
  const masks = textures.map(t=>{const c=document.createElement('canvas');c.width=t.image.width;c.height=t.image.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(t.image,0,0);const rgba=g.getImageData(0,0,c.width,c.height).data;const data=new Uint8Array(c.width*c.height);for(let i=0;i<data.length;i++){data[i]=rgba[i*4+3];}return {width:c.width,height:c.height,data};});
  for(const t of textures){t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy())}
  const vert='varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const frag=`
    uniform sampler2D map; uniform vec2 mouse; uniform float time, energy, glitch, dim, hover; uniform vec3 accent;
    varying vec2 vUv;
    void main(){
      vec2 p=vUv;
      vec4 base=texture2D(map,p);
      float depth=dot(base.rgb,vec3(.299,.587,.114));
      // Keep silhouette UVs stable so lighting never exposes the image rectangle.
      p=vUv;
      // Avoid horizontal digital tear bands on character faces.
      float dx=glitch*(.5+.5*sin(time*2.5));
      vec4 sampleColor=base;
      if(sampleColor.a < .035) discard;
      vec3 c=sampleColor.rgb;
      if(glitch>.001){c.r=texture2D(map,p+vec2(dx*.022,0.)).r;c.b=texture2D(map,p-vec2(dx*.022,0.)).b;}
      float edge=0.;
      if(hover>.001) edge=max(0.,sampleColor.a-texture2D(map,p+vec2(.006,0.)).a);
      c+=accent*hover*(edge*.65+depth*.08);
      float lowLight=1.0-smoothstep(0.,.46,vUv.y);
      c+=accent*lowLight*(.08+.22*depth)*(.4+.30*hover+.20*energy);
      c*=mix(.56,1.,dim)*(.90+.12*energy+.12*hover);
      // Trust the cutout's real alpha instead of cropping it into a synthetic wedge.
      // Only feather the last few bottom pixels into the podium contact shadow.
      float seat=smoothstep(.006,.055,vUv.y);
      gl_FragColor=vec4(c,sampleColor.a*seat);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const FIG=1.17; // Larger, character-first 2.5D composition with no base pedestal
  const items=AGENTS.map((a,i)=>{
    const group=new THREE.Group();
    const uniforms={map:{value:textures[i]},mouse:{value:new THREE.Vector2()},time:{value:0},energy:{value:.1},glitch:{value:0},dim:{value:1},hover:{value:0},accent:{value:new THREE.Color(a.accent)}};
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.42*FIG,3.47*FIG),new THREE.ShaderMaterial({uniforms,vertexShader:vert,fragmentShader:frag,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
    mesh.renderOrder=20;mesh.userData.agent=a.id;group.add(mesh);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:a.accent,transparent:true,opacity:.09,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.scale.set(3.8,4.8,1);glow.position.set(0,1.9,-.38);group.add(glow);
    group.position.set((i-1)*3.85,-2.17,0);mesh.position.y=3.47*FIG/2-.02;scene.add(group);
    return {id:a.id,group,mesh,glow,uniforms,cur:{energy:.1,glitch:0,dim:1},hover:0,phase:i*1.7,model:null,mixer:null,head:null,labelPosition:new THREE.Vector3(),label:section.querySelector(`[data-stage-agent="${CSS.escape(a.id)}"]`),lastLabelX:null,mask:masks[i],modelFile:a.model,baseX:group.position.x};
  });
  const byId=new Map(items.map(it=>[it.id,it]));

  // The GLBs are retained as authoring prototypes; the production scene uses these
  // detailed transparent portraits with lightweight depth, no opaque pedestals.

  // ---- interaction ----------------------------------------------------------------------------
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const pointer = { x: 0, y: 0, in: false };
  const BASE_Y = .12; let focusId = null; let zoom = null; let camTarget = { x: 0, z: 10, y: BASE_Y }; const cam = { x: 0, z: 10, y: BASE_Y };
  const HALF_TAN = Math.tan(THREE.MathUtils.degToRad(19)); // half of the 38deg vertical fov
  // Height-bound on wide canvases, width-bound on narrow ones. Figure spacing follows the visible width so
  // the three machines span the whole stage and stay aligned with the labels below them.
  const layoutFor = aspect => {
    const a = Math.max(.35, aspect || 2);
    const minGap = a < 1.3 ? 3.6 : 3.9; // keep all three silhouettes within the portrait viewport
    const z = Math.min(34, Math.max(7.65, (2 * minGap + 4.0) / (2 * HALF_TAN * a)));
    const W = 2 * HALF_TAN * z * a, spacing = Math.min(6.2, Math.max(minGap, .24 * W));
    return { z, W, spacing };
  };
  const baseZ = () => layoutFor(camera.aspect).z;
  function applyLayout() {
    const { W, spacing } = layoutFor(camera.aspect);
    items.forEach((it, i) => { it.baseX = (i - 1) * spacing; it.group.position.x = it.baseX; });
    section.style.setProperty('--stage-span', (Math.min(96, 3 * spacing / W * 100)).toFixed(2) + '%');
  }
  const pick = e => {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(items.map(i => i.group), true).find(h => { const it=items.find(i=>i.mesh===h.object); return it && opaqueAt(it.mask,h.uv); });
    if (!hit) return null; let o = hit.object; while (o && o.parent !== scene) o = o.parent;
    return items.find(i => i.group === o)?.id || null;
  };
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1); pointer.in = true;
    focusId = pick(e); canvas.style.cursor = focusId ? 'pointer' : 'default'; section.dataset.focusAgent = focusId || ''; if(!quality.lowPower)requestRender();
  });
  canvas.addEventListener('pointerleave', () => { pointer.in = false; focusId = null; section.dataset.focusAgent = ''; if(!quality.lowPower)requestRender(); });
  canvas.addEventListener('click', e => { const id = pick(e); if (id) { section.querySelector(`[data-stage-open="${CSS.escape(id)}"]`)?.click(); } });

  function zoomTo(id, done) {
    const it = byId.get(id); if (!it) return done?.();
    camTarget = { x: it.baseX * .35, y: BASE_Y, z: baseZ() * .90 };
    if (reduced || quality.lowPower) { done?.(); return; }
    clearTimeout(zoom); zoom = setTimeout(() => done?.(), 380); requestRender();
  }
  function zoomOut() { clearTimeout(zoom); zoom=null; camTarget = { x: 0, y: BASE_Y, z: baseZ() }; if (reduced) { Object.assign(cam, camTarget); render(); } requestRender(); }
  function setFocus(id) { focusId = id; section.dataset.focusAgent = id || ''; if(!quality.lowPower)requestRender(); }

  // ---- sizing / loop --------------------------------------------------------------------------
  const quality = createQualityController(devicePixelRatio, small);
  let lastFrame = 0, disposed = false, lost = false, needsResize = true;
  function resize() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 420;
    renderer.setPixelRatio(quality.dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    applyLayout();
    if (!zoom) { camTarget = {x:0,y:BASE_Y,z:baseZ()}; Object.assign(cam,camTarget); }
  }
  // Resizing clears WebGL's drawing buffer. Defer it until a frame can actually
  // render, so an offscreen/reduced-motion resize never leaves an empty canvas.
  const resizeObserver = new ResizeObserver(()=>{needsResize=true;requestRender();}); resizeObserver.observe(canvas);

  const clock = new THREE.Clock(); let visible = true, raf = 0, pending = false;
  const visibilityObserver = new IntersectionObserver(es => { visible = es[0].isIntersecting; lastFrame=0; if (visible) requestRender(); }); visibilityObserver.observe(canvas);
  const lerp = (a, b, t) => a + (b - a) * t;

  function update(dt, t) {
    const still = reduced || quality.lowPower;
    const aliveDim = live.received && live.workerAlive ? 1 : .89;
    for (const it of items) {
      const stateName = live.agents.get(it.id) || 'IDLE';
      const p = live.received && live.workerAlive ? (STATE_PARAMS[stateName] || STATE_PARAMS.IDLE) : STATE_PARAMS.IDLE;
      const k = Math.min(1, dt * 3);
      it.cur.energy = lerp(it.cur.energy, p.energy, k); it.cur.glitch = lerp(it.cur.glitch, p.glitch, k); it.cur.dim = lerp(it.cur.dim, aliveDim, k);
      it.hover = lerp(it.hover, focusId === it.id ? 1 : 0, Math.min(1, dt * 6));
      const u = it.uniforms; u.time.value = t; u.energy.value = it.cur.energy; u.glitch.value = it.cur.glitch; u.dim.value = it.cur.dim; u.hover.value = it.hover;
      const mx = still ? 0 : pointer.in ? pointer.x : Math.sin(t * .2 + it.phase) * .25, my = still ? 0 : pointer.in ? pointer.y : Math.cos(t * .17 + it.phase) * .15;
      u.mouse.value.set(mx, my);
      const breathe = still ? 0 : Math.sin(t * (.9 * p.pulse + .6) + it.phase) * (.008 + p.energy * .012);
      it.group.scale.set(1 + breathe * .4 + it.hover * .025, 1 + breathe + it.hover * .025, 1);                                  // breathing
      it.group.rotation.y = lerp(it.group.rotation.y, mx * .22 + (it.baseX ? -it.baseX * .008 : 0), Math.min(1, dt * 5)); // restore V6 responsiveness for all THREE silhouettes
      it.group.rotation.x = lerp(it.group.rotation.x, -my * .09, Math.min(1, dt * 5));
      it.glow.material.opacity = .11 + it.cur.energy * .15 * (.8 + .2 * Math.sin(t * p.pulse * 2 + it.phase)) + it.hover * .18;
      if (it.mixer) it.mixer.update(dt);
      if (it.head) { it.head.rotation.y = lerp(it.head.rotation.y, mx * .6, .1); it.head.rotation.x = lerp(it.head.rotation.x, -my * .3, .1); }
    }
    const anyBusy = items.some(i => i.cur.energy > .4);
    pMat.opacity = .35 + (anyBusy ? .35 : 0);
    const a = pGeo.attributes.position;
    for (let i = 0; i < N; i++) { let y = a.getY(i) + vel[i] * dt * (anyBusy ? 2.4 : .8); if (y > 6) y = -2.2; a.setY(i, y); }
    a.needsUpdate = true;
    const ck = Math.min(1, dt * 2.5); cam.x = lerp(cam.x, camTarget.x, ck); cam.y = lerp(cam.y, camTarget.y, ck); cam.z = lerp(cam.z, camTarget.z, ck);
    camera.position.set(cam.x + (pointer.in && !still ? pointer.x * .35 : 0), cam.y + (pointer.in && !still ? pointer.y * .20 : 0), cam.z);
    camera.lookAt(cam.x * .9, -.32, 0);
    items.forEach(it=>{const v=it.labelPosition.set(it.baseX,-2.5,0).project(camera);const x=(v.x+1)*50;if(it.lastLabelX===null||Math.abs(x-it.lastLabelX)>.035){it.label.style.setProperty("--label-x",`${x}%`);it.lastLabelX=x;}});
  }
  function render() { renderer.render(scene, camera); }
  function frame(now) {
    raf = 0; pending = false;
    if (!visible || document.hidden || disposed || lost) { lastFrame=0; return; }
    if (needsResize) { resize(); needsResize=false; }
    if(lastFrame && !reduced && quality.sample(now-lastFrame)){renderer.setPixelRatio(quality.dpr); renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);}
    if(lastFrame) section.dataset.frameMs=(now-lastFrame).toFixed(1);
    section.dataset.pixelRatio=quality.dpr; lastFrame=now;
    const dt = Math.min(.05, clock.getDelta()); update(dt, clock.elapsedTime); render();
    section.dataset.motion=quality.lowPower?'still':reduced?'reduced':'animated';
    if (!reduced && !quality.lowPower) raf = requestAnimationFrame(frame);
    else if (!quality.lowPower && Math.abs(cam.z - camTarget.z) > .01) requestRender();
  }
  function requestRender() {
    if (raf || pending || disposed || lost) return; pending = true; raf = requestAnimationFrame(frame);
  }
  const resume=()=>{lastFrame=0;quality.reset();if(!document.hidden)requestRender();};
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('dit:motion',resume);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost=true;cancelAnimationFrame(raf);raf=0;pending=false;canvas.hidden=true;section.querySelector('#dit-stage-still').hidden=false;section.dataset.renderer='fallback'; });
  canvas.addEventListener('webglcontextrestored', ()=>{lost=false;canvas.hidden=false;section.querySelector('#dit-stage-still').hidden=true;section.dataset.renderer='webgl';resume();});
  window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;clearTimeout(zoom);cancelAnimationFrame(raf);resizeObserver.disconnect();visibilityObserver.disconnect();document.removeEventListener('visibilitychange',resume);window.removeEventListener('dit:motion',resume);const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])resources.add(m);});resources.forEach(r=>r.dispose());textures.forEach(t=>t.dispose());glowTex.dispose();renderer.dispose();},{once:true});
  document.getElementById('dit-stage-note').textContent = 'OBSERVATORY / 2.5D DEPTH';
  requestRender();
  return { requestRender, zoomTo, zoomOut, setFocus };
}
