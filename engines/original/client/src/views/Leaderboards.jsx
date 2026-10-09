import React, { useEffect, useState } from 'react';
import { api, fmtMs, toRoman, isDeviceMode } from '../api.js';
import { Gladiator, Empty, StatusBadge } from '../components.jsx';

export default function Leaderboards({ contenders, disciplines, refreshKey }) {
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api('/results').then(setResults).catch((e) => setError(e.message)); }, [refreshKey]);
  if (error) return <div className="page"><p className="err">{error}</p></div>;
  if (!results) return <div className="page"><p className="muted">Loading results…</p></div>;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Leaderboards</h1>
        <p className="lede">{isDeviceMode() ? 'Your device leaderboard — browser-controlled evidence, not a global ranking. ' : ''}There is no single intelligence score. Each discipline is ranked on its own, using only verified runs. Failed runs are shown as failures — never as zeros, never hidden.</p>
      </header>
      <div className="arcade" aria-hidden />
      {disciplines.map((d) => {
        const rows = results.disciplines[d.id] ?? [];
        const ranked = new Set(rows.map((r) => r.contenderId));
        const untested = contenders.filter((c) => c.operational && !ranked.has(c.id));
        return (
          <section key={d.id} className="board">
            <h2>{d.label}</h2>
            <p className="muted">{d.note}</p>
            {d.status !== 'available' ? <p className="reason">Unavailable. This discipline is not scored until its inputs can be verified.</p>
              : rows.length === 0 ? <Empty title="No verified runs yet">Run a {d.label.toLowerCase()} challenge in the Arena to start this board.</Empty> : (
              <ol className="rows">
                {rows.map((r) => (
                  <li key={r.key} className="brow">
                    <span className="brank">{r.rank ? toRoman(r.rank) : '·'}</span>
                    <Gladiator id={r.contenderId} size={44} />
                    <span className="bname"><b>{r.label}</b><span className="muted">{r.provider} · {r.model}{r.mutated ? ` · mutated cfg ${r.configHash}` : ''}</span></span>
                    <span className="bscore">{r.avgScore == null ? '—' : r.avgScore.toFixed(0)}<small>avg score</small></span>
                    <span className="bstat">{r.passRate == null ? '—' : `${Math.round(r.passRate * 100)}%`}<small>solved</small></span>
                    <span className="bstat">{fmtMs(r.medianLatencyMs)}<small>median time</small></span>
                    <span className="bstat">{r.completed}/{r.attempts}<small>completed{r.failed ? `, ${r.failed} failed` : ''}</small></span>
                  </li>
                ))}
              </ol>
            )}
            {d.status === 'available' && untested.length > 0 && (
              <p className="untested"><StatusBadge status="UNTESTED" /> {untested.map((c) => c.name).join(' · ')}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
