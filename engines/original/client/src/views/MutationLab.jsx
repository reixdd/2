import React, { useEffect, useState } from 'react';
import { createBattle, streamBattle, fmtMs } from '../api.js';
import BattleLanes from './BattleLanes.jsx';
import { Empty } from '../components.jsx';

const PRESETS = [
  { name: 'Verifier', systemPrompt: 'Solve the task, then independently re-derive the answer by a different method and reconcile any difference before writing the final line.' },
  { name: 'Terse', systemPrompt: 'Be maximally concise. Show only essential working.' },
  { name: 'Overconfident', systemPrompt: 'Answer immediately without checking your work. Do not verify.' },
];

function Verdict({ battle }) {
  if (!battle || (battle.status !== 'COMPLETED' && battle.status !== 'FAILED')) return null;
  const [o, m] = battle.entries;
  if (o.status !== 'COMPLETED' || m.status !== 'COMPLETED') {
    return <p className="verdict-line">No comparison possible: {o.status !== 'COMPLETED' ? 'the original' : 'the mutant'} did not complete ({(o.status !== 'COMPLETED' ? o : m).error?.message}).</p>;
  }
  const d = m.verification.score - o.verification.score;
  const dl = m.latency.totalMs - o.latency.totalMs;
  return (
    <section className="delta">
      <div><span className="muted">score change</span><b className={d > 0 ? 'pass' : d < 0 ? 'miss' : ''}>{d > 0 ? '+' : ''}{d}</b></div>
      <div><span className="muted">latency change</span><b>{dl > 0 ? '+' : '−'}{fmtMs(Math.abs(dl))}</b></div>
      <p>{d > 0 ? 'The mutation improved the verified score on this challenge.' : d < 0 ? 'The mutation degraded the verified score on this challenge.' : 'The mutation did not change the verified score on this challenge.'} One trial is one data point — repeat across challenges before concluding anything.</p>
    </section>
  );
}

export default function MutationLab({ contenders, challenges, onChanged }) {
  const ops = contenders.filter((c) => c.operational);
  const [baseId, setBaseId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [battle, setBattle] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const base = ops.find((c) => c.id === baseId) ?? ops[0];

  useEffect(() => { if (base) { setSystemPrompt(base.config.systemPrompt); setTemperature(base.config.temperature); setMaxTokens(base.config.maxTokens); } }, [base?.id]); // eslint-disable-line

  async function run() {
    setError(null); setRunning(true);
    const overrides = {};
    if (systemPrompt !== base.config.systemPrompt) overrides.systemPrompt = systemPrompt;
    if (Number(temperature) !== base.config.temperature) overrides.temperature = Number(temperature);
    if (Number(maxTokens) !== base.config.maxTokens) overrides.maxTokens = Number(maxTokens);
    try {
      const started = await createBattle(challengeId || challenges[0].id, [
        { contenderId: base.id, label: `${base.name} · original` },
        { contenderId: base.id, label: `${base.name} · mutant`, overrides },
      ]);
      setBattle(started);
      setBattle(await streamBattle(started.battleId, setBattle));
    } catch (e) {
      setError(/identical configuration/.test(JSON.stringify(e.details || '')) ? 'The mutant is identical to the original. Change the prompt, temperature, or token limit.' : e.message);
    } finally { setRunning(false); onChanged(); }
  }

  if (!ops.length) return <div className="page"><Empty title="Nothing to mutate">The lab needs at least one operational contender. See the Contenders tab for what is blocking each one.</Empty></div>;
  return (
    <div className="page">
      <header className="page-head">
        <h1>Mutation Lab</h1>
        <p className="lede">Same weights, same challenge, one change. The original and the mutant fight side by side and the verified scores decide.</p>
      </header>
      <div className="arcade" aria-hidden />
      <div className="lab-grid">
        <form className="lab-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label>Contender<select value={base.id} onChange={(e) => setBaseId(e.target.value)} disabled={running}>{ops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Challenge<select value={challengeId || challenges[0].id} onChange={(e) => setChallengeId(e.target.value)} disabled={running}>{challenges.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.difficulty})</option>)}</select></label>
          <label>Added system instructions
            <textarea rows={6} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} disabled={running} placeholder="Leave as-is to keep the original configuration" />
          </label>
          <div className="presets">{PRESETS.map((p) => <button type="button" key={p.name} className="ghost" onClick={() => setSystemPrompt(p.systemPrompt)} disabled={running}>{p.name}</button>)}</div>
          <div className="two">
            <label>Temperature {Number(temperature).toFixed(1)}<input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} disabled={running} /></label>
            <label>Max tokens<input type="number" min="16" max="16384" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} disabled={running} /></label>
          </div>
          <button className="cta" type="submit" disabled={running}>{running ? 'Battle in progress' : 'Fight original against mutant'}</button>
          {error && <p className="err" role="alert">{error}</p>}
        </form>
        <div className="stage">
          {battle ? <><Verdict battle={battle} /><BattleLanes battle={battle} /></> : <Empty title="No mutation tested yet">Edit the instructions or parameters on the left. Only the fields you change differ between the two fighters; the challenge prompt is identical.</Empty>}
        </div>
      </div>
    </div>
  );
}
