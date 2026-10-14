// DEAD INTERNET THEORY — agent control-room stage (WebGL via Three.js, lazy-loaded).
//
// Detailed, transparent 2.5D portraits share a camera with real PBR podiums and city geometry.
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
    <div class="dit-stage-frame"><canvas id="dit-stage-canvas" tabindex="-1" aria-hidden="true"></canvas>
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
      note.textContent = 'LOADING 3D ENGINE…';
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
  const { RoomEnvironment } = await import('./vendor/RoomEnvironment.js');
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  scene.fog = new THREE.FogExp2(0x0b111a, .022);
  // Transparent viewport: the city artwork is the actual shared backdrop.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  // ---- atmospheric grounding: light floor grid and three raised machine podiums --------------
  const podiums = [];
  const silver = new THREE.MeshStandardMaterial({color:0xb8c2cc,metalness:.91,roughness:.28,envMapIntensity:1.5});
  const darkMetal = new THREE.MeshStandardMaterial({color:0x1d242c,metalness:.88,roughness:.32});
  // Lathed bevel profile: a compact plinth, with the luminous seam recessed below its lip.
  const profile = [[0,-2.30],[1.25,-2.30],[1.30,-2.26],[1.30,-2.22],[1.15,-1.98],[1.12,-1.94],[0,-1.94]];
  const shell = new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),64);
  for (let i=0; i<3; i++) {
    const accent = new THREE.Color(AGENTS[i].accent);
    const podium = new THREE.Group();
    const base = new THREE.Mesh(shell,silver); podium.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.10,1.10,.025,64),darkMetal);
    top.position.y=-1.925; podium.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.155,.014,8,64),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.9}));
    rim.rotation.x=Math.PI/2;rim.position.y=-1.985;podium.add(rim);
    const under = new THREE.Mesh(new THREE.TorusGeometry(1.285,.012,8,64),silver);
    under.rotation.x=Math.PI/2;under.position.y=-2.265;podium.add(under);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(.28,.035,.012),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.76}));
    marker.position.set(0,-2.18,1.253);podium.add(marker);
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,.05,48),darkMetal);foot.position.y=-2.325;podium.add(foot);
    // Radial fasteners sit flush in the silver top bevel.
    const bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.025,.025,.012,6),darkMetal,8);
    for(let n=0;n<8;n++) {const a=n*Math.PI/4;bolts.setMatrixAt(n,new THREE.Matrix4().makeTranslation(Math.sin(a)*1.12,-1.933,Math.cos(a)*1.12));}
    podium.add(bolts);
    scene.add(podium);podiums.push({podium,rim,top,marker,accent});
  }
  const ambient = new THREE.AmbientLight(0xffffff,.62);scene.add(ambient);
  const key = new THREE.DirectionalLight(0xe7f4fa,1.20);key.position.set(-2,5,5);scene.add(key);

  const glowTex = (() => { // radial glow sprite texture
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(172,213,220,.75)'); r.addColorStop(1, 'rgba(172,213,220,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();

  for (const pd of podiums) { // coloured pool of light on each podium
    const pool = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: pd.accent, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.scale.set(3.2, .28, 1); pool.position.set(0, -2.32, .3); pd.podium.add(pool); pd.pool = pool;
  }

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(65,38),new THREE.MeshStandardMaterial({color:0x070e17,metalness:.65,roughness:.32,envMapIntensity:.25,transparent:true,opacity:.65}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,-2.37,-8);scene.add(floor);
  // Soft contact shadows and reflected light anchor the machines without per-frame shadow maps.
  for (const pd of podiums) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.8),new THREE.MeshBasicMaterial({map:glowTex,color:0x000000,transparent:true,opacity:.85,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-2.355;pd.podium.add(shadow);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.6),new THREE.MeshBasicMaterial({map:glowTex,color:0x000000,transparent:true,opacity:.9,depthWrite:false}));
    contact.rotation.x=-Math.PI/2;contact.position.y=-1.903;pd.podium.add(contact);
  }
  // Three instanced architecture layers share the camera and separate the distant city from the foreground.
  const cityGeo=new THREE.BoxGeometry(1,1,1);
  [0,1,2].forEach(layer=>{
    const mat=new THREE.MeshStandardMaterial({color:[0x141b25,0x111722,0x090e16][layer],roughness:.8,metalness:.3,transparent:true,opacity:.22+layer*.06});
    const city=new THREE.InstancedMesh(cityGeo,mat,24), m=new THREE.Matrix4();
    for(let j=0;j<24;j++) {const h=1.5+((j*13+layer*7)%11)*.55; m.compose(new THREE.Vector3((j-12)*1.9,-2.6+h/2,-12+layer*3),new THREE.Quaternion(),new THREE.Vector3(.65+(j%3)*.2,h,.7));city.setMatrixAt(j,m);}
    scene.add(city);
  });
  // ---- particles ------------------------------------------------------------------------------
  const N = small ? 120 : 320; const pos = new Float32Array(N * 3); const vel = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 26; pos[i * 3 + 1] = Math.random() * 8 - 2; pos[i * 3 + 2] = (Math.random() - .5) * 14 - 1; vel[i] = .1 + Math.random() * .4; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xb7bec2, size: small ? .05 : .04, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(pGeo, pMat));

  // ---- agents ---------------------------------------------------------------------------------
  // Three separate transparent cutouts retain the supplied detail, with subtle shared-camera motion.
  const textures = await Promise.all(AGENTS.map(a=>new Promise((resolve,reject)=>new THREE.TextureLoader().load(`assets/cutouts/${a.model}.png`,resolve,undefined,()=>reject(Error('Character cutout missing: '+a.model))))));
  const masks = textures.map(t=>{const c=document.createElement('canvas');c.width=t.image.width;c.height=t.image.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(t.image,0,0);const rgba=g.getImageData(0,0,c.width,c.height).data;const data=new Uint8Array(c.width*c.height);for(let i=0;i<data.length;i++){const x=(i%c.width)/c.width,y=1-Math.floor(i/c.width)/c.height;const half=.28+.22*THREE.MathUtils.smoothstep(y,0,.30);data[i]=Math.abs(x-.5)>half?0:rgba[i*4+3];}return {width:c.width,height:c.height,data};});
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
      float dx=glitch*step(.95,fract(sin(floor(time*8.+p.y*21.)*39.)*433.));
      vec4 sampleColor=base;
      if(sampleColor.a < .035) discard;
      vec3 c=sampleColor.rgb;
      if(glitch>.001){c.r=texture2D(map,p+vec2(dx*.022,0.)).r;c.b=texture2D(map,p-vec2(dx*.022,0.)).b;}
      float scan=.5+.5*sin(p.y*170.-time*2.);
      c*=1.-.075*scan*energy;
      float edge=0.;
      if(hover>.001) edge=max(0.,sampleColor.a-texture2D(map,p+vec2(.006,0.)).a);
      c+=accent*hover*(edge*.65+depth*.08);
      float lowLight=1.0-smoothstep(0.,.46,vUv.y);
      c+=accent*lowLight*(.08+.22*depth)*(.4+.30*hover+.20*energy);
      c*=mix(.56,1.,dim)*(.90+.12*energy+.12*hover);
      float shoulderWidth=mix(.28,.50,smoothstep(.0,.30,vUv.y));
      float silhouette=1.-smoothstep(shoulderWidth-.018,shoulderWidth,abs(vUv.x-.5));
      gl_FragColor=vec4(c,sampleColor.a*silhouette);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const FIG=1.10; // figure scale; cutouts are cropped to content (647x656)
  const items=AGENTS.map((a,i)=>{
    const group=new THREE.Group();
    const uniforms={map:{value:textures[i]},mouse:{value:new THREE.Vector2()},time:{value:0},energy:{value:.1},glitch:{value:0},dim:{value:1},hover:{value:0},accent:{value:new THREE.Color(a.accent)}};
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.42*FIG,3.47*FIG),new THREE.ShaderMaterial({uniforms,vertexShader:vert,fragmentShader:frag,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    mesh.userData.agent=a.id;group.add(mesh);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:a.accent,transparent:true,opacity:.09,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.scale.set(3.8,4.8,1);glow.position.set(0,1.9,-.38);group.add(glow);
    group.position.set((i-1)*3.85,-1.93,0);mesh.position.y=3.47*FIG/2-.23;scene.add(group);
    return {id:a.id,group,mesh,glow,uniforms,cur:{energy:.1,glitch:0,dim:1},hover:0,phase:i*1.7,model:null,mixer:null,head:null,labelPosition:new THREE.Vector3(),label:section.querySelector(`[data-stage-agent="${CSS.escape(a.id)}"]`),lastLabelX:null,mask:masks[i],modelFile:a.model,baseX:group.position.x};
  });
  const byId=new Map(items.map(it=>[it.id,it]));

  // The shipped GLBs are deliberately retained as prototypes in dit-assets, not silently
  // substituted for the higher-fidelity artwork. All foreground podiums are real geometry.

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
    items.forEach((it, i) => { it.baseX = (i - 1) * spacing; it.group.position.x = it.baseX; podiums[i].podium.position.x = it.baseX; });
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
      it.group.scale.set(1 - breathe * .4, 1 + breathe, 1);                                  // breathing
      it.group.rotation.y = lerp(it.group.rotation.y, mx * .055 + (it.baseX ? -it.baseX * .01 : 0), Math.min(1, dt * 4)); // head/body tracking
      it.group.rotation.x = lerp(it.group.rotation.x, -my * .025, Math.min(1, dt * 4));
      it.glow.material.opacity = .11 + it.cur.energy * .15 * (.8 + .2 * Math.sin(t * p.pulse * 2 + it.phase)) + it.hover * .18;
      const podium = podiums[items.indexOf(it)];
      podium.rim.material.opacity = Math.min(1, .72 + it.hover * .28 + it.cur.energy * .09);
      podium.pool.material.opacity = .20 + it.hover * .18 + it.cur.energy * .12;

      podium.marker.material.opacity = .35 + it.hover * .5 + it.cur.energy * .14;
      if (it.mixer) it.mixer.update(dt);
      if (it.head) { it.head.rotation.y = lerp(it.head.rotation.y, mx * .6, .1); it.head.rotation.x = lerp(it.head.rotation.x, -my * .3, .1); }
    }
    const anyBusy = items.some(i => i.cur.energy > .4);
    pMat.opacity = .35 + (anyBusy ? .35 : 0);
    const a = pGeo.attributes.position;
    for (let i = 0; i < N; i++) { let y = a.getY(i) + vel[i] * dt * (anyBusy ? 2.4 : .8); if (y > 6) y = -2.2; a.setY(i, y); }
    a.needsUpdate = true;
    const ck = Math.min(1, dt * 2.5); cam.x = lerp(cam.x, camTarget.x, ck); cam.y = lerp(cam.y, camTarget.y, ck); cam.z = lerp(cam.z, camTarget.z, ck);
    camera.position.set(cam.x + (pointer.in && !still ? pointer.x * .08 : 0), cam.y + (pointer.in && !still ? pointer.y * .04 : 0), cam.z);
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
  window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;clearTimeout(zoom);cancelAnimationFrame(raf);resizeObserver.disconnect();visibilityObserver.disconnect();document.removeEventListener('visibilitychange',resume);window.removeEventListener('dit:motion',resume);const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])resources.add(m);});resources.forEach(r=>r.dispose());textures.forEach(t=>t.dispose());glowTex.dispose();environment.dispose();renderer.dispose();},{once:true});
  document.getElementById('dit-stage-note').textContent = 'LIVE CONTROL ROOM / DEPTH ARTWORK';
  requestRender();
  return { requestRender, zoomTo, zoomOut, setFocus };
}
