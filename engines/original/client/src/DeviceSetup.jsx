import React, { useState } from 'react';
import { deviceArena, isPublicBuild, switchMode } from './api.js';
import { modelsForBackend, browserBackend } from './browser/catalog.js';

export default function DeviceSetup({ health, onChanged }) {
  const [error, setError] = useState(null), [requesting, setRequesting] = useState(false);
  const backend = browserBackend();
  const supported = health?.device?.supported, busy = health?.busy || requesting;
  async function load(id) {
    setError(null); setRequesting(true);
    try { await (await deviceArena()).load(id); }
    catch (e) { setError(e?.message || String(e)); }
    finally { setRequesting(false); onChanged(); }
  }
  const ready = health?.readyModels ?? [];
  return <section className="device-setup" aria-label="Free device arena">
    <div className="device-intro"><p className="eyebrow">THE TRIAL RUNS ON YOUR DEVICE</p><h2>Summon. Solve. See the evidence.</h2>
      <label className="device-backend">Compute on this device <select aria-label="Device inference backend" disabled={busy} value={backend} onChange={(e) => { localStorage.setItem('colosseum-device-backend', e.target.value); location.reload(); }}><option value="wasm">CPU · widest compatibility</option><option value="webgpu">GPU · faster on supported devices</option></select></label>
      <p>No inference key or shared API quota. Download a model once, then your browser runs the trial on its {backend === 'wasm' ? 'CPU' : 'GPU'}. Weights may use hundreds of MB of data; Wi-Fi is recommended. Loading a second model replaces the resident model.</p>
      <p className="muted">Small models are here to make testing accessible. Their results do not represent the larger models in each family. Evidence stays on this device.</p>
      {!supported && <p className="device-support" role="status">{health?.device?.reason ?? 'Checking device compatibility…'} You can still explore the cast and challenges.</p>}
      {!isPublicBuild && <button className="ghost" disabled={busy} onClick={() => switchMode('server')}>Return to server arena</button>}
    </div>
    <div className="device-actions">
      {(backend === 'wasm' ? modelsForBackend().slice().reverse() : modelsForBackend()).map((m) => <div className="model-download" key={m.id}>
        <div><strong>{m.name}</strong><small>{backend === 'wasm' ? `~${Math.ceil(m.downloadBytes / 1048576)} MB weights · CPU · memory use varies` : `~${(m.memoryMB / 1024).toFixed(1)} GB GPU memory · upstream estimate`}</small></div>
        <button className="ghost" disabled={!supported || busy || ready.includes(m.model)} onClick={() => load(m.id)}>{ready.includes(m.model) ? 'Weights validated ✓' : 'Load model'}</button>
      </div>)}
      {health?.loading && <div className="download-progress" role="status"><progress max="1" value={health.loading.progress} /><p>{health.loading.text}</p></div>}
      {busy && <button className="ghost" onClick={async () => (await deviceArena()).cancel()}>Cancel download / battle</button>}
      {ready.length > 0 && !busy && <p className="pass">Choose a validated contender below and enter the arena.</p>}
      {error && <p role="alert" className="err">{error}</p>}
      {health?.storageWarning && <p role="alert" className="err">{health.storageWarning}</p>}
    </div>
  </section>;
}
