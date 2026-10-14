import React, { useCallback, useEffect, useState } from 'react';
import { api, isDeviceMode, switchMode } from './api.js';
import DeviceSetup from './DeviceSetup.jsx';
import Arena from './views/Arena.jsx';
import Contenders from './views/Contenders.jsx';
import MutationLab from './views/MutationLab.jsx';
import Leaderboards from './views/Leaderboards.jsx';
import Archive from './views/Archive.jsx';
import Genealogy from './views/Genealogy.jsx';
import { CharacterContext } from './characters.jsx';

const TABS = [['arena', 'Live Arena'], ['contenders', 'Contenders'], ['lab', 'Mutation Lab'], ['genealogy', 'Lineage'], ['boards', 'Leaderboards'], ['archive', 'Battle Archive']];

export default function App() {
  const [tab, setTab] = useState(() => (location.hash.slice(1) || 'arena'));
  const [contenders, setContenders] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  const refresh = useCallback(() => {
    api('/contenders').then((r) => setContenders(r.contenders)).catch((e) => setError(e.message));
    api('/characters').then((r) => setCharacters(r.characters)).catch((e) => setError(e.message));
    api('/health').then(setHealth).catch((e) => { setHealth(null); setError(e.message); });
    setTick((t) => t + 1);
  }, []);
  useEffect(() => {
    api('/challenges').then((r) => { setChallenges(r.challenges); setDisciplines(r.disciplines); }).catch((e) => setError(e.message));
    refresh();
  }, [refresh]);
  useEffect(() => { location.hash = tab; }, [tab]);
  useEffect(() => { const timer = setInterval(refresh, 20000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    const change = () => setTab(TABS.some(([id]) => id === location.hash.slice(1)) ? location.hash.slice(1) : 'arena');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);

  useEffect(() => {
    let timer;
    const update = () => { clearTimeout(timer); timer = setTimeout(refresh, 100); };
    window.addEventListener('colosseum-device-change', update);
    return () => { clearTimeout(timer); window.removeEventListener('colosseum-device-change', update); };
  }, [refresh]);
  const p = health?.providers;
  const device = isDeviceMode();
  return (
    <CharacterContext.Provider value={{ byId: Object.fromEntries(characters.map((c) => [c.id, c])) }}>
      <header className="top">
        <a className="wordmark" href="#arena" onClick={() => setTab('arena')}>COLOSSEUM</a>
        <nav aria-label="Sections">
          {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}
        </nav>
        <div className="sys" title="Live provider status as reported by the server">
          {device ? <><span className={`dot ${health?.device?.supported ? 'ok' : ''}`} /> Device arena · {health ? health.device?.supported ? health.device.backend === 'wasm' ? 'CPU available' : 'WebGPU available' : 'device unavailable' : 'checking compatibility'}</> : health ? (<>
            <span className="dot ok" /> API online
            {p && <span className="muted"> · Local CPU {p.local?.reachable ? 'ready' : 'awaiting model'} · Ollama {p.ollama?.reachable ? `${p.ollama.modelCount} models` : 'offline'}</span>}
          </>) : <><span className="dot bad" /> API unreachable</>}
        </div>
      </header>
      {device ? <DeviceSetup health={health} onChanged={refresh} /> : <div className="mode-strip"><span>Connected server arena</span><button className="ghost" onClick={() => switchMode('browser')}>Try free device inference →</button></div>}
      {error && !health && <p className="err banner" role="alert">{device ? `The device arena could not initialize: ${error}` : `Cannot reach the arena server (${error}). Start it with npm run dev.`}</p>}
      {tab === 'arena' && <Arena contenders={contenders} challenges={challenges} onChanged={refresh} />}
      {tab === 'contenders' && <Contenders contenders={contenders} selectedId={selectedCharacter} onSelect={setSelectedCharacter} onGenealogy={() => setTab('genealogy')} />}
      {tab === 'genealogy' && <Genealogy refreshKey={tick} onSelect={(id) => { setSelectedCharacter(id); setTab('contenders'); }} />}
      {tab === 'lab' && challenges.length > 0 && <MutationLab contenders={contenders} challenges={challenges} onChanged={refresh} />}
      {tab === 'boards' && <Leaderboards contenders={contenders} disciplines={disciplines} refreshKey={tick} />}
      {tab === 'archive' && <Archive refreshKey={tick} />}
      <footer className="foot"><div className="arcade" aria-hidden /><p className="muted">COLOSSEUM v0.2 · scores are computed deterministically · nothing here executes model-written code or touches funds</p></footer>
    </CharacterContext.Provider>
  );
}
