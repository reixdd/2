// DEAD INTERNET THEORY — agent control-room stage (WebGL via Three.js, lazy-loaded).
//
// HONESTY NOTES
//  * The supplied portraits are flat 2D artwork. Until rigged GLB models exist, each agent is a
//    depth-parallax plane: a luminance-derived pseudo-depth shifts the image toward the cursor,
//    the plane breathes, tilts toward the pointer ("head tracking" of the whole portrait) and
//    reacts to real backend state. This is NOT articulated 3D and does not blink.
//  * If /assets/models/<agent>.glb exists (ghost_001.glb, null_entity.glb, echo_exe.glb) it is
//    loaded automatically: first animation clip plays, a bone named /head/ tracks the cursor.
//  * Agent states come from the backend ('dit:agents' event). If the research worker is not
//    alive the stage says so and renders agents dimmed instead of pretending activity.
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
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
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const host = document.getElementById('dit-stage');
if (host) boot();

function boot() {
  const section = host;
  section.innerHTML = `
    <div class="dit-stage-frame"><canvas id="dit-stage-canvas" tabindex="-1" aria-hidden="true"></canvas>
      <div class="dit-stage-still" id="dit-stage-still" aria-hidden="true">${AGENTS.map((a,i)=>`<div class="still-agent still-${i}"><span></span></div>`).join('')}</div>
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
  const live = { agents: new Map(), workerAlive: false, received: false };

  const paintLabels = () => {
    for (const a of AGENTS) {
      const el = section.querySelector(`[data-stage-state="${CSS.escape(a.id)}"]`);
      const s = live.agents.get(a.id);
      if (el) el.textContent = !live.received ? 'STATE UNKNOWN' : !live.workerAlive ? `${s || 'IDLE'} / WORKER OFFLINE` : (s || 'IDLE');
      const plate = section.querySelector(`[data-stage-agent="${CSS.escape(a.id)}"]`);
      if (plate) { plate.dataset.machineState = live.workerAlive ? (s || 'IDLE') : 'STANDBY'; plate.dataset.workerOnline = String(live.workerAlive); }
    }
    note.textContent = !live.received ? 'AWAITING BACKEND' : live.workerAlive ? 'STATES FROM LIVE WORKER' : 'WORKER OFFLINE — AGENTS DIMMED';
  };
  window.addEventListener('dit:messages', e => {
    for (const [id, title] of Object.entries(e.detail || {})) {
      const label = section.querySelector(`[data-stage-message="${CSS.escape(id)}"]`);
      if (label) label.textContent = title || 'AWAITING RESEARCH SIGNALS';
    }
  });
  window.addEventListener('dit:agents', e => {
    live.received = true; live.workerAlive = !!e.detail.workerAlive;
    for (const a of e.detail.agents || []) live.agents.set(a.id, a.state);
    paintLabels(); stage?.requestRender();
  });
  const open = id => {
    if (stage) stage.zoomTo(id, () => window.dispatchEvent(new CustomEvent('dit:open-entity', { detail: { id } })));
    else window.dispatchEvent(new CustomEvent('dit:open-entity', { detail: { id } }));
  };
  const closeMore = except => section.querySelectorAll('[data-stage-more][aria-expanded="true"]').forEach(btn => {
    if (btn === except) return; btn.setAttribute('aria-expanded', 'false'); btn.closest('.dit-stage-label').querySelector('.label-more').hidden = true;
  });
  section.querySelector('#dit-stage-labels').addEventListener('click', e => {
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
      section.querySelector("#dit-stage-still")?.classList.add("has-webgl");
      paintLabels();
    } catch (err) {
      fallback.hidden = false;
      fallback.textContent = `3D STAGE UNAVAILABLE (${err.message}). THE PORTRAIT FALLBACK AND AGENT PROFILES REMAIN AVAILABLE.`;
      canvas.hidden = true; note.textContent = '3D UNAVAILABLE';
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
  const scene = new THREE.Scene();
  // Transparent viewport: the city artwork is the actual shared backdrop.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  // ---- atmospheric grounding: light floor grid and three raised machine podiums --------------
  const grid = new THREE.GridHelper(38, 24, 0x27434d, 0x17262d); grid.position.y = -2.15; grid.material.transparent = true; grid.material.opacity = .19; scene.add(grid);
  // Silver sculpted podiums cast neutral reflections, with restrained per-agent base glow.
  const podiums = [];
  for (let i=0; i<3; i++) {
    const accent = new THREE.Color(AGENTS[i].accent);
    const podium = new THREE.Group(); podium.position.x = (i-1)*3.85; podium.scale.set(1.3,1,1.3);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.18,1.40,.40,32,2),new THREE.MeshStandardMaterial({color:0xa5acb0,metalness:.91,roughness:.19,envMapIntensity:1.5}));
    base.position.y = -2.08; podium.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,.04,48),new THREE.MeshStandardMaterial({color:0xc9ced0,metalness:.95,roughness:.17,transparent:true,opacity:.83}));
    top.position.y=-1.897;podium.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.20,.05,10,64),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.9}));
    rim.rotation.x=Math.PI/2;rim.position.y=-1.88;podium.add(rim);
    const under = new THREE.Mesh(new THREE.TorusGeometry(1.36,.022,8,48),new THREE.MeshStandardMaterial({color:0xe4e6e7,metalness:.85,roughness:.18,transparent:true,opacity:.78}));
    under.rotation.x=Math.PI/2;under.position.y=-2.23;podium.add(under);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(.66,.07,.04),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.76}));
    marker.position.set(0,-2.065,1.29);podium.add(marker);
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(1.36,1.43,.10,48),new THREE.MeshStandardMaterial({color:0x50565a,metalness:.9,roughness:.23}));foot.position.y=-2.32;podium.add(foot);
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
    pool.scale.set(5.2, 1.5, 1); pool.position.set(0, -1.86, .2); pd.podium.add(pool); pd.pool = pool;
  }

  // ---- particles ------------------------------------------------------------------------------
  const N = small ? 120 : 320; const pos = new Float32Array(N * 3); const vel = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 26; pos[i * 3 + 1] = Math.random() * 8 - 2; pos[i * 3 + 2] = (Math.random() - .5) * 14 - 1; vel[i] = .1 + Math.random() * .4; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xb7bec2, size: small ? .05 : .04, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(pGeo, pMat));

  // ---- agents ---------------------------------------------------------------------------------
  // Three separate transparent cutouts extracted from the supplied artwork. The characters
  // remain 2D depth-parallax figures, not fabricated rigged meshes.
  const textures = await Promise.all(AGENTS.map(a=>new Promise((resolve,reject)=>new THREE.TextureLoader().load(`assets/cutouts/${a.model}.png`,resolve,undefined,()=>reject(Error('Character cutout missing: '+a.model))))));
  for(const t of textures){t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false}
  const vert='varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const frag=`
    uniform sampler2D map; uniform vec2 mouse; uniform float time, energy, glitch, dim, hover; uniform vec3 accent;
    varying vec2 vUv;
    void main(){
      vec2 p=vUv;
      vec4 base=texture2D(map,p);
      float depth=dot(base.rgb,vec3(.299,.587,.114));
      p=clamp(p+mouse*.012*(depth-.32),vec2(.002),vec2(.998));
      float dx=glitch*step(.95,fract(sin(floor(time*8.+p.y*21.)*39.)*433.));
      vec4 sampleColor=texture2D(map,p);
      vec3 c=vec3(texture2D(map,p+vec2(dx*.022,0.)).r,sampleColor.g,texture2D(map,p-vec2(dx*.022,0.)).b);
      float scan=.5+.5*sin(p.y*170.-time*2.);
      c*=1.-.075*scan*energy;
      c+=accent*.10*hover*(1.-depth);
      float lowLight=smoothstep(.46,0.,vUv.y);
      c+=accent*lowLight*(.20+.55*depth)*(.55+.40*hover+.30*energy);
      c*=mix(.56,1.,dim)*(.90+.12*energy+.12*hover);
      gl_FragColor=vec4(c,sampleColor.a);
    }`;
  const FIG=1.25; // figure scale; cutouts are cropped to content (647x656)
  const items=AGENTS.map((a,i)=>{
    const group=new THREE.Group();
    const uniforms={map:{value:textures[i]},mouse:{value:new THREE.Vector2()},time:{value:0},energy:{value:.1},glitch:{value:0},dim:{value:1},hover:{value:0},accent:{value:new THREE.Color(a.accent)}};
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.42*FIG,3.47*FIG),new THREE.ShaderMaterial({uniforms,vertexShader:vert,fragmentShader:frag,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    mesh.userData.agent=a.id;group.add(mesh);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:a.accent,transparent:true,opacity:.09,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.scale.set(6.2,5.4,1);glow.position.set(0,-.25,-.38);group.add(glow);
    group.position.set((i-1)*3.85,.22,i===1?.20:0);scene.add(group);
    return {id:a.id,group,mesh,glow,uniforms,cur:{energy:.1,glitch:0,dim:1},hover:0,phase:i*1.7,model:null,mixer:null,head:null,modelFile:a.model,baseX:group.position.x};
  });
  const byId=new Map(items.map(it=>[it.id,it]));

  // optional real GLB models (only when files actually exist)
  (async () => {
    for (const it of items) {
      try {
        const head = await fetch(`assets/models/${it.modelFile}.glb`, { method: 'HEAD' });
        if (!head.ok || !/model|octet|gltf/i.test(head.headers.get('content-type') || 'model')) continue;
        const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
        const gltf = await new GLTFLoader().loadAsync(`assets/models/${it.modelFile}.glb`);
        const box = new THREE.Box3().setFromObject(gltf.scene); const size = box.getSize(new THREE.Vector3());
        const k = 4.2 / Math.max(size.y, .001); gltf.scene.scale.setScalar(k);
        const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k); gltf.scene.position.sub(c);
        it.group.add(gltf.scene); it.mesh.visible = false; it.model = gltf.scene;
        gltf.scene.traverse(o => { if (o.isBone && /head/i.test(o.name)) it.head = o; });
        if (gltf.animations?.length) { it.mixer = new THREE.AnimationMixer(gltf.scene); it.clips = gltf.animations; it.mixer.clipAction(gltf.animations[0]).play(); }
        scene.add(new THREE.AmbientLight(0xffffff, .36)); const dl = new THREE.DirectionalLight(0xb2dae4, 1.4); dl.position.set(2, 4, 4); scene.add(dl);
        requestRender();
      } catch { /* no model for this agent — parallax plane remains */ }
    }
  })();

  // ---- interaction ----------------------------------------------------------------------------
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const pointer = { x: 0, y: 0, in: false };
  const BASE_Y = -.1; let focusId = null; let zoom = null; let camTarget = { x: 0, z: 10, y: BASE_Y }; const cam = { x: 0, z: 10, y: BASE_Y };
  const HALF_TAN = Math.tan(THREE.MathUtils.degToRad(19)); // half of the 38deg vertical fov
  // Height-bound on wide canvases, width-bound on narrow ones. Figure spacing follows the visible width so
  // the three machines span the whole stage and stay aligned with the labels below them.
  const layoutFor = aspect => {
    const a = Math.max(.35, aspect || 2);
    const minGap = a < 1.3 ? 3.2 : 3.9; // portrait screens let the busts overlap slightly instead of shrinking
    const z = Math.min(34, Math.max(8.1, (2 * minGap + 4.5) / (2 * HALF_TAN * a)));
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
    const hit = ray.intersectObjects(items.map(i => i.group), true).find(h => !h.object.isSprite && h.object.visible !== false);
    if (!hit) return null; let o = hit.object; while (o && o.parent !== scene) o = o.parent;
    return items.find(i => i.group === o)?.id || null;
  };
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1); pointer.in = true;
    focusId = pick(e); canvas.style.cursor = focusId ? 'pointer' : 'default'; section.dataset.focusAgent = focusId || ''; requestRender();
  });
  canvas.addEventListener('pointerleave', () => { pointer.in = false; focusId = null; section.dataset.focusAgent = ''; requestRender(); });
  canvas.addEventListener('click', e => { const id = pick(e); if (id) { section.querySelector(`[data-stage-open="${CSS.escape(id)}"]`)?.click(); } });

  function zoomTo(id, done) {
    const it = byId.get(id); if (!it) return done?.();
    camTarget = { x: it.baseX * .85, y: -.05, z: Math.max(5.2, baseZ() * .5) };
    if (reduced) { Object.assign(cam, camTarget); done?.(); render(); return; }
    clearTimeout(zoom); zoom = setTimeout(() => done?.(), 650); requestRender();
  }
  function zoomOut() { clearTimeout(zoom); camTarget = { x: 0, y: BASE_Y, z: baseZ() }; if (reduced) { Object.assign(cam, camTarget); render(); } requestRender(); }
  function setFocus(id) { focusId = id; section.dataset.focusAgent = id || ''; requestRender(); }

  // ---- sizing / loop --------------------------------------------------------------------------
  const dprMax = small ? 1.25 : 1.75;
  function resize() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 420;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprMax)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    applyLayout();
    if (!zoom) { camTarget.z = baseZ(); if (reduced) cam.z = camTarget.z; }
  }
  new ResizeObserver(resize).observe(canvas); resize(); Object.assign(cam, { z: baseZ() }); camTarget.z = baseZ();

  const clock = new THREE.Clock(); let visible = true, raf = 0, pending = false;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) requestRender(); }).observe(canvas);
  const lerp = (a, b, t) => a + (b - a) * t;

  function update(dt, t) {
    const aliveDim = live.received && live.workerAlive ? 1 : .89;
    for (const it of items) {
      const stateName = live.agents.get(it.id) || 'IDLE';
      const p = live.received && live.workerAlive ? (STATE_PARAMS[stateName] || STATE_PARAMS.IDLE) : STATE_PARAMS.IDLE;
      const k = Math.min(1, dt * 3);
      it.cur.energy = lerp(it.cur.energy, p.energy, k); it.cur.glitch = lerp(it.cur.glitch, p.glitch, k); it.cur.dim = lerp(it.cur.dim, aliveDim, k);
      it.hover = lerp(it.hover, focusId === it.id ? 1 : 0, Math.min(1, dt * 6));
      const u = it.uniforms; u.time.value = t; u.energy.value = it.cur.energy; u.glitch.value = it.cur.glitch; u.dim.value = it.cur.dim; u.hover.value = it.hover;
      const mx = pointer.in ? pointer.x : Math.sin(t * .2 + it.phase) * .25, my = pointer.in ? pointer.y : Math.cos(t * .17 + it.phase) * .15;
      u.mouse.value.set(mx, my);
      const breathe = reduced ? 0 : Math.sin(t * (.9 * p.pulse + .6) + it.phase) * (.008 + p.energy * .012);
      it.group.scale.set(1 - breathe * .4, 1 + breathe, 1);                                  // breathing
      it.group.rotation.y = lerp(it.group.rotation.y, mx * .22 + (it.baseX ? -it.baseX * .01 : 0), Math.min(1, dt * 4)); // head/body tracking
      it.group.rotation.x = lerp(it.group.rotation.x, -my * .1, Math.min(1, dt * 4));
      it.glow.material.opacity = .11 + it.cur.energy * .15 * (.8 + .2 * Math.sin(t * p.pulse * 2 + it.phase)) + it.hover * .18;
      const podium = podiums[items.indexOf(it)];
      podium.rim.material.opacity = Math.min(1, .72 + it.hover * .28 + it.cur.energy * .09);
      podium.pool.material.opacity = .42 + it.hover * .35 + it.cur.energy * .2;
      podium.top.material.opacity = .72 + it.hover * .20;
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
    camera.position.set(cam.x + (pointer.in && !reduced ? pointer.x * .35 : 0), cam.y + (pointer.in && !reduced ? pointer.y * .2 : 0), cam.z);
    camera.lookAt(cam.x * .9, -.35, 0);
  }
  function render() { renderer.render(scene, camera); }
  function frame() {
    raf = 0; pending = false;
    if (!visible || document.hidden) return;
    const dt = Math.min(.05, clock.getDelta()); update(dt, clock.elapsedTime); render();
    if (!reduced) raf = requestAnimationFrame(frame);
    else if (Math.abs(cam.z - camTarget.z) > .01) requestRender();
  }
  function requestRender() {
    if (raf || pending) return; pending = true; raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
  canvas.addEventListener('webglcontextrestored', requestRender);
  document.getElementById('dit-stage-note').textContent = 'LIVE CONTROL ROOM / DEPTH ARTWORK';
  requestRender();
  return { requestRender, zoomTo, zoomOut, setFocus };
}
