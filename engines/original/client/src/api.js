export const isPublicBuild = import.meta.env.VITE_ARENA_MODE === 'browser';
export const isDeviceMode = () => { if (isPublicBuild) return true; try { return localStorage.getItem('colosseum-mode') === 'browser'; } catch { return false; } };
export const deviceArena = async () => (await import('./browser/runtime.js')).getBrowserArena();
export function switchMode(mode) { localStorage.setItem('colosseum-mode', mode); location.reload(); }

export async function api(path, opts = {}) {
  if (isDeviceMode()) return (await deviceArena()).api(path, opts);
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error?.message || `HTTP ${res.status}`);
    err.details = body?.error?.details;
    err.code = body?.error?.code;
    throw err;
  }
  return body;
}

export const createBattle = (challengeId, entrants) => api('/battles', { method: 'POST', body: JSON.stringify({ challengeId, entrants }) });

/** Pure reducer for stream events → battle state. */
export function applyEvent(battle, type, data) {
  if (!battle) return battle;
  if (type === 'delta') {
    return { ...battle, entries: battle.entries.map((e) => (e.entryId === data.entryId ? { ...e, [data.channel]: (e[data.channel] || '') + data.text } : e)) };
  }
  if (type === 'entry') return { ...battle, entries: battle.entries.map((e) => (e.entryId === data.entry.entryId ? data.entry : e)) };
  if (type === 'battle') { const { final, ...rest } = data; return { ...battle, ...rest }; }
  return battle;
}

/** Subscribe to a battle's server-sent event stream. Resolves with the final record. */
export function streamBattle(battleId, onUpdate) {
  if (isDeviceMode()) return deviceArena().then((a) => a.stream(battleId, onUpdate));
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/battles/${battleId}/stream`);
    let battle = null, finished = false;
    const push = (b) => { battle = b; onUpdate(b); };
    es.addEventListener('snapshot', (e) => push(JSON.parse(e.data)));
    for (const t of ['delta', 'entry', 'battle']) es.addEventListener(t, (e) => push(applyEvent(battle, t, JSON.parse(e.data))));
    es.addEventListener('done', (e) => { finished = true; push(JSON.parse(e.data)); es.close(); resolve(battle); });
    es.onerror = () => { if (!finished) { es.close(); reject(new Error('Stream connection lost. The battle may still be running — check the Archive.')); } };
  });
}

export const fmtMs = (ms) => (ms == null ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`);
export function toRoman(n) {
  const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of m) while (n >= v) { out += s; n -= v; }
  return out;
}

export async function downloadBattle(battle) {
  const blob = new Blob([JSON.stringify(battle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${battle.battleId}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
