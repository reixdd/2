import fs from 'node:fs';
import path from 'node:path';

/** JSON-file battle store. One file per battle: data/battles/<id>.json (atomic write). */
export function createStore(dataDir) {
  const dir = path.join(dataDir, 'battles');
  fs.mkdirSync(dir, { recursive: true });
  const battles = new Map();

  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const b = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      // A battle recorded as in-flight can't still be running after a restart. Say so honestly.
      if (b.status === 'LIVE' || b.status === 'UNTESTED') {
        b.status = 'FAILED';
        b.completedAt = new Date().toISOString();
        for (const e of b.entries) if (e.status === 'LIVE' || e.status === 'UNTESTED') {
          e.status = 'FAILED';
          e.verification = null;
          e.error = { code: 'interrupted', message: 'Server restarted while this entry was running', detail: null };
          e.timestamps.completedAt = b.completedAt;
        }
        fs.writeFileSync(path.join(dir, f), JSON.stringify(b, null, 2));
      }
      battles.set(b.battleId, b);
    } catch (e) {
      console.warn(`[store] skipped unreadable ${f}: ${e.message}`);
    }
  }

  return {
    dir,
    all: () => [...battles.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    get: (id) => battles.get(id) ?? null,
    save(battle) {
      battles.set(battle.battleId, battle);
      const file = path.join(dir, `${battle.battleId}.json`);
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(battle, null, 2));
      fs.renameSync(`${file}.tmp`, file);
    },
    writeResults(results) {
      const file = path.join(dataDir, 'results.json');
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(results, null, 2));
      fs.renameSync(`${file}.tmp`, file);
    },
  };
}
