/** Device-local evidence, never submitted to a trusted server leaderboard. */
export async function openBrowserStore() {
  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('colosseum-evidence', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('battles', { keyPath: 'battleId' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Evidence database is blocked by another tab'));
    });
    const rows = await transact(db, 'readonly', (s) => s.getAll());
    return { records: rows, persistent: true, warning: null, async save(record) { await transact(db, 'readwrite', (s) => s.put(record)); } };
  } catch (e) {
    return { records: [], persistent: false, warning: `Storage unavailable: ${e.message}. Export JSON before closing this tab.`, async save() {} };
  }
}
function transact(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('battles', mode);
    const req = action(tx.objectStore('battles'));
    let result;
    req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Evidence transaction aborted'));
  });
}
