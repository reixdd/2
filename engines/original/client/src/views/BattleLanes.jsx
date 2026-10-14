import React, { useEffect, useRef } from 'react';
import { StatusBadge, useNow } from '../components.jsx';
import { Avatar, useCharacter } from '../characters.jsx';
import { fmtMs, toRoman } from '../api.js';

const order = (a, b) => {
  const rank = (e) => (e.status === 'COMPLETED' ? 0 : e.status === 'FAILED' ? 2 : 1);
  return rank(a) - rank(b) || (b.verification?.score ?? -1) - (a.verification?.score ?? -1) || (a.latency.totalMs ?? 1e12) - (b.latency.totalMs ?? 1e12);
};

function Lane({ entry, place, now }) {
  const character = useCharacter(entry.contenderId);
  const ref = useRef(null);
  const live = entry.status === 'LIVE';
  useEffect(() => { if (live && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [entry.output, entry.reasoning, live]);
  const elapsed = live ? now - Date.parse(entry.timestamps.startedAt) : entry.latency.totalMs;
  const v = entry.verification;
  return (
    <article className={`lane lane-${entry.status.toLowerCase()}`}>
      <div className="lane-place" aria-label={place ? `Place ${place}` : 'Unplaced'}>{place ? toRoman(place) : '·'}</div>
      <div className="lane-id">
        <Avatar id={entry.contenderId} size={56} live={live} dim={entry.status === 'FAILED'} />
        <div>
          <h3>{entry.label}</h3>
          {character?.presentation.characterName && <p className="character-name">{character.presentation.characterName}</p>}
          <p className="muted">{entry.provider} · {entry.model}{entry.configuration.mutated ? ' · mutated' : ''} · cfg {entry.configuration.configHash}</p>
          <StatusBadge status={entry.status} />
        </div>
      </div>
      <dl className="lane-stats">
        <div><dt>elapsed</dt><dd className="mono-big">{fmtMs(elapsed)}</dd></div>
        <div><dt>first token</dt><dd>{fmtMs(entry.latency.firstTokenMs)}</dd></div>
        {entry.latency.queueMs !== null && entry.latency.queueMs !== undefined && <div><dt>queue wait</dt><dd>{fmtMs(entry.latency.queueMs)}</dd></div>}
        {entry.latency.modelLoadMs != null && <div><dt>model preparation</dt><dd>{fmtMs(entry.latency.modelLoadMs)}</dd></div>}
        <div><dt>reasoning</dt><dd>{entry.reasoning ? `${entry.reasoning.length.toLocaleString()} ch` : '—'}</dd></div>
        <div><dt>tokens out</dt><dd>{entry.usage?.completion_tokens ?? '—'}</dd></div>
      </dl>
      <div className="lane-score">
        {v ? (<><span className="score-num">{v.score}</span><span className="score-of">/ {v.maxScore}</span><div className="score-bar"><i style={{ width: `${v.score}%` }} /></div><span className={v.passed ? 'pass' : 'miss'}>{v.passed ? 'verified correct' : 'verified incorrect'}</span></>)
          : <><span className="score-num dim">—</span><span className="muted">{live ? 'awaiting verdict' : entry.status === 'FAILED' ? 'no score — run failed' : 'not run'}</span></>}
      </div>
      <div className="lane-body">
        <details><summary>Exact contestant input and configuration</summary><pre>{JSON.stringify({ messages: entry.messages ?? null, configuration: entry.configuration, modelIdentity: entry.modelIdentity ?? { modelId: entry.model } }, null, 2)}</pre></details>
        {entry.error && <div className="err"><b>{entry.error.code}</b> {entry.error.message}{entry.error.detail ? <pre>{entry.error.detail}</pre> : null}</div>}
        {(entry.output || live) && <pre ref={ref} className="stream" tabIndex={0}>{entry.output || (entry.reasoning ? '(reasoning…)' : '(waiting for first token…)')}{live && <span className="caret" />}</pre>}
        {v && (
          <details className="verdict" open={!v.passed}>
            <summary>How this was scored</summary>
            <ul>{v.checks.map((c, i) => <li key={i} className={c.ok ? 'pass' : 'miss'}>{c.ok ? 'matched' : 'missed'} — {c.name}</li>)}</ul>
            {v.notes?.map((n, i) => <p key={i} className="muted">{n}</p>)}
            <p className="muted">extracted</p><pre>{JSON.stringify(v.extracted, null, 1)}</pre>
            <p className="muted">expected</p><pre>{JSON.stringify(v.expected, null, 1)}</pre>
          </details>
        )}
      </div>
    </article>
  );
}

export default function BattleLanes({ battle }) {
  const live = battle.entries.some((e) => e.status === 'LIVE');
  const now = useNow(live);
  const done = battle.status === 'COMPLETED' || battle.status === 'FAILED';
  const entries = done ? [...battle.entries].sort(order) : battle.entries;
  let place = 0;
  return (
    <section className="lanes" aria-live="polite">
      <header className="lanes-head">
        <div>
          <h2>{battle.challenge.title}</h2>
          <p className="muted">{battle.challenge.discipline} · {battle.challenge.difficulty} · prompt {battle.challenge.promptHash} · {battle.battleId}</p>
        </div>
        <StatusBadge status={battle.status} />
      </header>
      {battle.environment?.evidenceScope === 'device-local' && <p className="evidence-note">DEVICE EVIDENCE · Real inference on this browser. Entries run sequentially. Model preparation is excluded from inference latency; results are not independently attested.</p>}
      <details className="decree"><summary>The decree — the exact prompt every contender received</summary><pre>{battle.challenge.system}{'\n\n'}{battle.challenge.user}</pre></details>
      {entries.map((e) => <Lane key={e.entryId} entry={e} now={now} place={done && e.status === 'COMPLETED' ? ++place : null} />)}
    </section>
  );
}
