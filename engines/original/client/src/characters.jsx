import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Gladiator, StatusBadge } from './components.jsx';
export const CharacterContext = createContext({ byId: {} });
export const useCharacter = (id) => useContext(CharacterContext).byId[id];
export function Avatar({ id, size = 56, live = false, dim = false }) {
  const c = useCharacter(id);
  return c?.presentation.portraitUrl ? <img className={`character-avatar ${live ? 'glad-live' : ''} ${dim ? 'glad-dim' : ''}`} src={c.presentation.portraitUrl} alt={c.presentation.characterName} width={size} height={size} /> : <Gladiator id={id} size={size} live={live} dim={dim} />;
}
/** Untested axes are gaps; they are never drawn as zero scores. */
export function CapabilityRadar({ values }) {
  const point = (i, score = 100) => { const a = i * Math.PI * 2 / values.length - Math.PI / 2; return [180 + Math.cos(a) * score, 150 + Math.sin(a) * score]; };
  const measured = values.filter((v) => v.runs > 0 && v.avgScore !== null);
  return <div className="capability-radar"><svg viewBox="0 0 360 305" role="img" aria-label={`Capability radar: ${measured.length} of ${values.length} challenges evaluated. Missing values are untested.`}>
    {[25, 50, 75, 100].map((r) => <polygon key={r} points={values.map((_, i) => point(i, r).join(',')).join(' ')} className="radar-grid" />)}
    {values.map((v, i) => <g key={v.challengeId}><line x1="180" y1="150" x2={point(i)[0]} y2={point(i)[1]} className="radar-grid" /><text x={point(i, 127)[0]} y={point(i, 127)[1]} textAnchor="middle">{v.title.replace(/^The /, '')}</text>{v.runs > 0 && v.avgScore !== null && <circle cx={point(i, v.avgScore)[0]} cy={point(i, v.avgScore)[1]} r="5" className="radar-point" />}</g>)}
    {measured.length === values.length && values.length > 0 && <polygon className="radar-measured" points={values.map((v, i) => point(i, v.avgScore).join(',')).join(' ')} />}
    {!measured.length && <text className="radar-empty" x="180" y="155" textAnchor="middle">AWAITING EVALUATION</text>}
  </svg><table><caption>Verified results for this exact configuration</caption><tbody>{values.map((v) => <tr key={v.challengeId}><th scope="row">{v.title}</th><td>{v.runs > 0 ? `${v.avgScore.toFixed(1)} / 100 · ${v.runs} runs` : 'UNTESTED'}</td></tr>)}</tbody></table></div>;
}
const PHASES = ['PORTAL OPENS', 'CHARACTER ARRIVES', 'IDENTITY REVEAL', 'PROFILE DISPLAY', 'AWAITING EVALUATION'];
export function Summoning({ character: c, onClose }) {
  const dialog = useRef(null), [phase, setPhase] = useState(0);
  useEffect(() => {
    dialog.current.showModal();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase(4); return; }
    const timers = [650, 1300, 2100, 3000].map((delay, i) => setTimeout(() => setPhase(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, []);
  const { presentation: p, status: s, technical: t } = c;
  return <dialog ref={dialog} className={`summoning phase-${phase} entrance-${p.entranceAnimation}`} onCancel={onClose} aria-labelledby="summon-title"><div className="portal-ring" aria-hidden="true" /><button className="summon-skip ghost" onClick={onClose} aria-label="Skip entrance">Skip entrance ×</button><p className="eyebrow" aria-live="polite">{PHASES[phase]}</p>
    {p.originalArtworkUrl ? <img className="summon-art" src={p.originalArtworkUrl} alt={p.characterName} /> : <Gladiator id={c.id} size={180} />}
    <h2 id="summon-title">{phase >= 2 ? p.characterName ?? p.displayName : 'An arrival from another realm'}</h2><p>{phase >= 3 ? `${p.displayName} · ${t.modelId ?? 'Reserved model slot'}` : p.archetype}</p>
    <div className="summon-truth"><StatusBadge status={s.label} /><p>{s.operational ? 'Model available. This entrance awards no score.' : s.reason}</p><p className="muted">Fictional entrance. Availability and evaluation are separate.</p></div>{phase === 4 && <button className="cta" onClick={onClose}>View character profile</button>}
  </dialog>;
}
