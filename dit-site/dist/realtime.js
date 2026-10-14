// Realtime transport. Production: Supabase Realtime (postgres_changes on public-safe tables, RLS applies).
// Local file backend: Server-Sent Events from /api/stream. Anything else: the 15s polling in agents-live.js remains.
// This module only tells the UI WHEN to refetch; the API stays the single source of truth.
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const TABLES = ['agent_vote_counts', 'activity_events', 'agents', 'token_proposals', 'treasury_ledger'];
let timer = 0, mode = 'polling';
const badge = document.createElement('span');
badge.className = 'mono'; badge.id = 'dit-rt'; badge.textContent = 'UPDATES: POLLING';
const mount = () => { const top = document.querySelector('#dit-operations .section-top'); if (top && !badge.isConnected) top.append(badge); return badge.isConnected; };
const iv = setInterval(() => { if (mount()) clearInterval(iv); }, 500);
const set = (m, label) => { mode = m; badge.textContent = 'UPDATES: ' + label; };
const poke = () => { if (timer) return; timer = setTimeout(() => { timer = 0; window.dispatchEvent(new Event('dit:refresh')); }, 800); };

(async () => {
  let config;
  try { config = await (await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(10000) })).json(); } catch { return; }
  if (config.auth === 'supabase' && config.supabase) {
    try {
      const { createClient } = await import(SUPABASE_JS);
      const sb = createClient(config.supabase.url, config.supabase.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = sb.channel('dit-public');
      for (const table of TABLES) ch.on('postgres_changes', { event: '*', schema: 'public', table }, poke);
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') set('supabase', 'SUPABASE REALTIME');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') set('polling', 'POLLING (REALTIME UNAVAILABLE)');
      });
      return;
    } catch { set('polling', 'POLLING (REALTIME UNAVAILABLE)'); return; }
  }
  if (config.backend?.kind === 'file' && 'EventSource' in window) {
    const es = new EventSource('/api/stream');
    es.onopen = () => set('sse', 'LIVE STREAM (LOCAL)');
    es.onmessage = poke;
    es.onerror = () => set('polling', 'POLLING (STREAM LOST)');
  }
})();
