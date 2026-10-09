import React, { useEffect, useState } from 'react';

export const STATUS_TEXT = { LIVE: 'LIVE', COMPLETED: 'COMPLETED', UNTESTED: 'UNTESTED', FAILED: 'FAILED' };

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}><i aria-hidden />{STATUS_TEXT[status] ?? status}</span>;
}

export function useNow(active, every = 100) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [active, every]);
  return now;
}

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Robot gladiator: a crested helm with a visor slit. Crest and visor vary deterministically per contender. */
export function Gladiator({ id = '', size = 64, live = false, dim = false }) {
  const h = hash(id || 'x');
  const k = 3 + (h % 4);
  const visor = h % 3;
  const crest = [];
  for (let i = -k; i <= k; i++) {
    const x1 = 32 + i * 1.6, y1 = 17, x2 = 32 + i * 3.4, y2 = 5 + Math.abs(i) * 1.1;
    crest.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  return (
    <svg className={`glad ${live ? 'glad-live' : ''} ${dim ? 'glad-dim' : ''}`} viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Robot gladiator helm">
      <g className="glad-crest" strokeWidth="1.4" strokeLinecap="round">{crest}</g>
      <path className="glad-helm" d="M15 46V31C15 21 23 15 32 15s17 6 17 16v15l-6 9H21z" />
      <path className="glad-brow" d="M15 31h34" />
      <rect className="glad-eye" x="21" y="33" width="22" height="3.2" rx="1" />
      {visor === 1 && <rect className="glad-eye" x="30.4" y="33" width="3.2" height="12" rx="1" />}
      {visor === 2 && <><rect className="glad-eye" x="23" y="39" width="18" height="1.8" rx=".9" /></>}
      <path className="glad-vent" d="M25 50v4M32 50v5M39 50v4" />
    </svg>
  );
}

/** Concentric elliptical arcades — the arena seen from above. */
export function ArenaRing() {
  return (
    <svg className="ring" viewBox="0 0 900 520" aria-hidden preserveAspectRatio="xMidYMid slice">
      <g fill="none" stroke="currentColor">
        <ellipse cx="450" cy="260" rx="430" ry="232" strokeWidth="20" strokeDasharray="3 15" opacity=".35" />
        <ellipse cx="450" cy="260" rx="430" ry="232" strokeWidth="1" opacity=".5" />
        <ellipse cx="450" cy="260" rx="372" ry="198" strokeWidth="16" strokeDasharray="2 12" opacity=".3" />
        <ellipse cx="450" cy="260" rx="372" ry="198" strokeWidth="1" opacity=".45" />
        <ellipse cx="450" cy="260" rx="312" ry="164" strokeWidth="12" strokeDasharray="2 10" opacity=".28" />
        <ellipse cx="450" cy="260" rx="312" ry="164" strokeWidth="1" opacity=".4" />
        <ellipse cx="450" cy="260" rx="236" ry="118" strokeWidth="1" opacity=".6" />
        <ellipse className="ring-sand" cx="450" cy="260" rx="236" ry="118" strokeWidth="1" strokeDasharray="1 7" />
      </g>
    </svg>
  );
}

export function Empty({ title, children }) {
  return <div className="empty"><h3>{title}</h3><p>{children}</p></div>;
}
