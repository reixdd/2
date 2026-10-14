// Local development persistence. One asynchronous writer, serialized snapshots,
// bounded Windows rename retries and crash recovery. Never delete the previous
// committed database file before the replacement succeeds.
import fs from 'node:fs';
import path from 'node:path';
import { MemoryStore } from './store-core.js';

const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY', 'EEXIST']);
const RETRY_DELAYS_MS = [30, 60, 120, 200, 350, 500, 750, 1000, 1200];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function loadSnapshot(abs) {
  const dir = path.dirname(abs);
  const name = path.basename(abs);
  const candidates = [abs, abs + '.tmp']; // .tmp = recover V6 interrupted saves
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(name + '.') && entry.endsWith('.tmp')) {
      candidates.push(path.join(dir, entry));
    }
  }
  const present = candidates.filter(file => fs.existsSync(file))
    .map(file => ({ file, mtime: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  const committed = fs.existsSync(abs);
  let committedError;
  if (committed) {
    try { JSON.parse(fs.readFileSync(abs, 'utf8')); }
    catch (e) { committedError = e; }
  }
  for (const item of present) {
    try {
      const data = JSON.parse(fs.readFileSync(item.file, 'utf8'));
      if (!data || typeof data !== 'object' || !data.t || typeof data.t !== 'object') continue;
      if (item.file !== abs) console.warn('[storage] Recovering newer valid local snapshot from interrupted write:', path.basename(item.file));
      return { snap: data, recovered: item.file !== abs };
    } catch { /* incomplete temporary files are not usable */ }
  }
  if (committed) {
    throw new Error(`Store file ${abs} is corrupt; refusing to start over it (${committedError?.message || 'invalid snapshot'})`);
  }
  return { snap: null, recovered: false };
}

export function openFileStore(file, opts = {}) {
  const abs = path.resolve(file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const { io = fs.promises, ...memoryOpts } = opts;
  const { snap, recovered } = loadSnapshot(abs);

  // Recover legacy V3 jobs without discarding existing memories or votes.
  if (snap?.t?.agent_jobs) {
    const seen = new Set();
    const preference = { succeeded: 0, running: 1, queued: 2, dead: 3, failed: 4 };
    for (const job of [...snap.t.agent_jobs].sort((a,b) => (preference[a.status] ?? 9) - (preference[b.status] ?? 9))) {
      if (seen.has(job.dedupe_key)) job.dedupe_key += ':legacy:' + job.id;
      seen.add(job.dedupe_key);
    }
  }

  let changedVersion = recovered ? 1 : 0;
  let savedVersion = 0;
  let writer = null;
  let scheduled = false;
  let retryTimer = null;
  let lastError = null;
  const temp = `${abs}.${process.pid}.tmp`;
  const s = new MemoryStore(snap, {
    ...memoryOpts,
    onChange: () => {
      changedVersion++;
      schedule();
    }
  });

  async function atomicSave(json) {
    // Different processes do not clobber each other's temporary file.
    await io.writeFile(temp, json, { mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try {
        await io.rename(temp, abs); // do not remove the committed file first
        return;
      } catch (error) {
        if (!RETRYABLE.has(error?.code) || attempt >= RETRY_DELAYS_MS.length) {
          throw error;
        }
        await wait(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  function startWriter() {
    if (writer) return writer;
    writer = (async () => {
      while (savedVersion < changedVersion) {
        const version = changedVersion;
        const payload = JSON.stringify(s.snapshot());
        await atomicSave(payload);
        savedVersion = version;
        lastError = null;
      }
    })();
    const active = writer;
    // Reset only after this writer is finished, then handle any late mutations.
    void active.finally(() => {
      if (writer === active) writer = null;
      if (savedVersion < changedVersion && !retryTimer) armRetry();
    }).catch(() => {});
    return active;
  }

  function armRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flush().catch(error => {
        lastError = error;
        console.error('[storage] Save still blocked. In-memory data retained; retry scheduled:', error.message);
      });
    }, 3000);
    retryTimer.unref?.();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void flush().catch(error => {
        lastError = error;
        console.error('[storage] Windows blocked an atomic database save. Retaining data and retrying:', error.message);
        armRetry();
      });
    });
  }

  async function flush() {
    // Explicit flush callers must await this Promise before reading or exiting.
    if (savedVersion === changedVersion) return;
    while (savedVersion < changedVersion) {
      await startWriter();
    }
  }

  s.kind = 'file';
  s.flush = flush;
  Object.defineProperty(s, 'persistenceStatus', { get: () => ({ pending: changedVersion > savedVersion, lastError: lastError?.message || null }) });
  if (recovered) schedule();
  return s;
}
