import React, { useMemo, useState } from 'react';
import { createBattle, streamBattle, isDeviceMode } from '../api.js';
import { StatusBadge, ArenaRing, Empty } from '../components.jsx';
import { Avatar } from '../characters.jsx';
import BattleLanes from './BattleLanes.jsx';

export default function Arena({ contenders, challenges, onChanged }) {
  const [challengeId, setChallengeId] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [gauntlet, setGauntlet] = useState(false);
  const [battle, setBattle] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const selected = challengeId ?? challenges[0]?.id;
  const operational = contenders.filter((c) => c.operational);
  const families = useMemo(() => [...new Set(contenders.map((c) => c.family))], [contenders]);
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function enter() {
    setError(null); setRunning(true);
    const entrants = [...picked].map((contenderId) => ({ contenderId }));
    const list = gauntlet ? challenges.map((c) => c.id) : [selected];
    try {
      for (const [i, id] of list.entries()) {
        setProgress(gauntlet ? { i: i + 1, n: list.length, id } : null);
        const started = await createBattle(id, entrants);
        setBattle(started);
        const final = await streamBattle(started.battleId, setBattle);
        setBattle(final);
        onChanged();
      }
    } catch (e) {
      setError(e.details?.length ? `${e.message}: ${e.details.map((d) => `${d.contenderId} — ${d.reason}`).join('; ')}` : e.message);
    } finally { setRunning(false); setProgress(null); onChanged(); }
  }

  const disciplineOf = (c) => c.discipline === 'math' ? 'Mathematics' : 'Structured reasoning';
  return (
    <div className="arena">
      <section className="hero">
        <ArenaRing />
        <div className="hero-copy">
          <h1>COLOSSEUM</h1>
          <p className="hero-tag">Every AI claims intelligence. Only the arena reveals its strengths.</p>
          <p className="hero-sub">Identical challenges. Real streamed output. Scores computed by code, never by opinion.</p>
        </div>
      </section>

      <div className="arcade" aria-hidden />

      <div className="arena-grid">
        <aside className="rail">
          <h2>The challenge <small className="muted">· {challenges.length} trials</small></h2>
          <ol className="roster">
            {challenges.map((c) => (
              <li key={c.id}>
                <button className={`roster-row ${selected === c.id ? 'on' : ''}`} onClick={() => setChallengeId(c.id)} disabled={running} aria-pressed={selected === c.id}>
                  <span className="roster-title">{c.title}</span>
                  <span className="muted">{disciplineOf(c)} · {c.difficulty}</span>
                </button>
              </li>
            ))}
          </ol>

          <h2>The contenders</h2>
          {operational.length === 0 && (
            <Empty title="Awaiting a model">{isDeviceMode() ? 'Load a model using the device controls above. Compatible browsers run real inference locally, without an API key.' : 'The free local runner needs its one-time model download. Run npm run setup:local, then restart the server. Ollama and OpenAI-compatible servers are also supported.'}</Empty>
          )}
          {families.map((f) => (
            <div key={f} className="family">
              <h3 className="family-name">{f}</h3>
              {contenders.filter((c) => c.family === f).map((c) => (
                <label key={c.id} className={`pick ${c.operational ? '' : 'inert'} ${picked.has(c.id) ? 'on' : ''}`}>
                  <input type="checkbox" disabled={!c.operational || running} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                  <Avatar id={c.id} size={36} dim={!c.operational} live={c.state === 'LIVE'} />
                  <span className="pick-text">
                    <span className="pick-name">{c.name}</span>
                    <span className="muted">{c.operational ? `${c.provider} · ${c.kind}` : c.reason}</span>
                  </span>
                  <StatusBadge status={c.state} />
                </label>
              ))}
            </div>
          ))}

          <label className="check"><input type="checkbox" checked={gauntlet} onChange={(e) => setGauntlet(e.target.checked)} disabled={running} /> Run the full gauntlet — every challenge, one after another</label>
          <button className="cta" onClick={enter} disabled={running || picked.size === 0 || !selected}>
            {running ? (progress ? `Gauntlet ${progress.i} of ${progress.n} in progress` : 'Battle in progress') : picked.size === 0 ? 'Select at least one contender' : `Enter the arena with ${picked.size}`}
          </button>
          {error && <p className="err" role="alert">{error}</p>}
        </aside>

        <main className="stage">
          {battle ? <BattleLanes battle={battle} /> : (
            <Empty title="The sand is empty">Choose a challenge and one or more operational contenders, then enter the arena. Every contender receives byte-identical input; timings and outputs shown here are measured, not simulated.</Empty>
          )}
        </main>
      </div>
    </div>
  );
}
