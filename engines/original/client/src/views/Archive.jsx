import React, { useEffect, useState } from 'react';
import { api, createBattle, streamBattle, isDeviceMode, downloadBattle } from '../api.js';
import { StatusBadge, Empty } from '../components.jsx';
import BattleLanes from './BattleLanes.jsx';

export default function Archive({ refreshKey }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  useEffect(() => { api('/battles').then((r) => setList(r.battles)).catch((e) => setError(e.message)); }, [refreshKey]);
  const load = (id) => api(`/battles/${id}`).then(setOpen).catch((e) => setError(e.message));
  async function rerun() {
    setRunning(true); setError(null);
    try {
      const started = await createBattle(open.challengeId, open.entries.map((e) => ({ contenderId: e.contenderId, label: e.label,
        overrides: { systemPrompt: e.configuration.systemPrompt, temperature: e.configuration.temperature, maxTokens: e.configuration.maxTokens } })));
      setOpen(started);
      await streamBattle(started.battleId, setOpen);
      setList((await api('/battles')).battles);
    } catch (e) { setError(e.message); } finally { setRunning(false); }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Battle Archive</h1>
        <p className="lede">{isDeviceMode() ? 'Your battles stay on this device. These records are locally verified and can be edited by the browser owner; they are not server-attested. ' : ''}Every battle is saved as a structured JSON record: prompt hash, exact configuration, timestamps, raw output, verification detail, and errors. Download one and you hold the evidence.</p>
      </header>
      <div className="arcade" aria-hidden />
      {error && <p className="err">{error}</p>}
      {list && list.length === 0 && <Empty title="The archive is empty">Battles appear here the moment they start.</Empty>}
      <div className="archive-grid">
        <ul className="ledger">
          {(list ?? []).map((b) => (
            <li key={b.battleId}>
              <button className={`ledger-row ${open?.battleId === b.battleId ? 'on' : ''}`} onClick={() => load(b.battleId)}>
                <span><b>{b.title}</b><span className="muted">{new Date(b.createdAt).toLocaleString()}</span></span>
                <span className="ledger-scores">{b.entries.map((e) => `${e.score ?? '—'}`).join(' · ')}</span>
                <StatusBadge status={b.status} />
              </button>
            </li>
          ))}
        </ul>
        <div className="stage">
          {open ? (<>
            <p>{isDeviceMode() ? <button className="ghost" onClick={() => downloadBattle(open)}>Download the JSON record</button> : <a className="dl" href={`/api/battles/${open.battleId}`} download={`${open.battleId}.json`}>Download the JSON record</a>}</p>
            <button className="ghost" onClick={rerun} disabled={running || open.status === 'LIVE'}>{running ? 'Re-running evaluation…' : 'Re-run this challenge and configuration'}</button>
            <p className="muted">A re-run makes new inference calls and a new record. Its outputs may differ.</p>
            <BattleLanes battle={open} />
          </>) : list?.length ? <Empty title="Select a battle">Open any record to inspect the prompt, outputs, scores, and failures.</Empty> : null}
        </div>
      </div>
    </div>
  );
}
