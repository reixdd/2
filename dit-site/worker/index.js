// Persistent research worker. Run with: node worker/index.js   (Supabase) or DIT_STORE=file node worker/index.js (local file store).
// Holds secrets (service-role key, LLM key). Never import this from the browser or the edge Worker bundle.
import { createStore } from '../server/lib/store-core.js';
import { openFileStore } from '../server/lib/store-file.js';
import { createLlm } from './llm.js';
import { Scheduler } from './scheduler.js';
import { bootstrap } from './bootstrap.js';

export async function startWorker(env = process.env, { signal } = {}) {
  const store = env.DIT_STORE === 'file' ? openFileStore(env.DIT_STORE_FILE || '.data/dit-store.json') : createStore(env);
  if (!store) throw new Error('No store: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or DIT_STORE=file for local development).');
  const llm = createLlm(env); await llm.discover(); await bootstrap(store);
  const sch = new Scheduler({ store, env, llm, workerId: env.DIT_WORKER_ID || `worker-${process.pid}`, log: (...a) => console.log(new Date().toISOString(), ...a) });
  console.log(`DIT worker ${sch.workerId} · store=${store.kind} · LLM ${llm.configured ? llm.model : 'NOT CONFIGURED (research only, no concept generation)'}`);
  const every = Number(env.DIT_TICK_SECONDS || 15) * 1000; let stopped = false; signal?.addEventListener('abort', () => { stopped = true; });
  const loop = (async () => { while (!stopped) { try { await sch.tick(); } catch (e) { console.error('tick failed:', e.message); } await new Promise(r => setTimeout(r, every)); } })();
  return { scheduler: sch, store, stop: async () => { stopped = true; await loop; } };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const ac = new AbortController(); const w = await startWorker(process.env, { signal: ac.signal });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { ac.abort(); await w.stop(); try { await w.store.flush?.(); } catch(e) { console.error('[storage] Final save failed:',e.message); process.exitCode=1; } process.exit(process.exitCode||0); });
}
